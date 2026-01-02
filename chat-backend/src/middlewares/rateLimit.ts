import type { Request, Response, NextFunction } from "express";
import { HttpError } from "../utils/httpErrors";

type Bucket = { count: number; resetAt: number };

/**
 * Lightweight in-memory rate limiter (per-IP).
 * Good enough for single-instance deployments; replace with Redis for multi-node.
 */
export function rateLimit(options: { windowMs: number; max: number; message?: string }) {
  const store = new Map<string, Bucket>();
  const { windowMs, max, message } = options;

  return (req: Request, _res: Response, next: NextFunction) => {
    const key = req.ip || "unknown";
    const now = Date.now();
    const bucket = store.get(key);

    if (!bucket || bucket.resetAt < now) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (bucket.count >= max) {
      const retryAfterSec = Math.ceil((bucket.resetAt - now) / 1000);
      return next(new HttpError(429, message ?? `Too many requests. Retry in ${retryAfterSec}s`));
    }

    bucket.count += 1;
    return next();
  };
}
