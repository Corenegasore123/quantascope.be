import { Body, Controller, Get, Inject, Post, Req, Res } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import bcrypt from "bcryptjs";
import type { Request, Response } from "express";
import { loginSchema, registerSchema } from "../../shared/validation";
import { CurrentUser, Public } from "../../common/decorators";
import { AppError } from "../../common/app-error";
import { clearAuthCookies, clientMeta, SESSION_COOKIE, setAuthCookies } from "../../common/cookies";
import { PrismaService } from "../../prisma/prisma.service";
import { AuthService } from "./auth.service";
import { AuditService } from "../audit/audit.service";
import type { User } from "@prisma/client";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(AuditService) private readonly audit: AuditService
  ) {}

  @Public()
  @Post("register")
  async register(@Body() body: unknown, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const input = registerSchema.parse(body);
    const email = input.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new AppError(409, "An account with this email already exists", "EMAIL_EXISTS");

    const user = await this.prisma.user.create({
      data: {
        name: input.name.trim(),
        email,
        passwordHash: await bcrypt.hash(input.password, 12),
        role: "STUDENT",
      },
      select: this.auth.publicUserSelect(),
    });

    await this.audit.record(user.id, "user.registered", `user:${user.id}`, undefined, clientMeta(req).ipAddress);
    const token = await this.auth.createSession(user.id, clientMeta(req));
    setAuthCookies(res, token, user.role);
    return { user };
  }

  @Public()
  @Post("login")
  async login(@Body() body: unknown, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const input = loginSchema.parse(body);
    const email = input.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
      throw new AppError(401, "Invalid email or password", "INVALID_CREDENTIALS");
    }

    const publicUser = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: this.auth.publicUserSelect(),
    });
    await this.audit.record(user.id, "user.login", `user:${user.id}`, undefined, clientMeta(req).ipAddress);
    const token = await this.auth.createSession(user.id, clientMeta(req));
    setAuthCookies(res, token, user.role);
    return { user: publicUser };
  }

  @Public()
  @Post("logout")
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
    if (token) await this.auth.revokeSession(token);
    clearAuthCookies(res);
    return { ok: true };
  }

  @Public()
  @Get("check")
  async check(@Req() req: Request) {
    const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
    if (!token) throw new AppError(401, "Authentication required", "UNAUTHENTICATED");
    const user = await this.auth.findUserBySessionToken(token);
    if (!user) throw new AppError(401, "Session expired", "SESSION_EXPIRED");
    return { ok: true };
  }

  @Get("me")
  me(@CurrentUser() user: User) {
    const { passwordHash, ...safe } = user;
    return safe;
  }
}
