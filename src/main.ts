import "reflect-metadata";
import { config } from "dotenv";
import path from "path";
config({ path: path.resolve(process.cwd(), ".env") });
config();
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import { json, urlencoded } from "express";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/http-exception.filter";

async function bootstrap() {
  console.log("Starting Nexora API...");
  const app = await NestFactory.create(AppModule, { cors: false });
  const origin = process.env.CORS_ORIGIN ?? "http://localhost:3000";

  app.use(cookieParser());
  app.use(json({ limit: "2mb" }));
  app.use(urlencoded({ extended: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableCors({
    origin,
    credentials: true,
  });
  app.setGlobalPrefix("api", { exclude: ["health"] });

  const swagger = new DocumentBuilder()
    .setTitle("Nexora Campus API")
    .setDescription(
      "REST API for university requests, configurable workflows, approvals, SLA tracking, assets, and audit."
    )
    .setVersion("1.0.0")
    .addCookieAuth("nexora_session")
    .build();
  SwaggerModule.setup("api/docs", app, SwaggerModule.createDocument(app, swagger));

  const http = app.getHttpAdapter().getInstance();
  http.get("/health", (_req: unknown, res: { json: (v: unknown) => void }) => {
    res.json({ ok: true, service: "nexora-api" });
  });

  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port, "0.0.0.0");
  console.log(`Nexora API http://localhost:${port}`);
  console.log(`API docs   http://localhost:${port}/api/docs`);
}

bootstrap();
