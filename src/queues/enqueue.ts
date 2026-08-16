import { getAnalysisQueue } from "./analysis.queue.js";
import { prisma } from "../lib/db.js";
import { publishJobStatus } from "./job-events.js";

export async function enqueueAnalysisJob(calculationJobId: string): Promise<void> {
  const queue = getAnalysisQueue();

  if (queue) {
    await prisma.calculationJob.update({
      where: { id: calculationJobId },
      data: { status: "QUEUED" },
    });
    await publishJobStatus(calculationJobId, {
      status: "QUEUED",
      at: new Date().toISOString(),
    });

    await queue.add(
      "process",
      { calculationJobId },
      {
        jobId: calculationJobId,
        removeOnComplete: true,
        removeOnFail: false,
      }
    );
    return;
  }

  // Fallback when Redis is disabled — process inline (dev without Redis)
  const { processCalculationJob } = await import("../lib/pipeline.js");
  processCalculationJob(calculationJobId).catch(console.error);
}
