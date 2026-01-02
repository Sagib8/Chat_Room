import type { Server as HttpServer } from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { prisma } from "../db/prisma";

/**
 * One Socket.IO instance for the whole app.
 */
let io: Server | null = null;

/**
 * Presence map (in-memory):
 * userId -> { username, avatarUrl, connections }
 *
 * Why connections?
 * - One user can have multiple tabs/devices connected.
 */
const presence = new Map<string, { username: string; avatarUrl: string | null; connections: number }>();

function buildPresencePayload() {
  return {
    onlineUsers: Array.from(presence.entries()).map(([id, data]) => ({
      id,
      username: data.username,
      avatarUrl: data.avatarUrl,
      connections: data.connections,
    })),
  };
}

export function initSocket(httpServer: HttpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: env.corsOrigin,
      credentials: true,
    },
  });

  /**
   * Socket auth middleware:
   * - Validate JWT
   * - Fetch username from DB
   * - Attach user context to socket.data
   */
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token || typeof token !== "string") {
        return next(new Error("Missing access token"));
      }

      const payload = jwt.verify(token, env.jwtAccessSecret) as any;
      const userId = String(payload.sub);

      // Fetch the user once per connection (authoritative source: DB)
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, username: true, role: true, avatarUrl: true },
      });

      if (!user) {
        return next(new Error("User not found"));
      }

      socket.data.user = {
        id: user.id,
        role: user.role,
        username: user.username,
        avatarUrl: user.avatarUrl ?? null,
      };

      return next();
    } catch {
      return next(new Error("Invalid or expired access token"));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.data.user as {
      id: string;
      username: string;
      role: string;
      avatarUrl: string | null;
    };
    const userId = user.id;

    // Increase connections count (supports multiple tabs)
    const existing = presence.get(userId);
    if (!existing) {
      presence.set(userId, { username: user.username, avatarUrl: user.avatarUrl ?? null, connections: 1 });
    } else {
      presence.set(userId, {
        username: existing.username,
        avatarUrl: existing.avatarUrl,
        connections: existing.connections + 1,
      });
    }

    // Broadcast updated presence list
    io!.emit("presence:update", buildPresencePayload());

    socket.on("disconnect", () => {
      const current = presence.get(userId);
      if (!current) return;

      const nextCount = current.connections - 1;
      if (nextCount <= 0) {
        presence.delete(userId);
      } else {
        presence.set(userId, {
          username: current.username,
          avatarUrl: current.avatarUrl,
          connections: nextCount,
        });
      }

      io!.emit("presence:update", buildPresencePayload());
    });
  });

  return io;
}

/**
 * Accessor to emit events from other modules.
 */
export function getIO() {
  if (!io) throw new Error("Socket.IO not initialized. Call initSocket() first.");
  return io;
}
