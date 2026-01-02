import http from "http";
import { app } from "./app";
import { env } from "./config/env";
import { initSocket } from "./realtime/socket";

const server = http.createServer(app);

// Initialize Socket.IO on the same HTTP server
initSocket(server);

server.listen(env.port, () => {
  console.log(`Server listening on http://localhost:${env.port}`);
});