import { HttpError } from "../../utils/httpErrors";

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function normalizeAvatarUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;

  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (trimmed.length > 500) {
    throw new HttpError(400, "avatarUrl too long");
  }

  const isAllowed =
    trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("/");

  if (!isAllowed) {
    throw new HttpError(400, "avatarUrl must be a relative path or http(s) URL");
  }

  return trimmed;
}
