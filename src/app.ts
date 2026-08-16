import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { calculationsRouter } from "./routes/calculations.js";
import { imagesRouter } from "./routes/images.js";
import { calculationRulesRouter } from "./routes/calculation-rules.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { projectsRouter } from "./modules/projects/projects.routes.js";
import { projectDocumentsRouter } from "./modules/documents/project-documents.routes.js";
import { documentsRouter } from "./modules/documents/documents.routes.js";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes.js";
import { notificationsRouter } from "./modules/notifications/notifications.routes.js";
import { projectMembersRouter } from "./modules/projects/members.routes.js";
import { projectCollaborationRouter } from "./modules/projects/collaboration.routes.js";
import { adminRouter } from "./modules/admin/admin.routes.js";
import { appRouter } from "./modules/app/app.routes.js";
import { consentRouter } from "./modules/consent/consent.routes.js";
import { errorHandler } from "./middleware/error.js";
import { requireAuth } from "./middleware/auth.js";
import {
  securityHeaders,
  rateLimit,
  authRateLimit,
  uploadRateLimit,
} from "./middleware/security.js";

export const app = express();

app.set("trust proxy", 1);

function corsOrigins(): string | string[] {
  const raw = process.env.CORS_ORIGIN ?? "http://localhost:3000";
  const origins = raw.split(",").map((value) => value.trim()).filter(Boolean);
  return origins.length === 1 ? origins[0]! : origins;
}

app.use(securityHeaders);
app.use(
  rateLimit({
    windowMs: 60_000,
    max: parseInt(process.env.GLOBAL_RATE_LIMIT_PER_MIN ?? "120", 10),
  })
);
app.use(
  cors({
    origin: corsOrigins(),
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "quantscope-api" });
});

app.get("/api/ready", async (_req, res) => {
  try {
    const { getSystemHealth } = await import("./lib/system-health.js");
    const health = await getSystemHealth();
    res.status(health.status === "ready" ? 200 : 503).json(health);
  } catch {
    res.status(503).json({ status: "not_ready", database: "error" });
  }
});

// Cookie consent (must be reachable before auth cookies are set)
app.use(
  "/api/consent",
  rateLimit({
    windowMs: 60_000,
    max: parseInt(process.env.CONSENT_RATE_LIMIT_PER_MIN ?? "20", 10),
    message: "Too many consent requests, please try again later",
  }),
  consentRouter
);

// Lightweight session validation for frontend route guards
app.get(
  "/api/auth/check",
  rateLimit({
    windowMs: 60_000,
    max: parseInt(process.env.AUTH_CHECK_RATE_LIMIT_PER_MIN ?? "60", 10),
    message: "Too many session checks, please try again later",
  }),
  requireAuth,
  (req, res) => {
    res.json({ ok: true, userId: req.user!.id });
  }
);

app.use(
  "/api/auth",
  authRateLimit({
    windowMs: 15 * 60_000,
    max: parseInt(process.env.AUTH_RATE_LIMIT_PER_15MIN ?? "20", 10),
  }),
  authRouter
);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/projects/:projectId/members", projectMembersRouter);
app.use("/api/projects/:projectId/collaboration", projectCollaborationRouter);
app.use("/api/projects/:projectId/documents", uploadRateLimit(), projectDocumentsRouter);
app.use("/api/documents", documentsRouter);
app.use("/api/calculations", uploadRateLimit(), calculationsRouter);
app.use("/api/images", imagesRouter);
app.use("/api/calculation-rules", calculationRulesRouter);
// Frontend workspace paths (/api/app/history, /api/app/projects/.../report)
app.use("/api/app", appRouter);
// Platform admin only — engineer workspace routes above must stay user-scoped.
app.use("/api/admin", adminRouter);

app.use(errorHandler);
