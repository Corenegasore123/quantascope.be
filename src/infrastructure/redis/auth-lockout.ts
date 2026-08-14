import { getRedis, isRedisEnabled } from "./connection.js";
import { AppError } from "../../shared/errors.js";

const FAIL_PREFIX = "auth:fail:";
const LOCK_PREFIX = "auth:lock:";

function failKey(email: string) {
  return `${FAIL_PREFIX}${email.trim().toLowerCase()}`;
}

function lockKey(email: string) {
  return `${LOCK_PREFIX}${email.trim().toLowerCase()}`;
}

export function authLockoutConfig() {
  return {
    maxFailures: parseInt(process.env.AUTH_MAX_FAILURES ?? "5", 10),
    lockoutMs: parseInt(process.env.AUTH_LOCKOUT_MINUTES ?? "15", 10) * 60_000,
  };
}

export async function assertLoginNotLocked(email: string): Promise<void> {
  if (!isRedisEnabled()) return;

  try {
    const redis = getRedis();
    if (redis.status !== "ready") await redis.connect();
    const locked = await redis.get(lockKey(email));
    if (locked) {
      throw new AppError(
        429,
        "Too many failed login attempts. Try again later.",
        "ACCOUNT_LOCKED"
      );
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
  }
}

export async function recordLoginFailure(email: string): Promise<void> {
  if (!isRedisEnabled()) return;

  const { maxFailures, lockoutMs } = authLockoutConfig();

  try {
    const redis = getRedis();
    if (redis.status !== "ready") await redis.connect();
    const key = failKey(email);
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.pexpire(key, lockoutMs);
    }
    if (count >= maxFailures) {
      await redis.set(lockKey(email), "1", "PX", lockoutMs);
    }
  } catch {
    // Lockout tracking is best-effort when Redis is unavailable.
  }
}

export async function clearLoginFailures(email: string): Promise<void> {
  if (!isRedisEnabled()) return;

  try {
    const redis = getRedis();
    if (redis.status !== "ready") await redis.connect();
    await redis.del(failKey(email), lockKey(email));
  } catch {
    // Ignore cleanup failures.
  }
}
