import { prisma } from "../../lib/db.js";
import { generateSessionToken, hashToken } from "../../shared/crypto.js";
import {
  cacheSessionUser,
  getCachedSessionUserId,
  invalidateCachedSession,
} from "../../infrastructure/redis/session-cache.js";

const SESSION_DAYS = parseInt(process.env.SESSION_MAX_AGE_DAYS ?? "30", 10);

function sessionTtlSeconds(expiresAt: Date): number {
  return Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
}

export async function createSession(
  userId: string,
  meta?: { ipAddress?: string; userAgent?: string }
): Promise<string> {
  const token = generateSessionToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    },
  });

  await cacheSessionUser(tokenHash, userId, sessionTtlSeconds(expiresAt));

  return token;
}

export async function revokeSession(token: string): Promise<void> {
  const tokenHash = hashToken(token);
  await prisma.session.deleteMany({ where: { tokenHash } });
  await invalidateCachedSession(tokenHash);
}

export async function revokeAllUserSessions(userId: string): Promise<void> {
  const sessions = await prisma.session.findMany({
    where: { userId },
    select: { tokenHash: true },
  });
  await prisma.session.deleteMany({ where: { userId } });
  await Promise.all(sessions.map((s) => invalidateCachedSession(s.tokenHash)));
}

export async function revokeAllUserSessionsExcept(
  userId: string,
  keepToken?: string
): Promise<void> {
  const keepHash = keepToken ? hashToken(keepToken) : undefined;

  const sessions = await prisma.session.findMany({
    where: keepHash ? { userId, NOT: { tokenHash: keepHash } } : { userId },
    select: { tokenHash: true },
  });

  await prisma.session.deleteMany({
    where: keepHash ? { userId, NOT: { tokenHash: keepHash } } : { userId },
  });

  await Promise.all(sessions.map((s) => invalidateCachedSession(s.tokenHash)));

  if (keepHash) {
    const keepSession = await prisma.session.findUnique({ where: { tokenHash: keepHash } });
    if (keepSession) {
      await cacheSessionUser(keepHash, userId, sessionTtlSeconds(keepSession.expiresAt));
    }
  }
}

export async function findUserBySessionToken(token: string) {
  const tokenHash = hashToken(token);

  const cachedUserId = await getCachedSessionUserId(tokenHash);
  if (cachedUserId) {
    const cachedUser = await prisma.user.findUnique({ where: { id: cachedUserId } });
    if (cachedUser) return cachedUser;
    await invalidateCachedSession(tokenHash);
  }

  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } });
    await invalidateCachedSession(tokenHash);
    return null;
  }

  await cacheSessionUser(tokenHash, session.userId, sessionTtlSeconds(session.expiresAt));

  return session.user;
}
