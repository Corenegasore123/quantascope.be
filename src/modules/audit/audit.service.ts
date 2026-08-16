import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class AuditService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async record(
    userId: string | null | undefined,
    action: string,
    resource?: string,
    metadata?: Prisma.InputJsonValue,
    ipAddress?: string
  ) {
    return this.prisma.auditLog.create({
      data: {
        userId: userId ?? undefined,
        action,
        resource,
        metadata,
        ipAddress,
      },
    });
  }
}
