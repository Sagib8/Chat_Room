import type { Request, Response } from "express";
import { UsersService } from "./users.service";

export const UsersController = {
  async list(req: Request, res: Response) {
    const users = await UsersService.listUsers();
    res.json({ users });
  },

  async create(req: Request, res: Response) {
    const { username, password, role, avatarUrl } = req.body;
    const actorUserId = req.user!.id;

    const user = await UsersService.createUser({
      username,
      password,
      role,
      avatarUrl,
      actorUserId,
    });

    res.status(201).json({ user });
  },

  async updateRole(req: Request, res: Response) {
    const { role } = req.body;
    const userId = req.params.id;
    const actorUserId = req.user!.id;

    const user = await UsersService.updateRole({ userId, role, actorUserId });
    res.json({ user });
  },

  async delete(req: Request, res: Response) {
    const userId = req.params.id;
    const actorUserId = req.user!.id;

    await UsersService.deleteUser({ userId, actorUserId });
    res.status(204).send();
  },
};
