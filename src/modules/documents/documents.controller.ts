import { Controller, Get, Inject } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { User } from "@prisma/client";
import { CurrentUser } from "../../common/decorators";
import { PrismaService } from "../../prisma/prisma.service";

@ApiTags("documents")
@Controller("documents")
export class DocumentsController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get()
  mine(@CurrentUser() user: User) {
    const where = user.role === "ADMIN" ? {} : { request: { requesterId: user.id } };
    return this.prisma.attachment.findMany({
      where,
      include: { request: { select: { id: true, number: true, type: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }
}
