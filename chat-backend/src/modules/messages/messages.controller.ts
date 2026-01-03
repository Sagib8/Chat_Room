import type { Request, Response } from "express";
import { MessagesService } from "./messages.service";

/**
 * Controller responsibilities:
 * - Read input from HTTP request (body/query/headers)
 * - Call the service layer
 * - Return HTTP response (status + JSON)
 */
export const MessagesController = {
  async create(req: Request, res: Response) {
    /**
     * We rely on requireAuth middleware to set req.user.
     * If req.user is missing here, it's a bug in route protection.
     */
    const userId = req.user!.id;
    const { content } = req.body;

    const message = await MessagesService.createMessage({
      authorId: userId,
      content,
    });

    res.status(201).json({ message });
  },

 async list(req: Request, res: Response) {
  const userId = req.user!.id;

  // Query params are strings by default in Express.
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  const from = typeof req.query.from === "string" ? req.query.from : undefined;
  const to = typeof req.query.to === "string" ? req.query.to : undefined;

  const limitRaw = typeof req.query.limit === "string" ? req.query.limit : undefined;
  const limit = limitRaw ? Number(limitRaw) : undefined;

  const messages = await MessagesService.listMessages({
    requesterId: userId,
    limit,
    search,
    from,
    to,
  });

  res.json({ messages });
},
  //update && remove messages
  async update(req: Request, res: Response) {
  const userId = req.user!.id;
  const messageId = req.params.id;
  const { content } = req.body;

  const message = await MessagesService.updateMessage({
    messageId,
    authorId: userId,
    content,
  });

  res.json({ message });
},

async remove(req: Request, res: Response) {
  const userId = req.user!.id;
  const role = req.user!.role;
  const messageId = req.params.id;

  await MessagesService.deleteMessage({
    messageId,
    requesterId: userId,
    requesterRole: role,
  });

  // 204 = success, no response body
  res.status(204).send();
},
};
