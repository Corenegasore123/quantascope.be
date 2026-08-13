import { prisma } from "../../lib/db.js";
import { AppError } from "../../shared/errors.js";
import { hashPassword, verifyPassword } from "./password.js";
import { createSession, revokeSession } from "./session.service.js";

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

const PUBLIC_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  profileImage: true,
  timezone: true,
  language: true,
  emailVerifiedAt: true,
  createdAt: true,
} as const;

export async function registerUser(
  input: RegisterInput,
  meta?: { ipAddress?: string; userAgent?: string }
) {
  const email = input.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError(409, "An account with this email already exists", "EMAIL_EXISTS");
  }

  if (input.password.length < 8) {
    throw new AppError(400, "Password must be at least 8 characters", "WEAK_PASSWORD");
  }

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      name: input.name.trim(),
      email,
      passwordHash,
    },
    select: PUBLIC_USER_SELECT,
  });

  // Personal default project
  await prisma.project.create({
    data: {
      name: "My Workspace",
      description: "Personal workspace",
      ownerId: user.id,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "user.registered",
      resource: `user:${user.id}`,
      ipAddress: meta?.ipAddress,
    },
  });

  const token = await createSession(user.id, meta);
  return { user, token };
}

export async function loginUser(
  input: LoginInput,
  meta?: { ipAddress?: string; userAgent?: string }
) {
  const email = input.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new AppError(401, "Invalid email or password", "INVALID_CREDENTIALS");
  }

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) {
    throw new AppError(401, "Invalid email or password", "INVALID_CREDENTIALS");
  }

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "user.login",
      resource: `user:${user.id}`,
      ipAddress: meta?.ipAddress,
    },
  });

  const token = await createSession(user.id, meta);
  const { passwordHash: _, ...publicUser } = user;
  return { user: publicUser, token };
}

export async function logoutUser(token: string, userId?: string) {
  await revokeSession(token);
  if (userId) {
    await prisma.auditLog.create({
      data: { userId, action: "user.logout", resource: `user:${userId}` },
    });
  }
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, "User not found");

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) throw new AppError(401, "Current password is incorrect", "INVALID_PASSWORD");

  if (newPassword.length < 8) {
    throw new AppError(400, "Password must be at least 8 characters", "WEAK_PASSWORD");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(newPassword) },
  });

  await prisma.auditLog.create({
    data: { userId, action: "user.password_changed", resource: `user:${userId}` },
  });
}

export { PUBLIC_USER_SELECT };
