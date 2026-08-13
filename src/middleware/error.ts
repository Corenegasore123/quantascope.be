import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { isAppError } from "../shared/errors.js";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: err.errors.map((e) => e.message).join("; "),
      code: "VALIDATION_ERROR",
    });
    return;
  }

  if (isAppError(err)) {
    res.status(err.statusCode).json({ error: err.message, code: err.code });
    return;
  }

  console.error("[api] unhandled error", err);
  res.status(500).json({ error: "Internal server error" });
}
