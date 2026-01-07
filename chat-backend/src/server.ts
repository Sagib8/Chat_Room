import http from "http";
import { app } from "./app";
import { env } from "./config/env";
import { initSocket } from "./realtime/socket";
import { ensureInitialAdmin } from "./modules/auth/bootstrapAdmin";

const server = http.createServer(app);

// Initialize Socket.IO on the same HTTP server
initSocket(server);

async function start() {
  //creates the bootstrap admin if env vars are set
  await ensureInitialAdmin();

  server.listen(env.port, () => {
    console.log(`Server listening on http://localhost:${env.port}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server", err);
  process.exit(1);
});
