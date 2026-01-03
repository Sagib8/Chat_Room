import type { Request, Response, NextFunction } from "express";
import { HttpError } from "../utils/httpErrors";

/**
 * Guards admin-only routes.
 * Assumes requireAuth has already attached req.user.
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
