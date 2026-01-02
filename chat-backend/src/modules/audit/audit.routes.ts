import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { requireAuth } from "../../middlewares/requireAuth";
import { requireRole } from "../../middlewares/requireRole";
import { AuditController } from "./audit.controller";

/**
 * Admin-only audit endpoints.
 */
export const auditRoutes = Router();

auditRoutes.get("/", requireAuth, requireRole("ADMIN"), asyncHandler(AuditController.list));