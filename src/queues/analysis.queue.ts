import { Queue } from "bullmq";
import { getRedis, isRedisEnabled } from "../infrastructure/redis/connection.js";

export const ANALYSIS_QUEUE_NAME = "analysis";

export interface AnalysisJobData {
  calculationJobId: string;
}

let queue: Queue<AnalysisJobData> | null = null;

export function getAnalysisQueue(): Queue<AnalysisJobData> | null {
  if (!isRedisEnabled()) return null;
  if (!queue) {
    queue = new Queue<AnalysisJobData>(ANALYSIS_QUEUE_NAME, {
      connection: getRedis(),
      defaultJobOptions: {
        attempts: parseInt(process.env.JOB_MAX_ATTEMPTS ?? "3", 10),
        backoff: {
          type: "exponential",
          delay: parseInt(process.env.JOB_BACKOFF_MS ?? "5000", 10),
        },
        removeOnComplete: { count: 200 },
        removeOnFail: { count: 500 },
      },
    });
  }
  return queue;
}

export async function closeAnalysisQueue(): Promise<void> {
  await queue?.close();
  queue = null;
}
