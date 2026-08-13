import "./config/env.js";
import { Worker } from "bullmq";
import { ensureDatabaseUrl } from "./lib/database-url.js";
import { processCalculationJob } from "./lib/pipeline.js";
import { ANALYSIS_QUEUE_NAME } from "./queues/analysis.queue.js";
import { getRedis, closeRedisConnections, isRedisEnabled } from "./infrastructure/redis/connection.js";

ensureDatabaseUrl();

if (!isRedisEnabled()) {
  console.error("Worker requires Redis. Set REDIS_ENABLED=true and start Redis.");
  process.exit(1);
}

const concurrency = parseInt(process.env.WORKER_CONCURRENCY ?? "2", 10);

const worker = new Worker(
  ANALYSIS_QUEUE_NAME,
  async (job) => {
    const { calculationJobId } = job.data as { calculationJobId: string };
    console.log(`[worker] processing job ${calculationJobId} (attempt ${job.attemptsMade + 1})`);
    await processCalculationJob(calculationJobId);
  },
  {
    connection: getRedis(),
    concurrency,
  }
);

worker.on("completed", (job) => {
  console.log(`[worker] completed ${job.id}`);
});

worker.on("failed", (job, err) => {
  console.error(`[worker] failed ${job?.id}:`, err.message);
});

worker.on("error", (err) => {
  console.error("[worker] error:", err);
});

async function shutdown() {
  console.log("[worker] shutting down…");
  await worker.close();
  await closeRedisConnections();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log(`QuantScope worker listening on queue "${ANALYSIS_QUEUE_NAME}" (concurrency=${concurrency})`);
