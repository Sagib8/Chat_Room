import "express";

declare global {
  namespace Express {
    interface Request {
      /**
       * Authenticated user context (set by requireAuth middleware).
       * Controllers/services can rely on this for authorization checks.
       */
      user?: {
        id: string;
        role: "USER" | "ADMIN";
      };
    }
  }
}

export {};