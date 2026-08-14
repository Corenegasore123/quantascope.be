import type { Request } from "express";
import { CONSENT_COOKIE } from "../lib/cookies.js";
import { AppError } from "../shared/errors.js";

export function hasCookieConsent(req: Request): boolean {
  return req.cookies?.[CONSENT_COOKIE] === "accepted";
}

export function assertCookieConsent(req: Request): void {
  if (!hasCookieConsent(req)) {
    throw new AppError(
      403,
      "Cookie consent is required before signing in or creating an account",
      "COOKIE_CONSENT_REQUIRED"
    );
  }
}
