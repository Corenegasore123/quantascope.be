import { Inject, Injectable } from "@nestjs/common";
import {
  Prisma,
  RequestStatus,
  TransitionAction,
  User,
  WorkflowStep,
  WorkflowStepType,
} from "@prisma/client";
import { AppError } from "../../common/app-error";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { AuditService } from "../audit/audit.service";
import { StorageService } from "../../common/storage.service";

const ACTIVE_STATUSES: RequestStatus[] = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "PENDING_APPROVAL",
  "APPROVED",
];

@Injectable()
export class WorkflowEngine {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(StorageService) private readonly storage: StorageService
  ) {}

  async nextNumber(): Promise<string> {
    const counter = await this.prisma.counter.upsert({
      where: { key: "request" },
      update: { value: { increment: 1 } },
      create: { key: "request", value: 1042 },
    });
    return `REQ-${counter.value}`;
  }

  async submit(requestId: string, actor: User) {
    const request = await this.loadRequest(requestId);
    if (request.status !== "DRAFT") {
      throw new AppError(409, "Only draft requests can be submitted", "INVALID_STATE");
    }
    if (request.requesterId !== actor.id && actor.role !== "ADMIN") {
      throw new AppError(403, "You cannot submit this request", "FORBIDDEN");
    }

    const start = request.type.workflow.transitions.find((t) => t.fromStepId === null && t.action === "START");
    if (!start?.toStepId) {
      throw new AppError(400, "Workflow has no START transition", "WORKFLOW_INVALID");
    }

    await this.prisma.request.update({
      where: { id: request.id },
      data: { status: "SUBMITTED", submittedAt: new Date() },
    });

    await this.event(request.id, actor.id, "submitted", `${actor.name} submitted request ${request.number}`);
    await this.audit.record(actor.id, "request.submitted", `request:${request.id}`);
    await this.notifications.push({
      userId: request.requesterId,
      type: "REQUEST_SUBMITTED",
      title: `${request.number} submitted`,
      body: `${request.type.name} is now in the workflow.`,
      link: `/app/requests/${request.id}`,
    });

    await this.enterStep(request.id, start.toStepId, actor, "START");
    return this.loadRequest(requestId);
  }

  async applyAction(
    requestId: string,
    action: TransitionAction,
    actor: User,
    comment?: string
  ) {
    const request = await this.loadRequest(requestId);
    if (!ACTIVE_STATUSES.includes(request.status) && request.status !== "DRAFT") {
      throw new AppError(409, "This request is no longer in progress", "INVALID_STATE");
    }
    if (!request.currentStepId) {
      throw new AppError(409, "Request is not in a workflow step", "INVALID_STATE");
    }

    await this.assertCanAct(request, actor);

    const transition = request.type.workflow.transitions.find(
      (t) => t.fromStepId === request.currentStepId && t.action === action
    );
    if (!transition) {
      throw new AppError(400, `Action ${action} is not valid from the current step`, "INVALID_TRANSITION");
    }

    const openTask = request.tasks.find((t) => t.status === "OPEN" && t.stepId === request.currentStepId);
    if (openTask) {
      await this.prisma.task.update({
        where: { id: openTask.id },
        data: { status: "COMPLETED", completedAt: new Date(), comment },
      });
    }

    if (request.currentStep && ["APPROVAL", "CONDITION", "TASK"].includes(request.currentStep.type)) {
      await this.prisma.approval.create({
        data: {
          requestId: request.id,
          taskId: openTask?.id,
          stepId: request.currentStepId,
          actorId: actor.id,
          decision: action,
          comment,
        },
      });
    }

    const stepName = request.currentStep?.name ?? "step";
    await this.event(
      request.id,
      actor.id,
      action.toLowerCase(),
      `${actor.name} recorded ${action.toLowerCase()} at ${stepName}${comment ? `: ${comment}` : ""}`
    );
    await this.audit.record(actor.id, `request.${action.toLowerCase()}`, `request:${request.id}`, {
      step: stepName,
      comment: comment ?? null,
    });

    if (action === "REJECT" || action === "OUTSTANDING" || transition.toStatus === "REJECTED") {
      await this.closeOpenTasks(request.id);
      await this.prisma.request.update({
        where: { id: request.id },
        data: {
          status: "REJECTED",
          currentStepId: null,
          assignedOfficerId: null,
          currentApproverId: null,
          completedAt: new Date(),
        },
      });
      await this.notifications.push({
        userId: request.requesterId,
        type: "REQUEST_REJECTED",
        title: `${request.number} was rejected`,
        body: comment ?? `${stepName} did not approve this request.`,
        link: `/app/requests/${request.id}`,
      });
      return this.loadRequest(requestId);
    }

    if (!transition.toStepId || transition.toStatus === "COMPLETED") {
      await this.completeRequest(request.id, actor);
      return this.loadRequest(requestId);
    }

    await this.enterStep(request.id, transition.toStepId, actor, action);
    return this.loadRequest(requestId);
  }

  async enterStep(requestId: string, stepId: string, actor: User | null, via: string) {
    const request = await this.loadRequest(requestId);
    const step = request.type.workflow.steps.find((s) => s.id === stepId);
    if (!step) throw new AppError(400, "Workflow step not found", "WORKFLOW_INVALID");

    const assignee = await this.resolveAssignee(step, request.requesterId);
    const slaHours = step.slaHours ?? request.type.slaHours;
    const dueAt = slaHours ? new Date(Date.now() + slaHours * 60 * 60 * 1000) : null;

    await this.prisma.request.update({
      where: { id: request.id },
      data: {
        currentStepId: step.id,
        assignedOfficerId: assignee?.id ?? null,
        currentApproverId: step.type === "APPROVAL" ? assignee?.id ?? null : null,
        departmentId: step.departmentId ?? request.departmentId,
        status: this.statusForStep(step.type),
        dueAt,
        slaWarnedAt: null,
        slaBreachedAt: null,
      },
    });

    await this.event(
      request.id,
      actor?.id ?? null,
      "step.entered",
      `${step.name} started${assignee ? ` — assigned to ${assignee.name}` : ""}`
    );

    if (assignee && step.assigneeType !== "SYSTEM") {
      const task = await this.prisma.task.create({
        data: {
          requestId: request.id,
          stepId: step.id,
          assigneeId: assignee.id,
          kind: step.type === "APPROVAL" ? "APPROVAL" : "ACTION",
          title: `${step.name} · ${request.number}`,
          dueAt,
        },
      });

      await this.notifications.push({
        userId: assignee.id,
        type: step.type === "APPROVAL" ? "APPROVAL_ASSIGNED" : "TASK_ASSIGNED",
        title: `New ${step.type === "APPROVAL" ? "approval" : "task"}: ${request.number}`,
        body: `${request.type.name} needs ${step.name}.`,
        link: `/app/requests/${request.id}`,
        metadata: { taskId: task.id },
      });
    }

    if (step.type === "DOCUMENT_GENERATION" || step.type === "NOTIFY") {
      if (step.type === "DOCUMENT_GENERATION") {
        await this.generateDocument(request.id, request.number, request.type.name, request.requester.name);
      }
      if (step.type === "NOTIFY") {
        await this.notifications.push({
          userId: request.requesterId,
          type: "GENERIC",
          title: `${request.number} update`,
          body: step.name,
          link: `/app/requests/${request.id}`,
        });
      }
      const complete = request.type.workflow.transitions.find(
        (t) => t.fromStepId === step.id && t.action === "COMPLETE"
      );
      if (complete) {
        const systemActor = actor ?? (await this.systemActor());
        await this.applyAction(request.id, "COMPLETE", systemActor);
      }
    }

    return this.loadRequest(requestId);
  }

  async processSla() {
    const now = new Date();
    const open = await this.prisma.request.findMany({
      where: {
        status: { in: ACTIVE_STATUSES },
        dueAt: { not: null },
      },
      include: {
        type: true,
        currentStep: { include: { department: true } },
        requester: true,
      },
    });

    for (const request of open) {
      if (!request.dueAt) continue;
      const remaining = request.dueAt.getTime() - now.getTime();
      const windowMs = (request.currentStep?.slaHours ?? request.type.slaHours) * 60 * 60 * 1000;

      if (remaining <= 0 && !request.slaBreachedAt) {
        await this.escalate(request.id);
        continue;
      }

      if (!request.slaWarnedAt && remaining > 0 && remaining <= windowMs * 0.25) {
        await this.prisma.request.update({
          where: { id: request.id },
          data: { slaWarnedAt: now },
        });
        const targets = [request.assignedOfficerId, request.currentApproverId].filter(Boolean) as string[];
        for (const userId of [...new Set(targets)]) {
          await this.notifications.push({
            userId,
            type: "SLA_WARNING",
            title: `${request.number} is approaching its SLA`,
            body: `${request.type.name} is due ${request.dueAt.toISOString()}.`,
            link: `/app/requests/${request.id}`,
          });
        }
        await this.event(request.id, null, "sla.warning", `SLA warning issued for ${request.currentStep?.name ?? "current step"}`);
      }
    }
  }

  async escalate(requestId: string) {
    const request = await this.loadRequest(requestId);
    const headId = request.currentStep?.department?.headId;
    const admins = await this.prisma.user.findMany({ where: { role: "ADMIN" } });
    const escalateTo = headId
      ? await this.prisma.user.findUnique({ where: { id: headId } })
      : admins[0];

    await this.prisma.request.update({
      where: { id: request.id },
      data: {
        slaBreachedAt: new Date(),
        assignedOfficerId: escalateTo?.id ?? request.assignedOfficerId,
        currentApproverId: escalateTo?.id ?? request.currentApproverId,
      },
    });

    await this.prisma.task.updateMany({
      where: { requestId: request.id, status: "OPEN" },
      data: escalateTo ? { assigneeId: escalateTo.id } : {},
    });

    await this.event(
      request.id,
      null,
      "sla.breached",
      `SLA breached at ${request.currentStep?.name ?? "current step"}${escalateTo ? ` — escalated to ${escalateTo.name}` : ""}`
    );
    await this.audit.record(null, "request.sla_breached", `request:${request.id}`);

    const notifyIds = [...admins.map((a) => a.id), escalateTo?.id, request.requesterId].filter(Boolean) as string[];
    for (const userId of [...new Set(notifyIds)]) {
      await this.notifications.push({
        userId,
        type: "SLA_BREACHED",
        title: `SLA breached on ${request.number}`,
        body: `${request.type.name} exceeded its ${request.currentStep?.name ?? "step"} deadline.`,
        link: `/app/requests/${request.id}`,
      });
    }
  }

  private async completeRequest(requestId: string, actor: User) {
    const request = await this.loadRequest(requestId);
    await this.closeOpenTasks(requestId);
    await this.prisma.request.update({
      where: { id: requestId },
      data: {
        status: "COMPLETED",
        currentStepId: null,
        assignedOfficerId: null,
        currentApproverId: null,
        completedAt: new Date(),
      },
    });
    await this.event(requestId, actor.id, "completed", `${request.number} completed`);
    await this.notifications.push({
      userId: request.requesterId,
      type: "REQUEST_APPROVED",
      title: `${request.number} is complete`,
      body: `${request.type.name} finished the workflow.`,
      link: `/app/requests/${requestId}`,
    });
  }

  private statusForStep(type: WorkflowStepType): RequestStatus {
    switch (type) {
      case "APPROVAL":
        return "PENDING_APPROVAL";
      case "DOCUMENT_GENERATION":
        return "APPROVED";
      case "NOTIFY":
        return "APPROVED";
      default:
        return "UNDER_REVIEW";
    }
  }

  private async resolveAssignee(step: WorkflowStep, requesterId: string) {
    if (step.assigneeType === "SYSTEM") return null;
    if (step.assigneeType === "REQUESTER") {
      return this.prisma.user.findUnique({ where: { id: requesterId } });
    }
    if (step.assigneeType === "DEPARTMENT" && step.departmentId) {
      const dept = await this.prisma.department.findUnique({ where: { id: step.departmentId } });
      if (dept?.headId) return this.prisma.user.findUnique({ where: { id: dept.headId } });
      return this.prisma.user.findFirst({
        where: { departmentId: step.departmentId, role: { in: ["STAFF", "ADMIN"] } },
        orderBy: { createdAt: "asc" },
      });
    }
    if (step.assigneeType === "ROLE" && step.assigneeRole) {
      return this.prisma.user.findFirst({
        where: { role: step.assigneeRole },
        orderBy: { createdAt: "asc" },
      });
    }
    return this.prisma.user.findFirst({ where: { role: "ADMIN" } });
  }

  private async assertCanAct(
    request: Awaited<ReturnType<WorkflowEngine["loadRequest"]>>,
    actor: User
  ) {
    if (actor.role === "ADMIN") return;
    if (request.currentStep?.assigneeType === "SYSTEM") return;
    if (request.currentApproverId === actor.id || request.assignedOfficerId === actor.id) return;
    if (
      actor.role === "STAFF" &&
      request.currentStep?.departmentId &&
      actor.departmentId === request.currentStep.departmentId
    ) {
      return;
    }
    throw new AppError(403, "You are not assigned to this step", "FORBIDDEN");
  }

  private async closeOpenTasks(requestId: string) {
    await this.prisma.task.updateMany({
      where: { requestId, status: "OPEN" },
      data: { status: "CANCELLED" },
    });
  }

  private async event(requestId: string, actorId: string | null, action: string, message: string) {
    await this.prisma.requestEvent.create({
      data: { requestId, actorId, action, message },
    });
  }

  private async generateDocument(requestId: string, number: string, typeName: string, requesterName: string) {
    const body = [
      "NEXORA CAMPUS",
      "Office of University Operations",
      "",
      `Official ${typeName}`,
      `Reference: ${number}`,
      `Issued: ${new Date().toISOString()}`,
      `Student: ${requesterName}`,
      "",
      `This document was generated automatically after all configured workflow steps for ${typeName} were completed.`,
      "",
      "Nexora Campus Workflow Engine",
    ].join("\n");
    const filename = `${number}-${typeName.replace(/\s+/g, "-").toLowerCase()}.txt`;
    const storagePath = await this.storage.save("generated", `${requestId}-${filename}`, Buffer.from(body, "utf8"));
    await this.prisma.attachment.create({
      data: {
        requestId,
        filename,
        mimeType: "text/plain",
        sizeBytes: Buffer.byteLength(body),
        storagePath,
        generated: true,
      },
    });
    await this.event(requestId, null, "document.generated", `Document generation started and completed for ${number}`);
    const request = await this.prisma.request.findUnique({ where: { id: requestId } });
    if (request) {
      await this.notifications.push({
        userId: request.requesterId,
        type: "DOCUMENT_READY",
        title: `Document ready for ${number}`,
        body: `${typeName} document has been generated.`,
        link: `/app/requests/${requestId}`,
      });
    }
  }

  private async systemActor(): Promise<User> {
    const admin = await this.prisma.user.findFirst({ where: { role: "ADMIN" } });
    if (!admin) throw new AppError(500, "No system actor available", "NO_ADMIN");
    return admin;
  }

  async loadRequest(id: string) {
    const request = await this.prisma.request.findUnique({
      where: { id },
      include: {
        type: {
          include: {
            workflow: {
              include: {
                steps: { include: { department: true }, orderBy: { sortOrder: "asc" } },
                transitions: true,
              },
            },
          },
        },
        requester: true,
        department: true,
        assignedOfficer: true,
        currentApprover: true,
        currentStep: { include: { department: true } },
        events: { orderBy: { createdAt: "asc" } },
        tasks: { orderBy: { createdAt: "asc" } },
        approvals: { include: { actor: true }, orderBy: { createdAt: "asc" } },
        attachments: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!request) throw new AppError(404, "Request not found", "NOT_FOUND");
    return request;
  }
}
