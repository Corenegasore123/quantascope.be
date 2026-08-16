import { Router } from "express";
import { calculationsRouter } from "../../routes/calculations.js";
import { projectsRouter } from "../projects/projects.routes.js";

/**
 * Engineer workspace API aliases used by the Next.js frontend.
 * Keeps canonical routes (/api/calculations, /api/projects) while matching UI paths.
 */
export const appRouter = Router();

appRouter.use("/history", calculationsRouter);
appRouter.use("/projects", projectsRouter);
