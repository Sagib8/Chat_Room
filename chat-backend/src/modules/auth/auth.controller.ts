import crypto from "crypto";
import { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { env } from "../../config/env";
import { HttpError } from "../../utils/httpErrors";

const REFRESH_COOKIE_NAME = "refresh_token";
const CSRF_COOKIE_NAME = "XSRF-TOKEN";

function issueCsrfToken() {
  return crypto.randomBytes(32).toString("hex");
}

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: "strict",
    path: "/auth/refresh",
    maxAge: 1000 * 60 * 60 * 24 * env.refreshTtlDays,
  });
}

function setCsrfCookie(res: Response, token: string) {
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false,
    secure: env.cookieSecure,
    sameSite: "strict",
    path: "/",
    maxAge: 1000 * 60 * 60 * 24 * env.refreshTtlDays,
  });
}

function readCsrfHeader(req: Request): string | undefined {
  const header = req.headers["x-xsrf-token"] ?? req.headers["x-csrf-token"];
  if (Array.isArray(header)) return header[0];
  return header as string | undefined;
}

function assertValidCsrf(req: Request) {
  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  const headerToken = readCsrfHeader(req);
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    throw new HttpError(403, "CSRF token mismatch");
  }
}

/**
 * Controller layer:
 * - Reads input from req (body/cookies)
 * - Calls service layer (business logic)
 * - Writes output to res (JSON/cookies/status)
 *
 * Keeps logic thin so it’s easier to test and maintain.
 */
export const AuthController = {
  async register(req: Request, res: Response) {
    const { username, password } = req.body;

    const result = await AuthService.register({ username, password });

    // Typically return the created user (without sensitive fields).
    res.status(201).json(result);
  },

  async login(req: Request, res: Response) {
    const { username, password } = req.body;

    const { accessToken, refreshToken, role } = await AuthService.login({ username, password });

    /**
     * Set refresh + CSRF cookies (double-submit defense on refresh).
     */
    const csrfToken = issueCsrfToken();
    setRefreshCookie(res, refreshToken);
    setCsrfCookie(res, csrfToken);

    // Access token is returned in JSON (client uses it in Authorization header).
    res.json({ accessToken, role });
  },

  async refresh(req: Request, res: Response) {
    assertValidCsrf(req);
    const refreshToken: string | undefined = req.cookies?.[REFRESH_COOKIE_NAME];

    const { accessToken, newRefreshToken, role } = await AuthService.refresh({ refreshToken });

    // Rotate cookie with the new refresh token.
    const csrfToken = issueCsrfToken();
    setRefreshCookie(res, newRefreshToken);
    setCsrfCookie(res, csrfToken);

    res.json({ accessToken, role });
  },

  async logout(req: Request, res: Response) {
    const refreshToken: string | undefined = req.cookies?.[REFRESH_COOKIE_NAME];

    // Logout should be idempotent: calling it multiple times should not error.
    await AuthService.logout({ refreshToken });

    res.clearCookie(REFRESH_COOKIE_NAME, { path: "/auth/refresh" });
    res.clearCookie(CSRF_COOKIE_NAME, { path: "/" });
    res.status(204).send();
  },
};
