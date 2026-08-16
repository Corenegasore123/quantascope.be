import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(200),
  password: z
    .string()
    .min(8)
    .max(128)
    .refine((v) => /[a-z]/.test(v) && /[A-Z]/.test(v), "Include upper and lower case letters")
    .refine((v) => /\d/.test(v), "Include at least one number"),
});

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export const createRequestSchema = z.object({
  typeId: z.string().uuid(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  formData: z.record(z.unknown()).default({}),
  submit: z.boolean().optional(),
});

export const updateRequestSchema = z.object({
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  formData: z.record(z.unknown()).optional(),
});

export const decisionSchema = z.object({
  comment: z.string().trim().max(2000).optional(),
});

export const createWorkflowSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional(),
});

export const upsertStepSchema = z.object({
  key: z.string().trim().min(2).max(80).regex(/^[a-z0-9_]+$/),
  name: z.string().trim().min(2).max(120),
  type: z.enum(["APPROVAL", "TASK", "CONDITION", "DOCUMENT_GENERATION", "NOTIFY"]),
  assigneeType: z.enum(["DEPARTMENT", "ROLE", "REQUESTER", "SYSTEM"]),
  departmentId: z.string().uuid().nullable().optional(),
  assigneeRole: z.enum(["STUDENT", "STAFF", "ADMIN"]).nullable().optional(),
  slaHours: z.number().int().positive().nullable().optional(),
  sortOrder: z.number().int().min(0),
});

export const upsertTransitionSchema = z.object({
  fromStepId: z.string().uuid().nullable(),
  toStepId: z.string().uuid().nullable(),
  action: z.enum(["START", "APPROVE", "REJECT", "COMPLETE", "CLEAR", "OUTSTANDING", "ESCALATE"]),
  toStatus: z
    .enum([
      "DRAFT",
      "SUBMITTED",
      "UNDER_REVIEW",
      "PENDING_APPROVAL",
      "APPROVED",
      "REJECTED",
      "COMPLETED",
      "CANCELLED",
    ])
    .nullable()
    .optional(),
});

export const createRequestTypeSchema = z.object({
  code: z.string().trim().min(2).max(40),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional(),
  workflowId: z.string().uuid(),
  slaHours: z.number().int().positive().default(48),
  formSchema: z.unknown().optional(),
});

export const createDepartmentSchema = z.object({
  code: z.string().trim().min(2).max(20),
  name: z.string().trim().min(2).max(120),
  headId: z.string().uuid().nullable().optional(),
});

export const createUserSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
  role: z.enum(["STUDENT", "STAFF", "ADMIN"]),
  departmentId: z.string().uuid().nullable().optional(),
  studentId: z.string().trim().max(40).nullable().optional(),
  staffTitle: z.string().trim().max(80).nullable().optional(),
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  role: z.enum(["STUDENT", "STAFF", "ADMIN"]).optional(),
  departmentId: z.string().uuid().nullable().optional(),
  studentId: z.string().trim().max(40).nullable().optional(),
  staffTitle: z.string().trim().max(80).nullable().optional(),
  timezone: z.string().max(80).optional(),
  language: z.string().max(20).optional(),
});

export const createAssetSchema = z.object({
  tag: z.string().trim().min(2).max(40),
  name: z.string().trim().min(2).max(120),
  category: z.string().trim().min(2).max(80),
  status: z
    .enum(["PURCHASED", "IN_STOCK", "ASSIGNED", "TRANSFERRED", "MAINTENANCE", "RETIRED"])
    .optional(),
  departmentId: z.string().uuid().nullable().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const assetTransitionSchema = z.object({
  status: z.enum(["PURCHASED", "IN_STOCK", "ASSIGNED", "TRANSFERRED", "MAINTENANCE", "RETIRED"]),
  assigneeId: z.string().uuid().nullable().optional(),
  departmentId: z.string().uuid().nullable().optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const createTaskNoteSchema = z.object({
  comment: z.string().trim().min(1).max(2000),
});

export const assistantAskSchema = z.object({
  question: z.string().trim().min(3).max(500),
});

export const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(120),
});
