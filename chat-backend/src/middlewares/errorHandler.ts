import { Request, Response, NextFunction } from "express";
import { HttpError } from "../utils/httpErrors";

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  const status = err instanceof HttpError ? err.statusCode : 500;
  const message = err instanceof HttpError ? err.message : "Internal Server Error";

  res.status(status).json({ error: message });
}