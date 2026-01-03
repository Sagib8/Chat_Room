import argon2 from "argon2";
import { Role } from "@prisma/client";
import { prisma } from "../../db/prisma";
import { env } from "../../config/env";
import { normalizeAvatarUrl, normalizeUsername } from "./auth.utils";

/**
 * Creates an initial admin user on startup if env vars are provided.
 * - Skips creation when username/password are missing.
 * - Does not override existing users (logs a warning instead).
 */
export async function ensureInitialAdmin() {
  if (!env.initialAdmin) return;

  const username = normalizeUsername(env.initialAdmin.username);
  const defaultAdminAvatar = "/avatars/admin.jpg";
  const avatarUrl = normalizeAvatarUrl(defaultAdminAvatar);

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    if (existing.role !== Role.ADMIN) {
      console.warn(
        `[bootstrap] User '${username}' already exists with role '${existing.role}'. ` +
          "Not changing role or password; adjust manually if needed.",
      );
    }
    return;
  }

  const passwordHash = await argon2.hash(env.initialAdmin.password);

  await prisma.user.create({
    data: {
      username,
      passwordHash,
      role: Role.ADMIN,
      avatarUrl,
    },
  });

  console.log(`[bootstrap] Initial admin '${username}' created.`);
}
