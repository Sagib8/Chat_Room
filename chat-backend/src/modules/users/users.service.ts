import { prisma } from "../../db/prisma";

/**
 * Service responsibilities:
 * - Data access via Prisma
 * - No Express req/res here
 */
export const UsersService = {
  async listUsers() {
    return prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        username: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });
  },
};
