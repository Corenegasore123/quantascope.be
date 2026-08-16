import { getRedis, isRedisEnabled } from "./connection.js";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export async function checkRedisRateLimit(
  key: string,
  windowMs: number,
  max: number
): Promise<RateLimitResult | null> {
  if (!isRedisEnabled()) return null;

  try {
    const redis = getRedis();
    if (redis.status !== "ready") await redis.connect();

    const bucketKey = `ratelimit:${key}`;
    const count = await redis.incr(bucketKey);
    if (count === 1) {
      await redis.pexpire(bucketKey, windowMs);
    }

    const ttl = await redis.pttl(bucketKey);
    const resetAt = Date.now() + (ttl > 0 ? ttl : windowMs);

    return {
      allowed: count <= max,
      remaining: Math.max(0, max - count),
      resetAt,
    };
  } catch {
    return null;
  }
}
