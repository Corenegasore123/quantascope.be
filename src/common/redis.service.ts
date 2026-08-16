import { Injectable, OnModuleDestroy } from "@nestjs/common";
import Redis from "ioredis";

@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly enabled = (process.env.REDIS_ENABLED ?? "true") !== "false";
  readonly client: Redis | null;

  constructor() {
    if (!this.enabled) {
      this.client = null;
      return;
    }
    this.client = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
    this.client.connect().catch((err) => {
      console.warn("Redis unavailable:", err.message);
    });
  }

  async onModuleDestroy() {
    if (this.client) await this.client.quit();
  }

  async ping(): Promise<boolean> {
    if (!this.client) return false;
    try {
      return (await this.client.ping()) === "PONG";
    } catch {
      return false;
    }
  }
}
