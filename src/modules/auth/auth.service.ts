import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { generateSessionToken, hashToken, sessionMaxAgeMs } from "../../common/crypto";

const PUBLIC_USER = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  accountStatus: true,
  mustChangePassword: true,
  restaurantId: true,
  branchId: true,
  title: true,
  profileImage: true,
  timezone: true,
  language: true,
  createdAt: true,
} as const;

@Injectable()
export class AuthService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  publicUserSelect() {
    return PUBLIC_USER;
  }

  async findUserBySessionToken(token: string) {
    const tokenHash = hashToken(token);
    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!session || session.expiresAt < new Date()) {
      if (session) await this.prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
      return null;
    }
    return session.user;
  }

  async createSession(userId: string, meta?: { ipAddress?: string; userAgent?: string }) {
    const token = generateSessionToken();
    await this.prisma.session.create({
      data: {
        userId,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + sessionMaxAgeMs()),
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
      },
    });
    return token;
  }

  async revokeSession(token: string) {
    await this.prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
}

export type PublicUserSelect = Prisma.UserGetPayload<{ select: typeof PUBLIC_USER }>;
