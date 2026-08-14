import type { CookieOptions, Response } from "express";
import { SESSION_COOKIE } from "../middleware/auth.js";
import { ROLE_COOKIE } from "../middleware/roles.js";
import { sessionMaxAgeMs } from "./session-config.js";

export const CONSENT_COOKIE = "quantscope_cookie_consent";

const CONSENT_DAYS = parseInt(process.env.COOKIE_CONSENT_DAYS ?? "365", 10);

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

export function authCookieOptions(): CookieOptions {
  const sameSite = cookieSameSite();
  const opts: CookieOptions = {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite,
    maxAge: sessionMaxAgeMs(),
    path: "/",
  };

  if (process.env.COOKIE_DOMAIN) {
    opts.domain = process.env.COOKIE_DOMAIN;
  }

  return opts;
}

export function clearAuthCookieOptions(): CookieOptions {
  const opts: CookieOptions = { path: "/" };
  if (process.env.COOKIE_DOMAIN) {
    opts.domain = process.env.COOKIE_DOMAIN;
  }
  return opts;
}

export function setSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE, token, authCookieOptions());
}

export function setRoleCookie(res: Response, role: string) {
  res.cookie(ROLE_COOKIE, role, authCookieOptions());
}

export function clearAuthCookies(res: Response) {
  const opts = clearAuthCookieOptions();
  res.clearCookie(SESSION_COOKIE, opts);
  res.clearCookie(ROLE_COOKIE, opts);
}

export function consentCookieOptions(): CookieOptions {
  const sameSite = cookieSameSite();
  const opts: CookieOptions = {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite,
    maxAge: CONSENT_DAYS * 24 * 60 * 60 * 1000,
    path: "/",
  };

  if (process.env.COOKIE_DOMAIN) {
    opts.domain = process.env.COOKIE_DOMAIN;
  }

  return opts;
}

export function setConsentCookie(res: Response) {
  res.cookie(CONSENT_COOKIE, "accepted", consentCookieOptions());
}

export function clearConsentCookie(res: Response) {
  const opts = clearAuthCookieOptions();
  res.clearCookie(CONSENT_COOKIE, opts);
}
