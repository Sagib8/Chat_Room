import argon2 from "argon2";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { prisma } from "../../db/prisma";
import { env } from "../../config/env";
import { HttpError } from "../../utils/httpErrors";
import { AuditService } from "../audit/audit.service";

/**
 * Notes on our auth design:
 * - Access token: short-lived JWT for API access (Authorization header).
 * - Refresh token: long-lived JWT stored in HttpOnly cookie.
 * - Refresh tokens are stored in DB as hashes (never plaintext).
 * - Refresh rotation: each refresh invalidates the old refresh token.
 */

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

function normalizeAvatarUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;

  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (trimmed.length > 500) {
    throw new HttpError(400, "avatarUrl too long");
  }

  const isAllowed =
    trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("/");

  if (!isAllowed) {
    throw new HttpError(400, "avatarUrl must be a relative path or http(s) URL");
  }

  return trimmed;
}

function signAccessToken(user: { id: string; role: string }) {
  // Access token is short-lived to reduce impact if stolen.
  return jwt.sign({ role: user.role }, env.jwtAccessSecret, {
    subject: user.id,
    expiresIn: env.accessTtlSeconds,
  });
}

function signRefreshToken(user: { id: string; role: string }) {
  /**
   * Refresh token contains:
   * - role: optional claim for convenience
   * - jti: unique token id (useful for tracing / debugging)
   */
  return jwt.sign({ role: user.role, jti: crypto.randomUUID() }, env.jwtRefreshSecret, {
    subject: user.id,
    expiresIn: `${env.refreshTtlDays}d`,
  });
}

async function hashRefreshToken(token: string): Promise<string> {
  // Store only a hash in DB so a DB leak doesn't expose usable tokens.
  return argon2.hash(token);
}

async function verifyRefreshTokenHash(hash: string, token: string): Promise<boolean> {
  return argon2.verify(hash, token);
}

