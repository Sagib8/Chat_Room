import type { Request, Response, NextFunction } from "express";

/**
 * Wraps async route handlers and forwards errors to Express error middleware.
 * Without this, unhandled promise rejections inside async handlers won't reach errorHandler.
 */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };