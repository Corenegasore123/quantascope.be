import { CanActivate, ExecutionContext, Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { UserRole } from "../shared/types";
import type { User } from "@prisma/client";
import { ROLES_KEY } from "./decorators";
import { AppError } from "./app-error";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) return true;
    const user = context.switchToHttp().getRequest<{ user?: User }>().user;
    if (!user) throw new AppError(401, "Authentication required", "UNAUTHENTICATED");
    if (!roles.includes(user.role as UserRole)) {
      throw new AppError(403, "You do not have access to this resource", "FORBIDDEN");
    }
    return true;
  }
}
