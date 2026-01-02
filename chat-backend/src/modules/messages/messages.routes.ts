import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { requireAuth } from "../../middlewares/requireAuth";
import { MessagesController } from "./messages.controller";

/**
 * Messages routes:
 * - Protected by requireAuth (only authenticated users can access messages).
 */
export const messagesRoutes = Router();

// Create a new message
messagesRoutes.post("/", requireAuth, asyncHandler(MessagesController.create));

// List messages (we'll add filters later)
messagesRoutes.get("/", requireAuth, asyncHandler(MessagesController.list));

// Update an existing message (only the author can edit)
messagesRoutes.put(
  "/:id",
  requireAuth,
  asyncHandler(MessagesController.update)
);

// Soft-delete a message (only the author can delete)
messagesRoutes.delete(
  "/:id",
  requireAuth,
  asyncHandler(MessagesController.remove)
);