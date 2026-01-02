import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { meRoutes } from "./routes/me";
import { env } from "./config/env";
import { routes } from "./routes";
import { errorHandler } from "./middlewares/errorHandler";
import { authRoutes } from "./modules/auth/auth.routes";
import { messagesRoutes } from "./modules/messages/messages.routes";
import { auditRoutes } from "./modules/audit/audit.routes";
import usersRoutes from "./modules/users/users.routes";

export const app = express();

app.use(helmet());
app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(express.json({ limit: "64kb" }));
app.use(cookieParser());
app.use(meRoutes);

app.use(routes);
app.use("/auth", authRoutes);
app.use("/messages", messagesRoutes);
app.use("/admin/audit", auditRoutes);
app.use("/users", usersRoutes);

app.use(errorHandler);