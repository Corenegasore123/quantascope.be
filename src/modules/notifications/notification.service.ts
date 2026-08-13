import type { NotificationType } from "@prisma/client";
import { prisma } from "../../lib/db.js";

interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
  metadata?: Record<string, unknown>;
}

export async function createNotification(input: CreateNotificationInput) {
  return prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link,
      metadata: input.metadata as object | undefined,
    },
  });
}

export async function notifyProjectTeam(
  projectId: string,
  excludeUserId: string | null,
  input: Omit<CreateNotificationInput, "userId">
) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { members: { select: { userId: true } } },
  });
  if (!project) return;

  const recipientIds = new Set<string>([project.ownerId, ...project.members.map((m) => m.userId)]);
  if (excludeUserId) recipientIds.delete(excludeUserId);

  await prisma.notification.createMany({
    data: [...recipientIds].map((userId) => ({
      userId,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link,
      metadata: input.metadata as object | undefined,
    })),
  });
}

export async function notifyCalculationComplete(
  jobId: string,
  actorUserId: string | null,
  filename: string,
  projectId: string | null,
  needsReview: boolean
) {
  const link = `/calculations/${jobId}`;
  const title = needsReview ? "Analysis needs review" : "Analysis completed";
  const body = `${filename} — ${needsReview ? "some measurements have low confidence" : "processing finished"}`;
  const type = needsReview ? "CALCULATION_NEEDS_REVIEW" : "CALCULATION_COMPLETED";

  if (projectId) {
    await notifyProjectTeam(projectId, actorUserId, { type, title, body, link, metadata: { jobId } });
    return;
  }

  if (actorUserId) {
    await createNotification({ userId: actorUserId, type, title, body, link, metadata: { jobId } });
  }
}
