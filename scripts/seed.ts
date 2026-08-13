import "dotenv/config";
import { prisma } from "../src/lib/db.js";
import { hashPassword } from "../src/modules/auth/password.js";

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@quantscope.local";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Admin123!";

  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (existing) {
    console.log(`Seed skipped: ${adminEmail} already exists`);
    return;
  }

  const admin = await prisma.user.create({
    data: {
      name: "Platform Admin",
      email: adminEmail,
      passwordHash: await hashPassword(adminPassword),
      role: "ADMIN",
      emailVerifiedAt: new Date(),
    },
  });

  await prisma.project.create({
    data: {
      name: "My Workspace",
      description: "Personal workspace",
      ownerId: admin.id,
    },
  });

  console.log("Seed complete:");
  console.log(`  Admin email: ${adminEmail}`);
  console.log(`  Admin password: ${adminPassword}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
