export const USER_ROLES = ["STUDENT", "STAFF", "ADMIN"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const REQUEST_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "COMPLETED",
  "CANCELLED",
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const REQUEST_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export type RequestPriority = (typeof REQUEST_PRIORITIES)[number];

export const WORKFLOW_STEP_TYPES = [
  "APPROVAL",
  "TASK",
  "CONDITION",
  "DOCUMENT_GENERATION",
  "NOTIFY",
] as const;
export type WorkflowStepType = (typeof WORKFLOW_STEP_TYPES)[number];

export const STEP_ASSIGNEE_TYPES = ["DEPARTMENT", "ROLE", "REQUESTER", "SYSTEM"] as const;
export type StepAssigneeType = (typeof STEP_ASSIGNEE_TYPES)[number];

export const TRANSITION_ACTIONS = [
  "START",
  "APPROVE",
  "REJECT",
  "COMPLETE",
  "CLEAR",
  "OUTSTANDING",
  "ESCALATE",
] as const;
export type TransitionAction = (typeof TRANSITION_ACTIONS)[number];

export const TASK_STATUSES = ["OPEN", "COMPLETED", "CANCELLED"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_KINDS = ["APPROVAL", "ACTION"] as const;
export type TaskKind = (typeof TASK_KINDS)[number];

export const ASSET_STATUSES = [
  "PURCHASED",
  "IN_STOCK",
  "ASSIGNED",
  "TRANSFERRED",
  "MAINTENANCE",
  "RETIRED",
] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];

export const NOTIFICATION_TYPES = [
  "REQUEST_SUBMITTED",
  "APPROVAL_ASSIGNED",
  "REQUEST_APPROVED",
  "REQUEST_REJECTED",
  "SLA_WARNING",
  "SLA_BREACHED",
  "TASK_ASSIGNED",
  "DOCUMENT_READY",
  "ESCALATED",
  "GENERIC",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  departmentId: string | null;
  studentId: string | null;
  staffTitle: string | null;
  profileImage: string | null;
  timezone: string;
  language: string;
  createdAt: string;
};

export type SlaState = {
  dueAt: string | null;
  slaHours: number | null;
  remainingMs: number | null;
  breached: boolean;
  warning: boolean;
};
