import "./config/env.js";
import { ensureDatabaseUrl } from "./lib/database-url.js";
import { app } from "./app.js";
import { checkRedisConnection, closeRedisConnections, isRedisEnabled } from "./infrastructure/redis/connection.js";
import { closeAnalysisQueue } from "./queues/analysis.queue.js";

ensureDatabaseUrl();

const PORT = parseInt(process.env.API_PORT ?? "4000", 10);

async function verifyDependencies() {
  if (!isRedisEnabled()) {
    console.warn("[startup] REDIS_ENABLED=false — jobs run inline; rate limits use in-memory fallback");
    return;
  }

  const ok = await checkRedisConnection();
  if (!ok) {
    console.error("[startup] Redis is required but unreachable at", process.env.REDIS_URL ?? "redis://localhost:6379");
    console.error("[startup] Start Redis with: docker compose up -d redis");
    process.exit(1);
  }

  console.log("[startup] Redis connected");
}

async function shutdown(signal: string) {
  console.log(`[shutdown] ${signal} received — closing connections`);
  await Promise.allSettled([closeAnalysisQueue(), closeRedisConnections()]);
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

await verifyDependencies();

app.listen(PORT, () => {
  console.log(`QuantScope API listening on http://localhost:${PORT}`);
});
