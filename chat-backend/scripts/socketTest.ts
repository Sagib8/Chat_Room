/// <reference types="node" />

import { io } from "socket.io-client";

/**
 * Usage:
 * npx ts-node scripts/socketTest.ts <ACCESS_TOKEN>
 */

const token = process.argv[2];
if (!token) {
  console.error("Usage: npx ts-node scripts/socketTest.ts <ACCESS_TOKEN>");
  process.exit(1);
}

const socket = io("http://localhost:4000", {
  auth: { token },
  transports: ["websocket"],
});

socket.on("connect", () => {
  console.log("Connected:", socket.id);
});

socket.on("message:create", (payload) => {
  console.log("EVENT message:create", payload);
});

socket.on("message:update", (payload) => {
  console.log("EVENT message:update", payload);
});

socket.on("message:delete", (payload) => {
  console.log("EVENT message:delete", payload);
});

socket.on("connect_error", (err) => {
  console.error("Connect error:", err.message);
});