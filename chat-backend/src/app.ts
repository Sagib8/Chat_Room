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
//helmet for security headers
app.use(helmet());
//controls which origins are allowed to make browser requests to your api
app.use(cors({ origin: env.corsOrigin, credentials: true }));
//for json bodies
app.use(express.json({ limit: "64kb" }));
//to read cookies(refresh tokens)
app.use(cookieParser());
//just for checking
app.use(meRoutes);
app.use(routes);
//register/login/refresh/logout
app.use("/auth", authRoutes);
//message CRUD(create,read,update,delete)
app.use("/messages", messagesRoutes);
app.use("/admin/audit", auditRoutes);
app.use("/users", usersRoutes);
//to format errors
app.use(errorHandler);