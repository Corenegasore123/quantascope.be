import type { Request, Response, NextFunction } from "express";
import { checkRedisRateLimit } from "../infrastructure/redis/rate-limit.js";

export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("X-DNS-Prefetch-Control", "off");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
}

interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Periodic cleanup so the in-memory map does not grow without bound. */
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}, 60_000).unref();

function clientKey(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0]?.trim() ?? req.ip ?? "unknown";
  return req.ip ?? "unknown";
}

function applyRateLimitHeaders(res: Response, max: number, remaining: number, resetAt: number) {
  res.setHeader("X-RateLimit-Limit", String(max));
  res.setHeader("X-RateLimit-Remaining", String(remaining));
  res.setHeader("X-RateLimit-Reset", String(Math.ceil(resetAt / 1000)));
}

function memoryRateLimit(key: string, windowMs: number, max: number) {
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }

  bucket.count += 1;

  return {
    allowed: bucket.count <= max,
    remaining: Math.max(0, max - bucket.count),
    resetAt: bucket.resetAt,
  };
}

async function enforceRateLimit(
  req: Request,
  res: Response,
  key: string,
  options: RateLimitOptions
): Promise<boolean> {
  const { windowMs, max, message = "Too many requests, please try again later" } = options;

  const redisResult = await checkRedisRateLimit(key, windowMs, max);
  const result = redisResult ?? memoryRateLimit(key, windowMs, max);

  applyRateLimitHeaders(res, max, result.remaining, result.resetAt);

  if (!result.allowed) {
    res.status(429).json({ error: message, code: "RATE_LIMITED" });
    return false;
  }

  return true;
}

export function rateLimit(options: RateLimitOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const key = `${clientKey(req)}:${req.path}`;
      const allowed = await enforceRateLimit(req, res, key, options);
      if (allowed) next();
    } catch {
      next();
    }
  };
}

/** Stricter limits for auth endpoints — keyed by IP only (shared across auth paths). */
export function authRateLimit(options: RateLimitOptions) {
  const { windowMs, max, message = "Too many authentication attempts" } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const key = `auth:${clientKey(req)}`;
      const allowed = await enforceRateLimit(req, res, key, { windowMs, max, message });
      if (allowed) next();
    } catch {
      next();
    }
  };
}

export function uploadRateLimit() {
  const limiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: parseInt(process.env.UPLOAD_RATE_LIMIT_PER_HOUR ?? "30", 10),
    message: "Upload limit exceeded, please try again later",
  });

  return (req: Request, res: Response, next: NextFunction) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      next();
      return;
    }
    void limiter(req, res, next);
  };
}
