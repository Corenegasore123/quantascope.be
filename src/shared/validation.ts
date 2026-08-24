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

export const reservationSchema = z.object({
  customerName: z.string().trim().min(2).max(100),
  guests: z.number().int().min(1).max(20),
  date: z.string(),
  time: z.string(),
  branchId: z.string().uuid(),
  tableId: z.string().uuid().optional(),
  preference: z.string().max(80).optional(),
});

export const orderLineSchema = z.object({
  menuItemId: z.string().uuid(),
  quantity: z.number().int().min(1).max(50),
  notes: z.string().max(200).optional(),
});

export const createOrderSchema = z.object({
  tableId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  lines: z.array(orderLineSchema).min(1),
});

export const payOrderSchema = z.object({
  method: z.enum(["CASH", "CARD", "MOBILE_MONEY"]),
  discount: z.number().int().min(0).optional(),
});

export const wasteSchema = z.object({
  ingredientId: z.string().uuid(),
  quantity: z.number().positive(),
  reason: z.enum(["EXPIRED", "OVERPRODUCTION", "DAMAGED", "PREPARATION_ERROR", "CUSTOMER_RETURN", "UNKNOWN"]),
});

export const feedbackSchema = z.object({
  orderId: z.string().uuid(),
  food: z.number().int().min(1).max(5),
  service: z.number().int().min(1).max(5),
  ambience: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

export const dinerReviewSchema = z.object({
  reservationId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  food: z.number().int().min(1).max(5),
  service: z.number().int().min(1).max(5),
  ambience: z.number().int().min(1).max(5),
  comment: z.string().trim().max(800).optional().or(z.literal("")),
});

export const rejectReviewSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const lookupReservationSchema = z
  .object({
    number: z.string().trim().min(3).max(40),
    email: z.string().trim().email().optional().or(z.literal("")),
    phone: z.string().trim().max(40).optional().or(z.literal("")),
  })
  .refine((v) => Boolean(v.email?.trim() || v.phone?.trim()), {
    message: "Email or phone is required",
  });

export const updateDinerProfileSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: registerSchema.shape.password,
});

export const createOwnerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(40).optional(),
});

export const restaurantProfileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().max(1000).optional(),
  phone: z.string().max(40).optional(),
  email: z.string().email().optional().or(z.literal("")),
  website: z.string().max(200).optional(),
  address: z.string().max(200).optional(),
  city: z.string().max(80).optional(),
  country: z.string().max(80).optional(),
  cuisine: z.string().max(120).optional(),
  logoUrl: z.string().max(500).optional().or(z.literal("")),
  coverUrl: z.string().max(500).optional().or(z.literal("")),
});

export const businessSettingsSchema = z.object({
  currency: z.string().min(2).max(8).optional(),
  timezone: z.string().min(2).max(80).optional(),
  taxRate: z.number().min(0).max(100).optional(),
  openingHours: z
    .array(z.object({ day: z.string(), open: z.string(), close: z.string() }))
    .optional(),
  paymentMethods: z.string().optional(),
});

export const createBranchSchema = z.object({
  name: z.string().trim().min(2).max(80),
  city: z.string().trim().min(2).max(80),
  address: z.string().trim().max(200).optional(),
  code: z.string().trim().max(12).optional(),
});

export const inviteStaffSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email(),
  role: z.enum(["MANAGER", "CASHIER", "WAITER", "CHEF", "KITCHEN", "INVENTORY_MANAGER", "ACCOUNTANT"]),
  branchId: z.string().uuid().optional(),
});

export const publicBookSchema = z.object({
  restaurantId: z.string().min(1),
  branchId: z.string().uuid().optional(),
  date: z.string(),
  time: z.string(),
  guests: z.number().int().min(1).max(20),
  name: z.string().trim().min(2).max(100).optional(),
  email: z.string().trim().email().optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional(),
});

export const customerRegisterSchema = registerSchema.extend({
  phone: z.string().trim().max(40).optional(),
});
