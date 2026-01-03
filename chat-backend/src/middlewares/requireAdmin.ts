import type { Request, Response, NextFunction } from "express";
import { HttpError } from "../utils/httpErrors";

/**
 * requireAdmin:
 * - Expects req.user to be set by requireAuth
 * - Ensures the authenticated user has ADMIN role
 */
export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    return next(new HttpError(401, "Missing auth context"));
  }

  if (req.user.role !== "ADMIN") {
    return next(new HttpError(403, "Admin access only"));
  }

  return next();
}
