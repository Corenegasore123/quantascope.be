import "dotenv/config";
import { prisma } from "../src/lib/db.js";
import { hashPassword } from "../src/modules/auth/password.js";

const DEMO_USERS = [
  {
    name: "Platform Admin",
    email: process.env.SEED_ADMIN_EMAIL ?? "admin@quantscope.local",
    password: process.env.SEED_ADMIN_PASSWORD ?? "Admin123!",
    role: "ADMIN" as const,
  },
  {
    name: "Alex Engineer",
    email: "engineer@quantscope.local",
    password: "Demo123!",
    role: "USER" as const,
  },
  {
    name: "Sam Viewer",
    email: "viewer@quantscope.local",
    password: "Demo123!",
    role: "USER" as const,
  },
];

async function upsertUser(
  name: string,
  email: string,
  password: string,
  role: "USER" | "ADMIN"
) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;

  return prisma.user.create({
    data: {
      name,
      email,
      passwordHash: await hashPassword(password),
      role,
      emailVerifiedAt: new Date(),
    },
  });
}

async function ensureProject(ownerId: string, name: string, description: string) {
  const existing = await prisma.project.findFirst({
    where: { ownerId, name },
  });
  if (existing) return existing;

  return prisma.project.create({
    data: { name, description, ownerId },
  });
}

async function ensureMember(
  projectId: string,
  userId: string,
  role: "EDITOR" | "VIEWER",
  invitedById: string
) {
  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId, userId } },
    create: { projectId, userId, role, invitedById },
    update: { role },
  });
}

async function ensureNotification(
  userId: string,
  type: "PROJECT_INVITE" | "CALCULATION_COMPLETED" | "CALCULATION_NEEDS_REVIEW" | "MEMBER_ADDED",
  title: string,
  body: string,
  link?: string
) {
  const existing = await prisma.notification.findFirst({
    where: { userId, title },
  });
  if (existing) return existing;

  return prisma.notification.create({
    data: { userId, type, title, body, link },
  });
}

async function ensureAuditLog(
  userId: string,
  action: string,
  resource: string,
  metadata: object
) {
  const existing = await prisma.auditLog.findFirst({
    where: { userId, action, resource },
  });
  if (existing) return existing;

  return prisma.auditLog.create({
    data: { userId, action, resource, metadata },
  });
}

async function main() {
  const [admin, engineer, viewer] = await Promise.all(
    DEMO_USERS.map((u) => upsertUser(u.name, u.email, u.password, u.role))
  );

  const adminWorkspace = await ensureProject(
    admin.id,
    "My Workspace",
    "Personal workspace for platform administration and demos."
  );
  const highwayProject = await ensureProject(
    engineer.id,
    "Highway Cut-Fill Study",
    "Earthwork quantities for the north corridor widening."
  );
  const gradingProject = await ensureProject(
    engineer.id,
    "Site Grading Phase 2",
    "Cut, fill, and net export volumes for the staging area."
  );

  await ensureMember(highwayProject.id, admin.id, "EDITOR", engineer.id);
  await ensureMember(highwayProject.id, viewer.id, "VIEWER", engineer.id);
  await ensureMember(adminWorkspace.id, engineer.id, "EDITOR", admin.id);

  await ensureNotification(
    admin.id,
    "MEMBER_ADDED",
    "Added to Highway Cut-Fill Study",
    "Alex Engineer invited you as an editor.",
    `/projects/${highwayProject.id}` 
  );
  await ensureNotification(
    engineer.id,
    "CALCULATION_NEEDS_REVIEW",
    "Review recommended",
    "Upload a diagram via Calculator to run your first analysis.",
    "/calculator"
  );
  await ensureNotification(
    viewer.id,
    "PROJECT_INVITE",
    "Invited to Highway Cut-Fill Study",
    "You have viewer access to shared project documents.",
    `/projects/${highwayProject.id}`
  );

  await ensureAuditLog(admin.id, "seed.demo", "platform", { source: "scripts/seed.ts" });
  await ensureAuditLog(engineer.id, "project.create", highwayProject.id, {
    name: highwayProject.name,
  });

  console.log("Seed complete.\n");
  console.log("Demo credentials:");
  for (const u of DEMO_USERS) {
    console.log(`  ${u.role.padEnd(5)} ${u.email} / ${u.password}`);
  }
  console.log("\nProjects:");
  console.log(`  ${adminWorkspace.name} (admin)`);
  console.log(`  ${highwayProject.name} (engineer + admin editor + viewer)`);
  console.log(`  ${gradingProject.name} (engineer)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
