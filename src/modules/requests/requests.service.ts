import { Inject, Injectable } from "@nestjs/common";
import type { User } from "@prisma/client";
import { createRequestSchema, decisionSchema, updateRequestSchema } from "../../shared/validation";
import { AppError } from "../../common/app-error";
import { PrismaService } from "../../prisma/prisma.service";
import { WorkflowEngine } from "../workflows/engine.service";
import { StorageService } from "../../common/storage.service";
import { AuditService } from "../audit/audit.service";
import { toRequestDto } from "./request.mapper";

@Injectable()
export class RequestsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(WorkflowEngine) private readonly engine: WorkflowEngine,
    @Inject(StorageService) private readonly storage: StorageService,
    @Inject(AuditService) private readonly audit: AuditService
  ) {}

  private visibility(user: User) {
    if (user.role === "ADMIN") return {};
    if (user.role === "STAFF") {
      return {
        OR: [
          { assignedOfficerId: user.id },
          { currentApproverId: user.id },
          { departmentId: user.departmentId ?? "__none__" },
          { requesterId: user.id },
          { tasks: { some: { assigneeId: user.id } } },
          { approvals: { some: { actorId: user.id } } },
        ],
      };
    }
    return { requesterId: user.id };
  }

  async list(user: User, status?: string) {
    const requests = await this.prisma.request.findMany({
      where: {
        ...this.visibility(user),
        ...(status ? { status: status as never } : {}),
      },
      include: {
        type: true,
        requester: true,
        currentStep: true,
        currentApprover: true,
        assignedOfficer: true,
        department: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
    });
    return { requests: requests.map(toRequestDto) };
  }

  async get(user: User, id: string) {
    const request = await this.engine.loadRequest(id);
    await this.assertVisible(user, request);
    return { request: toRequestDto(request) };
  }

  async create(user: User, body: unknown) {
    const input = createRequestSchema.parse(body);
    const type = await this.prisma.requestType.findUnique({ where: { id: input.typeId } });
    if (!type?.isActive) throw new AppError(400, "Unknown request type", "INVALID_TYPE");

    const created = await this.prisma.request.create({
      data: {
        number: await this.engine.nextNumber(),
        typeId: type.id,
        requesterId: user.id,
        departmentId: user.departmentId,
        priority: input.priority ?? "NORMAL",
        formData: input.formData as object,
        status: "DRAFT",
      },
    });

    await this.prisma.requestEvent.create({
      data: {
        requestId: created.id,
        actorId: user.id,
        action: "created",
        message: `${user.name} created ${created.number}`,
      },
    });
    await this.audit.record(user.id, "request.created", `request:${created.id}`);

    if (input.submit) {
      await this.engine.submit(created.id, user);
    }
    return this.get(user, created.id);
  }

  async update(user: User, id: string, body: unknown) {
    const input = updateRequestSchema.parse(body);
    const request = await this.engine.loadRequest(id);
    if (request.requesterId !== user.id && user.role !== "ADMIN") {
      throw new AppError(403, "You cannot edit this request", "FORBIDDEN");
    }
    if (request.status !== "DRAFT") {
      throw new AppError(409, "Only drafts can be edited", "INVALID_STATE");
    }
    await this.prisma.request.update({
      where: { id },
      data: {
        priority: input.priority,
        formData: input.formData as object | undefined,
      },
    });
    return this.get(user, id);
  }

  async submit(user: User, id: string) {
    await this.engine.submit(id, user);
    return this.get(user, id);
  }

  async decide(user: User, id: string, action: "APPROVE" | "REJECT" | "COMPLETE" | "CLEAR" | "OUTSTANDING", body: unknown) {
    const input = decisionSchema.parse(body ?? {});
    await this.engine.applyAction(id, action, user, input.comment);
    return this.get(user, id);
  }

  async attach(user: User, id: string, file: Express.Multer.File) {
    const request = await this.engine.loadRequest(id);
    await this.assertVisible(user, request);
    if (request.status === "COMPLETED" || request.status === "CANCELLED") {
      throw new AppError(409, "Cannot attach files to a closed request", "INVALID_STATE");
    }
    const maxMb = parseInt(process.env.MAX_UPLOAD_SIZE_MB ?? "20", 10);
    if (file.size > maxMb * 1024 * 1024) {
      throw new AppError(400, `File exceeds ${maxMb}MB`, "FILE_TOO_LARGE");
    }
    const storagePath = await this.storage.save(
      "uploads",
      `${id}-${Date.now()}-${file.originalname}`,
      file.buffer
    );
    const attachment = await this.prisma.attachment.create({
      data: {
        requestId: id,
        uploadedById: user.id,
        filename: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        storagePath,
      },
    });
    await this.prisma.requestEvent.create({
      data: {
        requestId: id,
        actorId: user.id,
        action: "attachment.added",
        message: `${user.name} attached ${file.originalname}`,
      },
    });
    return { attachment };
  }

  async download(user: User, requestId: string, attachmentId: string) {
    const request = await this.engine.loadRequest(requestId);
    await this.assertVisible(user, request);
    const attachment = request.attachments.find((a) => a.id === attachmentId);
    if (!attachment) throw new AppError(404, "Attachment not found", "NOT_FOUND");
    const data = await this.storage.read(attachment.storagePath);
    return { attachment, data };
  }

  async cancel(user: User, id: string) {
    const request = await this.engine.loadRequest(id);
    if (request.requesterId !== user.id && user.role !== "ADMIN") {
      throw new AppError(403, "You cannot cancel this request", "FORBIDDEN");
    }
    if (["COMPLETED", "REJECTED", "CANCELLED"].includes(request.status)) {
      throw new AppError(409, "Request is already closed", "INVALID_STATE");
    }
    await this.prisma.task.updateMany({ where: { requestId: id, status: "OPEN" }, data: { status: "CANCELLED" } });
    await this.prisma.request.update({
      where: { id },
      data: {
        status: "CANCELLED",
        currentStepId: null,
        completedAt: new Date(),
      },
    });
    await this.prisma.requestEvent.create({
      data: {
        requestId: id,
        actorId: user.id,
        action: "cancelled",
        message: `${user.name} cancelled ${request.number}`,
      },
    });
    return this.get(user, id);
  }

  private async assertVisible(
    user: User,
    request: {
      id: string;
      requesterId: string;
      assignedOfficerId: string | null;
      currentApproverId: string | null;
      departmentId: string | null;
    }
  ) {
    if (user.role === "ADMIN") return;
    if (request.requesterId === user.id) return;
    if (user.role === "STAFF") {
      if (request.assignedOfficerId === user.id || request.currentApproverId === user.id) return;
      if (user.departmentId && request.departmentId === user.departmentId) return;
      const participated = await this.prisma.task.findFirst({
        where: { requestId: request.id, assigneeId: user.id },
      });
      if (participated) return;
      const approved = await this.prisma.approval.findFirst({
        where: { requestId: request.id, actorId: user.id },
      });
      if (approved) return;
    }
    throw new AppError(403, "You cannot view this request", "FORBIDDEN");
  }
}
