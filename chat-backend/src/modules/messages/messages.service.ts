import { Role } from "@prisma/client";
import { prisma } from "../../db/prisma";
import { HttpError } from "../../utils/httpErrors";
import { AuditService } from "../audit/audit.service";
import { getIO } from "../../realtime/socket";

/**
 * Service responsibilities:
 * - Business rules (validation, permissions)
 * - Data access via Prisma
 * - No Express req/res usage here
 */
export const MessagesService = {
  async createMessage(params: { authorId: string; content: string }) {
    const { authorId, content } = params;

    // Basic validation (could be replaced by centralized schema validation)
    if (!content || typeof content !== "string") {
      throw new HttpError(400, "content is required");
    }

    const trimmed = content.trim();
    if (trimmed.length === 0) {
      throw new HttpError(400, "content cannot be empty");
    }

    if (trimmed.length > 2000) {
      // Limit message length to prevent abuse
      throw new HttpError(400, "content is too long");
    }

    // Persist message in DB
    const message = await prisma.message.create({
      data: {
        authorId,
        content: trimmed,
      },
      select: {
        id: true,
        content: true,
        createdAt: true,
        updatedAt: true,
        author: { select: { id: true, username: true, avatarUrl: true } },
      },
    });

    /**
     * Audit log: message created
     * We store a minimal "after" payload to avoid logging sensitive data.
     */
    await AuditService.log({
      actorUserId: authorId,
      action: "MESSAGE_CREATE",
      entityType: "Message",
      entityId: message.id,
      after: { content: message.content },
    });
    // Realtime: broadcast the new message to all connected clients
    getIO().emit("message:create", { message });
    return message;
  },

  async listMessages(params: {
    requesterId: string;
    limit?: number;
    search?: string;
    from?: string;
    to?: string;
  }) {
    const limit = Math.min(Math.max(params.limit ?? 50, 1), 200);

    /**
     * Parse ISO dates safely.
     * We accept ISO strings (e.g. 2026-01-01T12:00:00.000Z).
     */
    const parseIsoDate = (value?: string): Date | undefined => {
      if (!value) return undefined;
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) {
        throw new HttpError(400, `Invalid date format: ${value}`);
      }
      return d;
    };

    const fromDate = parseIsoDate(params.from);
    const toDate = parseIsoDate(params.to);

    // Optional: ensure logical range
    if (fromDate && toDate && fromDate > toDate) {
      throw new HttpError(400, "`from` must be <= `to`");
    }

    /**
     * Build a dynamic Prisma "where" clause.
     * We always filter out soft-deleted messages.
     */
    const where: any = {
      deletedAt: null,
    };

    // Keyword search in message content
    if (params.search && params.search.trim().length > 0) {
      where.content = {
        contains: params.search.trim(),
        mode: "insensitive", // case-insensitive search (Postgres)
      };
    }

    // Date range filtering (createdAt)
    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt.gte = fromDate;
      if (toDate) where.createdAt.lte = toDate;
    }

    const messages = await prisma.message.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        content: true,
        createdAt: true,
        updatedAt: true,
        author: { select: { id: true, username: true, avatarUrl: true } },
      },
    });

    // Return chronologically for the UI
    return messages.reverse();
  },

  // update && delete message
  async updateMessage(params: { messageId: string; authorId: string; content: string }) {
    const { messageId, authorId, content } = params;

    if (!content || content.trim().length === 0) {
      throw new HttpError(400, "content cannot be empty");
    }

    // Fetch message to check ownership
    const existing = await prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!existing || existing.deletedAt) {
      throw new HttpError(404, "message not found");
    }

    // Authorization: only the author can edit
    if (existing.authorId !== authorId) {
      throw new HttpError(403, "you can only edit your own messages");
    }

    // Capture "before" state for audit
    const before = { content: existing.content };

    const updated = await prisma.message.update({
      where: { id: messageId },
      data: {
        content: content.trim(),
        updatedAt: new Date(),
      },
      select: {
        id: true,
        content: true,
        createdAt: true,
        updatedAt: true,
        author: { select: { id: true, username: true, avatarUrl: true } },
      },
    });

    /**
     * Audit log: message updated
     */
    await AuditService.log({
      actorUserId: authorId,
      action: "MESSAGE_UPDATE",
      entityType: "Message",
      entityId: updated.id,
      before,
      after: { content: updated.content },
    });
    // Realtime: broadcast updated message to all connected clients
    getIO().emit("message:update", { message: updated });
    return updated;
  },

  async deleteMessage(params: { messageId: string; requesterId: string; requesterRole: Role }) {
    const { messageId, requesterId, requesterRole } = params;

    const existing = await prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!existing || existing.deletedAt) {
      throw new HttpError(404, "message not found");
    }

    // Authorization check
    if (existing.authorId !== requesterId && requesterRole !== "ADMIN") {
      throw new HttpError(403, "you can only delete your own messages");
    }

    // Soft delete: we do not remove the row from DB
    await prisma.message.update({
      where: { id: messageId },
      data: {
        deletedAt: new Date(),
      },
    });

    /**
     * Audit log: message deleted (soft delete)
     */
    await AuditService.log({
      actorUserId: requesterId,
      action: requesterRole === "ADMIN" ? "ADMIN_MESSAGE_DELETE" : "MESSAGE_DELETE",
      entityType: "Message",
      entityId: messageId,
      metadata: { softDelete: true, authorId: existing.authorId },
    });
    // Realtime: broadcast deletion to all connected clients
    getIO().emit("message:delete", { id: messageId });
  },
};
