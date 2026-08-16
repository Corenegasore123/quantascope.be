import { Body, Controller, Get, Inject, Param, Patch, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import bcrypt from "bcryptjs";
import type { User } from "@prisma/client";
import { CurrentUser, Roles } from "../../common/decorators";
import { PrismaService } from "../../prisma/prisma.service";
import { createUserSchema, updateUserSchema } from "../../shared/validation";
import { AuthService } from "../auth/auth.service";
import { AuditService } from "../audit/audit.service";
import { AppError } from "../../common/app-error";

@ApiTags("users")
@Controller("users")
export class UsersController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(AuditService) private readonly audit: AuditService
  ) {}

  @Roles("ADMIN", "STAFF")
  @Get()
  list() {
    return this.prisma.user.findMany({
      select: { ...this.auth.publicUserSelect(), department: true },
      orderBy: { name: "asc" },
    });
  }

  @Roles("ADMIN")
  @Post()
  async create(@CurrentUser() actor: User, @Body() body: unknown) {
    const input = createUserSchema.parse(body);
    const email = input.email.toLowerCase();
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) throw new AppError(409, "Email already in use", "EMAIL_EXISTS");
    const user = await this.prisma.user.create({
      data: {
        ...input,
        email,
        passwordHash: await bcrypt.hash(input.password, 12),
      },
      select: this.auth.publicUserSelect(),
    });
    await this.audit.record(actor.id, "user.created", `user:${user.id}`);
    return user;
  }

  @Patch("me")
  async updateMe(@CurrentUser() user: User, @Body() body: unknown) {
    const input = updateUserSchema.parse(body);
    const { role, departmentId, ...safe } = input;
    return this.prisma.user.update({
      where: { id: user.id },
      data: safe,
      select: this.auth.publicUserSelect(),
    });
  }

  @Roles("ADMIN")
  @Patch(":id")
  async update(@CurrentUser() actor: User, @Param("id") id: string, @Body() body: unknown) {
    const input = updateUserSchema.parse(body);
    const user = await this.prisma.user.update({
      where: { id },
      data: input,
      select: this.auth.publicUserSelect(),
    });
    await this.audit.record(actor.id, "user.updated", `user:${id}`);
    return user;
  }
}
