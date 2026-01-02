import { Router } from "express";
import { UsersController } from "./users.controller";
import { requireAuth } from "../../middlewares/requireAuth";
import { asyncHandler } from "../../utils/asyncHandler";

const router = Router();

// Any authenticated user can view the user list (for chat roster)
router.get("/", requireAuth, asyncHandler(UsersController.list));

export default router;