export const AuthService = {
  async register({
    username,
    password,
    avatarUrl: avatarUrlInput,
  }: {
    username: string;
    password: string;
    avatarUrl?: string | null;
  }) {
    // Basic input checks (we will later replace with Zod validation).
    if (!username || !password) throw new HttpError(400, "username and password are required");
    if (username.length < 3) throw new HttpError(400, "username too short");
    if (password.length < 8) throw new HttpError(400, "password too short");

    const normalized = normalizeUsername(username);
    const avatarUrl = normalizeAvatarUrl(avatarUrlInput);

    // Prevent duplicate usernames.
    const existing = await prisma.user.findUnique({ where: { username: normalized } });
    if (existing) throw new HttpError(409, "username already exists");

    // Hash password (never store plaintext password).
    const passwordHash = await argon2.hash(password);

    const user = await prisma.user.create({
      data: { username: normalized, passwordHash, avatarUrl },
      select: { id: true, username: true, role: true, createdAt: true, avatarUrl: true },
    });

    /**
     * Audit: registration is a security-relevant action.
     * We never log passwords or tokens.
     */
    await AuditService.log({
      actorUserId: user.id,
      action: "AUTH_REGISTER",
      entityType: "User",
      entityId: user.id,
      after: { username: user.username, role: user.role, avatarUrl: user.avatarUrl },
    });

    return { user };
  },

  async login({ username, password }: { username: string; password: string }) {
    if (!username || !password) throw new HttpError(400, "username and password are required");

    const normalized = normalizeUsername(username);

    const user = await prisma.user.findUnique({ where: { username: normalized } });

    // If user doesn't exist -> log failed login attempt (no actorUserId)
    if (!user) {
      await AuditService.log({
        actorUserId: null,
        action: "AUTH_LOGIN_FAILED",
        entityType: "User",
        entityId: null,
        metadata: {
          reason: "INVALID_CREDENTIALS",
          usernameAttempted: normalized,
        },
      });

      throw new HttpError(401, "invalid credentials");
    }

    // Verify password hash.
    const ok = await argon2.verify(user.passwordHash, password);

    // Wrong password -> log failed login attempt (we know which userId was targeted)
    if (!ok) {
      await AuditService.log({
        actorUserId: user.id,
        action: "AUTH_LOGIN_FAILED",
        entityType: "User",
        entityId: user.id,
        metadata: {
          reason: "INVALID_CREDENTIALS",
          usernameAttempted: normalized,
        },
      });

      throw new HttpError(401, "invalid credentials");
    }

    const accessToken = signAccessToken({ id: user.id, role: user.role });
    const refreshToken = signRefreshToken({ id: user.id, role: user.role });

    // Persist refresh token as hash (not plaintext).
    const tokenHash = await hashRefreshToken(refreshToken);
    const expiresAt = new Date(Date.now() + env.refreshTtlDays * 24 * 60 * 60 * 1000);

    await prisma.refreshToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    // Useful for security/audit analysis.
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    /**
     * Audit: successful login (security-relevant).
     * No tokens are logged.
     */
    await AuditService.log({
      actorUserId: user.id,
      action: "AUTH_LOGIN_SUCCESS",
      entityType: "User",
      entityId: user.id,
      metadata: {
        username: user.username,
      },
    });

    return { accessToken, refreshToken, role: user.role };
  },

  async refresh({ refreshToken }: { refreshToken?: string }) {
    if (!refreshToken) {
      await AuditService.log({
        actorUserId: null,
        action: "AUTH_REFRESH_FAILED",
        entityType: "RefreshToken",
        entityId: null,
        metadata: { reason: "MISSING_REFRESH_TOKEN" },
      });

      throw new HttpError(401, "missing refresh token");
    }

    let payload: any;
    try {
      payload = jwt.verify(refreshToken, env.jwtRefreshSecret);
    } catch {
      // Signature invalid / expired / tampered.
      await AuditService.log({
        actorUserId: null,
        action: "AUTH_REFRESH_FAILED",
        entityType: "RefreshToken",
        entityId: null,
        metadata: { reason: "INVALID_OR_EXPIRED_REFRESH_TOKEN" },
      });

      throw new HttpError(401, "invalid refresh token");
    }

    const userId = payload.sub as string;

    /**
     * We look up active (non-revoked, not expired) refresh tokens for the user.
     * We then verify the provided token against the stored hashes.
     *
     * Why not store token plaintext?
     * - If DB is compromised, plaintext tokens would allow impersonation.
     */
    const candidates = await prisma.refreshToken.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    let matched: { id: string } | null = null;
    for (const t of candidates) {
      const isMatch = await verifyRefreshTokenHash(t.tokenHash, refreshToken);
      if (isMatch) {
        matched = { id: t.id };
        break;
      }
    }

    if (!matched) {
      await AuditService.log({
        actorUserId: userId,
        action: "AUTH_REFRESH_FAILED",
        entityType: "User",
        entityId: userId,
        metadata: { reason: "REFRESH_TOKEN_NOT_RECOGNIZED" },
      });

      throw new HttpError(401, "refresh token not recognized");
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      await AuditService.log({
        actorUserId: userId,
        action: "AUTH_REFRESH_FAILED",
        entityType: "User",
        entityId: userId,
        metadata: { reason: "USER_NOT_FOUND" },
      });

      throw new HttpError(401, "user not found");
    }

    // Rotate refresh token: issue a new one and revoke the old one.
    const newRefreshToken = signRefreshToken({ id: user.id, role: user.role });
    const newHash = await hashRefreshToken(newRefreshToken);
    const newExpiresAt = new Date(Date.now() + env.refreshTtlDays * 24 * 60 * 60 * 1000);

    const newRow = await prisma.refreshToken.create({
      data: { userId: user.id, tokenHash: newHash, expiresAt: newExpiresAt },
      select: { id: true },
    });

    await prisma.refreshToken.update({
      where: { id: matched.id },
      data: { revokedAt: new Date(), replacedByTokenId: newRow.id },
    });

    const accessToken = signAccessToken({ id: user.id, role: user.role });

    /**
     * Audit: refresh succeeded (rotation performed).
     * No tokens are logged.
     */
    await AuditService.log({
      actorUserId: user.id,
      action: "AUTH_REFRESH_SUCCESS",
      entityType: "User",
      entityId: user.id,
      metadata: {
        rotated: true,
        oldTokenRevoked: true,
      },
    });

    return { accessToken, newRefreshToken, role: user.role };
  },

  async logout({ refreshToken }: { refreshToken?: string }) {
    // Logout must be safe to call even if token is missing/invalid.
    if (!refreshToken) return;

    try {
      const payload: any = jwt.verify(refreshToken, env.jwtRefreshSecret);
      const userId = payload.sub as string;

      // Find recent active tokens and revoke the matching one.
      const tokens = await prisma.refreshToken.findMany({
        where: { userId, revokedAt: null },
        orderBy: { createdAt: "desc" },
        take: 20,
      });

      let revoked = false;

      for (const t of tokens) {
        if (await verifyRefreshTokenHash(t.tokenHash, refreshToken)) {
          await prisma.refreshToken.update({
            where: { id: t.id },
            data: { revokedAt: new Date() },
          });
          revoked = true;
          break;
        }
      }

      /**
       * Audit: logout is logged only if we actually revoked a refresh token.
       * This prevents noisy logs from repeated/invalid logout calls.
       */
      if (revoked) {
        await AuditService.log({
          actorUserId: userId,
          action: "AUTH_LOGOUT",
          entityType: "User",
          entityId: userId,
          metadata: { revokedRefreshToken: true },
        });
      }
    } catch {
      // Intentionally ignore errors to keep logout idempotent.
    }
  },
};
