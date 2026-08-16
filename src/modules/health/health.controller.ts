import { Controller, Get, Inject } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators";
import { PrismaService } from "../../prisma/prisma.service";
import { RedisService } from "../../common/redis.service";

@ApiTags("health")
@Controller()
export class HealthController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RedisService) private readonly redis: RedisService
  ) {}

  @Public()
  @Get("health")
  health() {
    return { ok: true, service: "nexora-api" };
  }

  @Public()
  @Get("ready")
  async ready() {
    let database = false;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      database = true;
    } catch {
      database = false;
    }
    const redis = await this.redis.ping();
    return { ok: database, database, redis };
  }
}
