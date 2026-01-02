import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth";

export const meRoutes = Router();

/**
 * Example protected route.
 * If access token is valid, it returns the authenticated user context.
 */
meRoutes.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});