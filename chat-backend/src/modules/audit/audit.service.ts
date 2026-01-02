import { prisma } from "../../db/prisma";

/**
 * AuditService:
 * Central place to write audit events.
 * Keep it small and consistent so it's easy to extend.
 */
export const AuditService = {
  async log(params: {
    actorUserId?: string | null;
    action: string;
    entityType?: string | null;
    entityId?: string | null;
    before?: any;
    after?: any;
    metadata?: any;
  }) {
    const { actorUserId, action, entityType, entityId, before, after, metadata } = params;

    await prisma.auditLog.create({
      data: {
        actorUserId: actorUserId ?? null,
        action,
        entityType: entityType ?? null,
        entityId: entityId ?? null,
        before: before ?? null,
        after: after ?? null,
        metadata: metadata ?? null,
      },
    });
  },
};