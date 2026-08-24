export const USER_ROLES = [
  "PLATFORM_ADMIN",
  "OWNER",
  "ADMIN",
  "MANAGER",
  "CASHIER",
  "WAITER",
  "CHEF",
  "KITCHEN",
  "INVENTORY_MANAGER",
  "ACCOUNTANT",
  "CUSTOMER",
] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const RESTAURANT_STAFF_ROLES = [
  "OWNER",
  "ADMIN",
  "MANAGER",
  "CASHIER",
  "WAITER",
  "CHEF",
  "KITCHEN",
  "INVENTORY_MANAGER",
  "ACCOUNTANT",
] as const;

export const INVITABLE_STAFF_ROLES = [
  "MANAGER",
  "CASHIER",
  "WAITER",
  "CHEF",
  "KITCHEN",
  "INVENTORY_MANAGER",
  "ACCOUNTANT",
] as const;

export const DEFAULT_OPENING_HOURS = [
  { day: "Monday", open: "08:00", close: "22:00" },
  { day: "Tuesday", open: "08:00", close: "22:00" },
  { day: "Wednesday", open: "08:00", close: "22:00" },
  { day: "Thursday", open: "08:00", close: "22:00" },
  { day: "Friday", open: "08:00", close: "22:00" },
  { day: "Saturday", open: "08:00", close: "22:00" },
  { day: "Sunday", open: "10:00", close: "20:00" },
];

export function homePath(user: { role: string; mustChangePassword?: boolean; restaurantId?: string | null }) {
  if (user.mustChangePassword) return "/change-password";
  if (user.role === "PLATFORM_ADMIN") return "/platform-admin";
  if (user.role === "CUSTOMER") return "/account";
  if (user.role === "OWNER" && !user.restaurantId) return "/onboarding";
  return "/app";
}
