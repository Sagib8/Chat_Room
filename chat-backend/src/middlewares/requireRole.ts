import type { Request, Response, NextFunction } from "express";
import { HttpError } from "../utils/httpErrors";

/**
 * requireRole:
 * - Ensures the user is authenticated (req.user exists)
 * - Ensures the user has the required role
 */
export function requireRole(role: "ADMIN" | "USER") {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new HttpError(401, "Unauthorized"));
    if (req.user.role !== role) return next(new HttpError(403, "Forbidden"));
    next();
  };
}