import { prisma } from "../../lib/db.js";
import { AppError } from "../../shared/errors.js";

export async function assertProjectAccess(userId: string, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerId: userId },
  });
  if (!project) throw new AppError(404, "Project not found", "NOT_FOUND");
  return project;
}

export async function getDefaultProjectId(userId: string): Promise<string> {
  let project = await prisma.project.findFirst({
    where: { ownerId: userId },
    orderBy: { createdAt: "asc" },
  });
  if (!project) {
    project = await prisma.project.create({
      data: {
        name: "My Workspace",
        description: "Personal workspace",
        ownerId: userId,
      },
    });
  }
  return project.id;
}
