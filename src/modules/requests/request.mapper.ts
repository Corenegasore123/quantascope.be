import type { RequestStatus } from "@prisma/client";

type UserLite = { id: string; name: string; email: string; role: string } | null | undefined;

function slaFor(dueAt: Date | null, slaHours: number | null, breachedAt: Date | null) {
  if (!dueAt) {
    return { dueAt: null, slaHours, remainingMs: null, breached: Boolean(breachedAt), warning: false };
  }
  const remainingMs = dueAt.getTime() - Date.now();
  const windowMs = (slaHours ?? 48) * 60 * 60 * 1000;
  return {
    dueAt: dueAt.toISOString(),
    slaHours,
    remainingMs,
    breached: Boolean(breachedAt) || remainingMs <= 0,
    warning: remainingMs > 0 && remainingMs <= windowMs * 0.25,
  };
}

export function toRequestDto(request: {
  id: string;
  number: string;
  status: RequestStatus;
  priority: string;
  formData: unknown;
  dueAt: Date | null;
  slaWarnedAt: Date | null;
  slaBreachedAt: Date | null;
  submittedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  type: { id: string; code: string; name: string; slaHours: number; workflow?: { id: string; name: string; steps?: unknown[]; transitions?: unknown[] } };
  requester: UserLite & { studentId?: string | null };
  department?: { id: string; name: string; code: string } | null;
  assignedOfficer?: UserLite;
  currentApprover?: UserLite;
  currentStep?: { id: string; name: string; key: string; type: string; slaHours: number | null } | null;
  events?: { id: string; action: string; message: string; createdAt: Date; actorId: string | null }[];
  tasks?: { id: string; title: string; status: string; kind: string; dueAt: Date | null; assigneeId: string; stepId: string | null }[];
  approvals?: { id: string; decision: string; comment: string | null; createdAt: Date; actor?: UserLite }[];
  attachments?: { id: string; filename: string; mimeType: string; sizeBytes: number; generated: boolean; createdAt: Date }[];
}) {
  return {
    id: request.id,
    number: request.number,
    status: request.status,
    priority: request.priority,
    formData: request.formData,
    submittedAt: request.submittedAt?.toISOString() ?? null,
    completedAt: request.completedAt?.toISOString() ?? null,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
    sla: slaFor(request.dueAt, request.currentStep?.slaHours ?? request.type.slaHours, request.slaBreachedAt),
    type: {
      id: request.type.id,
      code: request.type.code,
      name: request.type.name,
      slaHours: request.type.slaHours,
      workflow: request.type.workflow
        ? {
            id: request.type.workflow.id,
            name: request.type.workflow.name,
            steps: request.type.workflow.steps,
            transitions: request.type.workflow.transitions,
          }
        : undefined,
    },
    requester: request.requester,
    department: request.department ?? null,
    assignedOfficer: request.assignedOfficer ?? null,
    currentApprover: request.currentApprover ?? null,
    currentStep: request.currentStep ?? null,
    events: request.events?.map((e) => ({
      ...e,
      createdAt: e.createdAt.toISOString(),
    })),
    tasks: request.tasks?.map((t) => ({
      ...t,
      dueAt: t.dueAt?.toISOString() ?? null,
    })),
    approvals: request.approvals?.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
    })),
    attachments: request.attachments?.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
    })),
  };
}
