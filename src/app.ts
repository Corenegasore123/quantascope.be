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
import { errorHandler } from "./middleware/error.js";

export const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
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
    const { prisma } = await import("./lib/db.js");
    const { checkRedisConnection, isRedisEnabled } = await import(
      "./infrastructure/redis/connection.js"
    );
    const { checkCVServiceHealth } = await import("./modules/vision/vision.service.js");
    await prisma.$queryRaw`SELECT 1`;
    const redis = isRedisEnabled() ? await checkRedisConnection() : null;
    const cv = await checkCVServiceHealth();
    const ready = (redis === null || redis === true) && cv;
    res.status(ready ? 200 : 503).json({
      status: ready ? "ready" : "degraded",
      database: "ok",
      redis: isRedisEnabled() ? (redis ? "ok" : "error") : "disabled",
      queue: isRedisEnabled() ? (redis ? "ok" : "unavailable") : "inline",
      cvService: cv ? "ok" : "error",
    });
  } catch {
    res.status(503).json({ status: "not_ready", database: "error" });
  }
});

app.use("/api/auth", authRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/projects/:id/members", projectMembersRouter);
app.use("/api/projects/:projectId/documents", projectDocumentsRouter);
app.use("/api/documents", documentsRouter);
app.use("/api/calculations", calculationsRouter);
app.use("/api/images", imagesRouter);
app.use("/api/calculation-rules", calculationRulesRouter);

app.use(errorHandler);
