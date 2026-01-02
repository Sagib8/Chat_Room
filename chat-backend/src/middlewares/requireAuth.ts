import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { HttpError } from "../utils/httpErrors";

/**
 * requireAuth:
 * - Expects an access token in the Authorization header: "Bearer <token>"
 * - Verifies token signature + expiration
 * - Attaches the authenticated user to req.user
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  // Header format: Authorization: Bearer <access_token>
  if (!header || !header.startsWith("Bearer ")) {
    return next(new HttpError(401, "Missing Authorization Bearer token"));
  }

  const token = header.slice("Bearer ".length).trim();

  try {
    const payload = jwt.verify(token, env.jwtAccessSecret) as any;

    // We set req.user so downstream handlers can authorize actions.
    req.user = {
      id: String(payload.sub),      // we used JWT "subject" as user id
      role: payload.role,           // role is stored as a claim
    };

    return next();
  } catch {
    // Invalid signature / expired token / malformed token
    return next(new HttpError(401, "Invalid or expired access token"));
  }
}