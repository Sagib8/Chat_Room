import { Router } from "express";
import { prisma } from "../db/prisma";

export const routes = Router();

routes.get("/health", (_req, res) => {
  res.json({ ok: true });
});
routes.get("/db-check", async (_req, res, next) => {
  try {
    const now = await prisma.$queryRaw`SELECT NOW() as now`;
    res.json({ ok: true, now });
  } catch (e) {
    next(e);
  }
});