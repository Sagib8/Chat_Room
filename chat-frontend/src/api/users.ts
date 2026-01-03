import { http } from "./http";
import type { Role } from "./auth";

export type User = {
  id: string;
  username: string;
  role: Role;
  avatarUrl: string | null;
  createdAt: string;
  lastLoginAt: string | null;
};

export async function listUsers() {
  const res = await http.get<{ users: User[] }>("/users");
  return res.data.users;
}

export async function createUser(payload: {
  username: string;
  password: string;
  role: Role;
  avatarUrl?: string | null;
}) {
  const res = await http.post<{ user: User }>("/users", payload);
  return res.data.user;
}

export async function updateRole(userId: string, role: Role) {
  const res = await http.patch<{ user: User }>(`/users/${userId}/role`, { role });
  return res.data.user;
}

export async function deleteUser(userId: string) {
  await http.delete(`/users/${userId}`);
}
