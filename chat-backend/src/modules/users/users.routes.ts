import { Router } from "express";
import { UsersController } from "./users.controller";
import { requireAuth } from "../../middlewares/requireAuth";
import { asyncHandler } from "../../utils/asyncHandler";
import { requireAdmin } from "../../middlewares/requireAdmin";

const router = Router();

// Any authenticated user can view the user list (for chat roster)
router.get("/", requireAuth, asyncHandler(UsersController.list));

// Admin endpoints
router.post("/", requireAuth, requireAdmin, asyncHandler(UsersController.create));
router.patch("/:id/role", requireAuth, requireAdmin, asyncHandler(UsersController.updateRole));
router.delete("/:id", requireAuth, requireAdmin, asyncHandler(UsersController.delete));

export default router;
