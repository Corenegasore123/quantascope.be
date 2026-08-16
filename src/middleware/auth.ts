import type { Request, Response, NextFunction } from "express";
import type { User, UserRole } from "@prisma/client";
import { findUserBySessionToken } from "../modules/auth/session.service.js";
import { AppError } from "../shared/errors.js";

export const SESSION_COOKIE = "quantscope_session";

declare global {
  namespace Express {
    interface Request {
      user?: User;
      sessionToken?: string;
    }
  }
}

function readSessionToken(req: Request): string | undefined {
  const cookie = req.cookies?.[SESSION_COOKIE];
  if (typeof cookie === "string" && cookie.length > 0) return cookie;
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7);
  return undefined;
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = readSessionToken(req);
    if (token) {
      const user = await findUserBySessionToken(token);
      if (user) {
        req.user = user;
        req.sessionToken = token;
      }
    }
    next();
  } catch (error) {
    next(error);
  }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = readSessionToken(req);
    if (!token) {
      throw new AppError(401, "Authentication required", "UNAUTHENTICATED");
    }
    const user = await findUserBySessionToken(token);
    if (!user) {
      throw new AppError(401, "Session expired or invalid", "SESSION_INVALID");
    }
    req.user = user;
    req.sessionToken = token;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      next(new AppError(401, "Authentication required", "UNAUTHENTICATED"));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new AppError(403, "Insufficient permissions", "FORBIDDEN"));
      return;
    }
    next();
  };
}

export function clientMeta(req: Request) {
  return {
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  };
}
