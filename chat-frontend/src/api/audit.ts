import { http } from "./http";

export type AuditLog = {
  id: string;
  createdAt: string;
  actorUserId: string | null;

  actorUser?: {
    id: string;
    username: string;
  } | null;

  action: string;
  entityType: string | null;
  entityId: string | null;
  before: unknown | null;
  after: unknown | null;
  metadata: unknown | null;
};

export async function listAudit(params?: {
  limit?: number;
  action?: string;
  actorUserId?: string;
  from?: string; // ISO
  to?: string; // ISO
}) {
  const res = await http.get("/admin/audit", { params });
  return (res.data.logs ?? []) as AuditLog[];
}
