import { createHash, randomBytes } from "node:crypto";

export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function sessionMaxAgeMs(): number {
  const hours = parseInt(process.env.SESSION_MAX_AGE_HOURS ?? "12", 10);
  return Math.max(1, hours) * 60 * 60 * 1000;
}
