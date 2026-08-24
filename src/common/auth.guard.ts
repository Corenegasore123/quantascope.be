import { CanActivate, ExecutionContext, Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { IS_PUBLIC } from "./decorators";
import { SESSION_COOKIE } from "./cookies";
import { AppError } from "./app-error";
import { AuthService } from "../modules/auth/auth.service";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(AuthService) private readonly auth: AuthService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request & { user?: unknown }>();
    if (req.path.startsWith("/api/docs") || req.path === "/health" || req.path === "/api/health") {
      return true;
    }
    const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
    if (!token) throw new AppError(401, "Authentication required", "UNAUTHENTICATED");

    const user = await this.auth.findUserBySessionToken(token);
    if (!user) throw new AppError(401, "Session expired", "SESSION_EXPIRED");
    req.user = user;
    if (user.mustChangePassword) {
      const path = req.path.split("?")[0];
      const allowed = new Set(["/api/auth/change-password", "/api/auth/logout", "/api/auth/me", "/api/auth/check"]);
      if (!allowed.has(path)) {
        throw new AppError(403, "You must change your temporary password", "MUST_CHANGE_PASSWORD");
      }
    }
    return true;
  }
}
