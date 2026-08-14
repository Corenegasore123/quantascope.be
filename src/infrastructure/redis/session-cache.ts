import { getRedis, isRedisEnabled } from "./connection.js";

const SESSION_PREFIX = "session:";

export async function cacheSessionUser(
  tokenHash: string,
  userId: string,
  ttlSeconds: number
): Promise<void> {
  if (!isRedisEnabled() || ttlSeconds <= 0) return;

  try {
    const redis = getRedis();
    if (redis.status !== "ready") await redis.connect();
    await redis.setex(`${SESSION_PREFIX}${tokenHash}`, ttlSeconds, userId);
  } catch {
    // Cache miss is acceptable — DB remains source of truth.
  }
}

export async function getCachedSessionUserId(tokenHash: string): Promise<string | null> {
  if (!isRedisEnabled()) return null;

  try {
    const redis = getRedis();
    if (redis.status !== "ready") await redis.connect();
    return redis.get(`${SESSION_PREFIX}${tokenHash}`);
  } catch {
    return null;
  }
}

export async function invalidateCachedSession(tokenHash: string): Promise<void> {
  if (!isRedisEnabled()) return;

  try {
    const redis = getRedis();
    if (redis.status !== "ready") await redis.connect();
    await redis.del(`${SESSION_PREFIX}${tokenHash}`);
  } catch {
    // Ignore cache invalidation failures.
  }
}
