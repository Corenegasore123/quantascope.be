import { getRedis, jobChannel, isRedisEnabled } from "../infrastructure/redis/connection.js";

export interface JobStatusPayload {
  status: string;
  message?: string;
  at: string;
}

export async function publishJobStatus(
  jobId: string,
  payload: JobStatusPayload
): Promise<void> {
  if (!isRedisEnabled()) return;
  const redis = getRedis();
  if (redis.status !== "ready") await redis.connect();
  await redis.publish(jobChannel(jobId), JSON.stringify(payload));
}

export async function subscribeJobStatus(
  jobId: string,
  onMessage: (payload: JobStatusPayload) => void
): Promise<() => Promise<void>> {
  const { getRedisSubscriber } = await import("../infrastructure/redis/connection.js");
  const sub = getRedisSubscriber();
  if (sub.status !== "ready") await sub.connect();

  const channel = jobChannel(jobId);
  const handler = (ch: string, message: string) => {
    if (ch !== channel) return;
    try {
      onMessage(JSON.parse(message) as JobStatusPayload);
    } catch {
      // ignore malformed
    }
  };

  await sub.subscribe(channel);
  sub.on("message", handler);

  return async () => {
    sub.off("message", handler);
    await sub.unsubscribe(channel);
  };
}
