import type { UserRole } from "@prisma/client";
import { requireRole } from "./auth.js";

export const ROLE_COOKIE = "quantscope_role";

export function roleCookieValue(role: UserRole): string {
  return role;
}

export const requireAdmin = requireRole("ADMIN");
