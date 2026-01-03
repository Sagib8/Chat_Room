import argon2 from "argon2";
import crypto from "crypto";
import { Role } from "@prisma/client";
import { prisma } from "../../db/prisma";
import { HttpError } from "../../utils/httpErrors";
import { normalizeAvatarUrl, normalizeUsername } from "../auth/auth.utils";
import { AuditService } from "../audit/audit.service";

/**
 * Service responsibilities:
 * - Data access via Prisma
 * - No Express req/res here
 */
export const UsersService = {
  async listUsers() {
    return prisma.user.findMany({
      where: { deletedAt: null },
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

  async createUser(params: {
    username: string;
    password: string;
    role: Role;
    avatarUrl?: string | null;
    actorUserId: string;
  }) {
    const { username, password, role, avatarUrl, actorUserId } = params;

    if (!username || !password) throw new HttpError(400, "username and password are required");
    if (username.length < 3) throw new HttpError(400, "username too short");
    if (password.length < 8) throw new HttpError(400, "password too short");

    if (!Object.values(Role).includes(role)) {
      throw new HttpError(400, "invalid role");
    }

    const normalized = normalizeUsername(username);
    const normalizedAvatar = normalizeAvatarUrl(avatarUrl);

    const existing = await prisma.user.findUnique({ where: { username: normalized } });
    if (existing) throw new HttpError(409, "username already exists");

    const passwordHash = await argon2.hash(password);

    const user = await prisma.user.create({
      data: { username: normalized, passwordHash, role, avatarUrl: normalizedAvatar },
      select: {
        id: true,
        username: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });

    await AuditService.log({
      actorUserId: actorUserId,
      action: "ADMIN_CREATE_USER",
      entityType: "User",
      entityId: user.id,
      after: { username: user.username, role: user.role, avatarUrl: user.avatarUrl },
    });

    return user;
  },

  async updateRole(params: { userId: string; role: Role; actorUserId: string }) {
    const { userId, role, actorUserId } = params;

    if (!Object.values(Role).includes(role)) {
      throw new HttpError(400, "invalid role");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, role: true, deletedAt: true },
    });

    if (!user || user.deletedAt) {
      throw new HttpError(404, "user not found");
    }

    if (userId === actorUserId) {
      throw new HttpError(400, "admins cannot change their own role");
    }

    if (user.role === role) return user;

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: {
        id: true,
        username: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });

    await AuditService.log({
      actorUserId,
      action: "ADMIN_UPDATE_ROLE",
      entityType: "User",
      entityId: updated.id,
      before: { role: user.role },
      after: { role: updated.role },
    });

    return updated;
  },

  async deleteUser(params: { userId: string; actorUserId: string }) {
    const { userId, actorUserId } = params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, role: true, deletedAt: true },
    });

    if (!user || user.deletedAt) {
      throw new HttpError(404, "user not found");
    }

    if (userId === actorUserId) {
      throw new HttpError(400, "admins cannot delete themselves");
    }

    // Free the username for reuse and prevent future logins.
    const deletedUsername = `deleted_${user.username}_${crypto.randomUUID().slice(0, 8)}`;

    await prisma.$transaction([
      prisma.refreshToken.updateMany({
        where: { userId },
        data: { revokedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: userId },
        data: {
          username: deletedUsername,
          passwordHash: await argon2.hash(crypto.randomUUID()),
          avatarUrl: null,
          deletedAt: new Date(),
        },
      }),
    ]);

    await AuditService.log({
      actorUserId,
      action: "ADMIN_DELETE_USER",
      entityType: "User",
      entityId: userId,
      metadata: { originalUsername: user.username },
    });
  },
};
