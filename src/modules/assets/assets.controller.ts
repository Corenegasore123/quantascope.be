import { Body, Controller, Get, Inject, Param, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { User } from "@prisma/client";
import { CurrentUser, Roles } from "../../common/decorators";
import { PrismaService } from "../../prisma/prisma.service";
import { assetTransitionSchema, createAssetSchema } from "../../shared/validation";
import { AuditService } from "../audit/audit.service";
import { AppError } from "../../common/app-error";

const ALLOWED: Record<string, string[]> = {
  PURCHASED: ["IN_STOCK"],
  IN_STOCK: ["ASSIGNED", "MAINTENANCE", "RETIRED"],
  ASSIGNED: ["TRANSFERRED", "MAINTENANCE", "IN_STOCK", "RETIRED"],
  TRANSFERRED: ["ASSIGNED", "IN_STOCK", "MAINTENANCE"],
  MAINTENANCE: ["IN_STOCK", "RETIRED"],
  RETIRED: [],
};

@ApiTags("assets")
@Controller("assets")
export class AssetsController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService
  ) {}

  @Get()
  list() {
    return this.prisma.asset.findMany({
      include: { department: true, assignee: true, events: { orderBy: { createdAt: "desc" }, take: 8 } },
      orderBy: { tag: "asc" },
    });
  }

  @Roles("ADMIN", "STAFF")
  @Post()
  async create(@CurrentUser() user: User, @Body() body: unknown) {
    const input = createAssetSchema.parse(body);
    const asset = await this.prisma.asset.create({
      data: input,
    });
    await this.prisma.assetEvent.create({
      data: { assetId: asset.id, actorId: user.id, toStatus: asset.status, notes: "Asset registered" },
    });
    await this.audit.record(user.id, "asset.created", `asset:${asset.id}`);
    return asset;
  }

  @Roles("ADMIN", "STAFF")
  @Post(":id/transition")
  async transition(@CurrentUser() user: User, @Param("id") id: string, @Body() body: unknown) {
    const input = assetTransitionSchema.parse(body);
    const asset = await this.prisma.asset.findUnique({ where: { id } });
    if (!asset) throw new AppError(404, "Asset not found", "NOT_FOUND");
    const allowed = ALLOWED[asset.status] ?? [];
    if (!allowed.includes(input.status)) {
      throw new AppError(400, `Cannot move asset from ${asset.status} to ${input.status}`, "INVALID_TRANSITION");
    }
    const updated = await this.prisma.asset.update({
      where: { id },
      data: {
        status: input.status,
        assigneeId: input.assigneeId === undefined ? asset.assigneeId : input.assigneeId,
        departmentId: input.departmentId === undefined ? asset.departmentId : input.departmentId,
        notes: input.notes ?? asset.notes,
      },
    });
    await this.prisma.assetEvent.create({
      data: {
        assetId: id,
        actorId: user.id,
        fromStatus: asset.status,
        toStatus: input.status,
        notes: input.notes,
      },
    });
    await this.audit.record(user.id, "asset.transitioned", `asset:${id}`);
    return updated;
  }
}
