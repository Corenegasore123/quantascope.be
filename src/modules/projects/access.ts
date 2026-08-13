import type { Project, ProjectMemberRole } from "@prisma/client";
import { prisma } from "../../lib/db.js";
import { AppError } from "../../shared/errors.js";

export type ProjectAccessRole = "OWNER" | ProjectMemberRole;

const ROLE_RANK: Record<ProjectAccessRole, number> = {
  VIEWER: 1,
  EDITOR: 2,
  OWNER: 3,
};

export interface ProjectMembership {
  project: Project;
  role: ProjectAccessRole;
}

export async function getProjectMembership(
  userId: string,
  projectId: string
): Promise<ProjectMembership | null> {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return null;

  if (project.ownerId === userId) {
    return { project, role: "OWNER" };
  }

  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  if (!member) return null;

  return { project, role: member.role };
}

export async function assertProjectAccess(
  userId: string,
  projectId: string,
  minRole: ProjectAccessRole = "VIEWER"
): Promise<ProjectMembership> {
  const membership = await getProjectMembership(userId, projectId);
  if (!membership) {
    throw new AppError(404, "Project not found", "NOT_FOUND");
  }
  if (ROLE_RANK[membership.role] < ROLE_RANK[minRole]) {
    throw new AppError(403, "Insufficient project permissions", "FORBIDDEN");
  }
  return membership;
}

export async function listAccessibleProjectIds(userId: string): Promise<string[]> {
  const [owned, memberOf] = await Promise.all([
    prisma.project.findMany({ where: { ownerId: userId }, select: { id: true } }),
    prisma.projectMember.findMany({ where: { userId }, select: { projectId: true } }),
  ]);
  return [...new Set([...owned.map((p) => p.id), ...memberOf.map((m) => m.projectId)])];
}

export async function accessibleJobsWhere(userId: string) {
  const projectIds = await listAccessibleProjectIds(userId);
  return {
    OR: [{ userId }, ...(projectIds.length ? [{ projectId: { in: projectIds } }] : [])],
  };
}

export function accessibleProjectsWhere(userId: string) {
  return {
    OR: [{ ownerId: userId }, { members: { some: { userId } } }],
  };
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
