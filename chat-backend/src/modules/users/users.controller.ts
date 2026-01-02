import type { Request, Response } from "express";
import { UsersService } from "./users.service";

export const UsersController = {
  async list(req: Request, res: Response) {
    const users = await UsersService.listUsers();
    res.json({ users });
  },
};