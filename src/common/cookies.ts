import type { CookieOptions, Request, Response } from "express";
import { sessionMaxAgeMs } from "./crypto";

export const SESSION_COOKIE = "nexora_session";
export const ROLE_COOKIE = "nexora_role";
export const CONSENT_COOKIE = "nexora_cookie_consent";

function cookieSameSite(): CookieOptions["sameSite"] {
  const value = process.env.COOKIE_SAME_SITE?.toLowerCase();
  if (value === "strict" || value === "none" || value === "lax") return value;
  return "lax";
}

function cookieSecure(): boolean {
  if (process.env.COOKIE_SECURE === "true") return true;
  if (process.env.COOKIE_SECURE === "false") return false;
  return process.env.NODE_ENV === "production" || cookieSameSite() === "none";
}

function baseOptions(): CookieOptions {
  const opts: CookieOptions = {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: cookieSameSite(),
    maxAge: sessionMaxAgeMs(),
    path: "/",
  };
  if (process.env.COOKIE_DOMAIN) opts.domain = process.env.COOKIE_DOMAIN;
  return opts;
}

export function setAuthCookies(res: Response, token: string, role: string) {
  const opts = baseOptions();
  res.cookie(SESSION_COOKIE, token, opts);
  res.cookie(ROLE_COOKIE, role, { ...opts, httpOnly: false });
}

export function clearAuthCookies(res: Response) {
  const opts: CookieOptions = { path: "/" };
  if (process.env.COOKIE_DOMAIN) opts.domain = process.env.COOKIE_DOMAIN;
  res.clearCookie(SESSION_COOKIE, opts);
  res.clearCookie(ROLE_COOKIE, opts);
}

export function setConsentCookie(res: Response) {
  const days = parseInt(process.env.COOKIE_CONSENT_DAYS ?? "365", 10);
  res.cookie(CONSENT_COOKIE, "accepted", {
    ...baseOptions(),
    maxAge: days * 24 * 60 * 60 * 1000,
  });
}

export function clientMeta(req: Request) {
  return {
    ipAddress: (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.ip,
    userAgent: req.headers["user-agent"],
  };
}
