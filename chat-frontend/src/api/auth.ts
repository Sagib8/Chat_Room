import { http } from "./http";

export type Role = "USER" | "ADMIN";

// Refresh uses the HttpOnly cookie; returns a new access token and role.
export async function refresh() {
  const res = await http.post("/auth/refresh");
  return res.data as { accessToken: string; role: Role };
}

export async function login(username: string, password: string) {
  // Sets refresh cookie server-side and returns a short-lived access token + role.
  const res = await http.post("/auth/login", { username, password });
  return res.data as { accessToken: string; role: Role };
}

export async function register(username: string, password: string) {
  // Creates a new user record.
  const res = await http.post("/auth/register", { username, password });
  return res.data as {
    user: { id: string; username: string; role: Role; createdAt: string };
  };
}

export async function logout() {
  // Revokes the refresh token server-side; access token is discarded client-side.
  await http.post("/auth/logout");
}
