import express from "express";
import cors from "cors";
import { calculationsRouter } from "./routes/calculations.js";
import { imagesRouter } from "./routes/images.js";
import { calculationRulesRouter } from "./routes/calculation-rules.js";

export const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
    credentials: true,
  })
);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "quantscope-api" });
});

app.use("/api/calculations", calculationsRouter);
app.use("/api/images", imagesRouter);
app.use("/api/calculation-rules", calculationRulesRouter);
