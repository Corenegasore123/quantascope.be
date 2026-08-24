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
    this.client = new Redis(process.env.REDIS_URL ?? "redis://127.0.0.1:6380", {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      enableOfflineQueue: false,
      retryStrategy(times) {
        if (times > 8) return null;
        return Math.min(times * 200, 2000);
      },
    });
    this.client.on("error", (err) => {
      if ((this.client?.listenerCount("error") ?? 0) > 1) return;
      console.warn("Redis unavailable:", err.message);
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
