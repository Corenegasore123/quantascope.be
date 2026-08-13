import type { Request, Response, NextFunction } from "express";

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

export function rateLimit(options: RateLimitOptions) {
  const { windowMs, max, message = "Too many requests, please try again later" } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${clientKey(req)}:${req.path}`;
    const now = Date.now();
    let bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;

    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, max - bucket.count)));
    res.setHeader("X-RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > max) {
      res.status(429).json({ error: message, code: "RATE_LIMITED" });
      return;
    }

    next();
  };
}

/** Stricter limits for auth endpoints — keyed by IP only (shared across auth paths). */
export function authRateLimit(options: RateLimitOptions) {
  const { windowMs, max, message = "Too many authentication attempts" } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const key = `auth:${clientKey(req)}`;
    const now = Date.now();
    let bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;

    if (bucket.count > max) {
      res.status(429).json({ error: message, code: "RATE_LIMITED" });
      return;
    }

    next();
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
    limiter(req, res, next);
  };
}
