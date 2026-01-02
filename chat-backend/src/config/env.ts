import dotenv from "dotenv";
dotenv.config();

const must = (key: string) => {
  const value = process.env[key];
  if (!value) throw new Error(`Missing env var: ${key}`);
  return value;
};

export const env = {
  port: Number(process.env.PORT ?? 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  nodeEnv: process.env.NODE_ENV ?? "development",
  databaseUrl: must("DATABASE_URL"),
  jwtAccessSecret: must("JWT_ACCESS_SECRET"),
  jwtRefreshSecret: must("JWT_REFRESH_SECRET"),
  accessTtlSeconds: Number(process.env.ACCESS_TOKEN_TTL_SECONDS ?? "900"),
  refreshTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? "14"),
  cookieSecure:
    (process.env.COOKIE_SECURE ?? (process.env.NODE_ENV === "production" ? "true" : "false")) ===
    "true",
};
