import IORedis from "ioredis";

let client: IORedis | null = null;
let subscriber: IORedis | null = null;

export function getRedisUrl(): string {
  return process.env.REDIS_URL ?? "redis://localhost:6379";
}

export function isRedisEnabled(): boolean {
  return process.env.REDIS_ENABLED !== "false";
}

export function getRedis(): IORedis {
  if (!client) {
    client = new IORedis(getRedisUrl(), {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
  }
  return client;
}

export function getRedisSubscriber(): IORedis {
  if (!subscriber) {
    subscriber = new IORedis(getRedisUrl(), {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
  }
  return subscriber;
}

export async function checkRedisConnection(): Promise<boolean> {
  if (!isRedisEnabled()) return false;
  try {
    const redis = getRedis();
    if (redis.status !== "ready") await redis.connect();
    const pong = await redis.ping();
    return pong === "PONG";
  } catch {
    return false;
  }
}

export async function closeRedisConnections(): Promise<void> {
  await Promise.all([
    client?.quit().catch(() => undefined),
    subscriber?.quit().catch(() => undefined),
  ]);
  client = null;
  subscriber = null;
}

export function jobChannel(jobId: string): string {
  return `job:status:${jobId}`;
}
