import type { Request, Response } from "express";
import { prisma } from "../../db/prisma";
import { HttpError } from "../../utils/httpErrors";

/**
 * Lists audit logs (admin only).
 * Returns newest-first and includes actor username for UI rendering.
 */
export const AuditController = {
  async list(req: Request, res: Response) {
    const limitRaw = typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;
    const limit = Math.min(Math.max(limitRaw ?? 100, 1), 500);

    const action =
      typeof req.query.action === "string" && req.query.action.trim().length > 0
        ? req.query.action.trim()
        : undefined;

    const actorUserId =
      typeof req.query.actorUserId === "string" && req.query.actorUserId.trim().length > 0
        ? req.query.actorUserId.trim()
        : undefined;

    const parseDate = (value: unknown): Date | undefined => {
      if (!value) return undefined;
      const d = new Date(String(value));
      if (Number.isNaN(d.getTime())) {
        throw new HttpError(400, `Invalid date: ${value}`);
      }
      return d;
    };

    const fromDate = parseDate(req.query.from);
    const toDate = parseDate(req.query.to);

    if (fromDate && toDate && fromDate > toDate) {
      throw new HttpError(400, "`from` must be <= `to`");
    }

    const where: any = {};
    if (action) where.action = action;
    if (actorUserId) where.actorUserId = actorUserId;
    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt.gte = fromDate;
      if (toDate) where.createdAt.lte = toDate;
    }

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        createdAt: true,
        action: true,
        entityType: true,
        before: true,
        after: true,
        metadata: true,
        actorUser: {
          select: {
            username: true,
          },
        },
      },
    });

    res.json({ logs });
  },
};
