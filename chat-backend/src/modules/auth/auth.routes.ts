import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { AuthController } from "./auth.controller";
import { rateLimit } from "../../middlewares/rateLimit";

/**
 * Auth routes:
 * - register: creates a new user
 * - login: returns access token + sets refresh cookie
 * - refresh: rotates refresh token and returns a new access token
 * - logout: revokes refresh token and clears refresh cookie
 */
export const authRoutes = Router();

//Rate limiters to enhance security
const loginLimiter = rateLimit({
  //10 requests per 10 minutes
  windowMs: 10 * 60 * 1000,
  max: 10,
  message: "Too many login attempts. Please wait before retrying.",
});

const refreshLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  message: "Too many refresh attempts. Please slow down.",
});
//move on to controller
authRoutes.post("/register", asyncHandler(AuthController.register));
authRoutes.post("/login", loginLimiter, asyncHandler(AuthController.login));
authRoutes.post("/refresh", refreshLimiter, asyncHandler(AuthController.refresh));
authRoutes.post("/logout", asyncHandler(AuthController.logout));
