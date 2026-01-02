import { io, type Socket } from "socket.io-client";

/**
 * We keep a single Socket.IO connection for the whole app.
 * This avoids creating multiple parallel connections (tabs aside).
 */
let socket: Socket | null = null;

/**
 * Presence payload shape (matches backend `presence:update` event).
 */
export type PresencePayload = {
  onlineUsers: Array<{
    id: string;
    username: string;
    avatarUrl: string | null;
    connections: number;
  }>;
};

export type MessageEventPayload = { message: any };
export type DeleteEventPayload = { id: string };

/**
 * Connect (or reuse an existing connection).
 * We pass the JWT via `handshake.auth.token`, which the backend validates.
 */
export function connectSocket(params: { baseUrl: string; token: string }) {
  if (socket) return socket;

  socket = io(params.baseUrl, {
    transports: ["websocket"], // stable, avoids polling issues in dev
    auth: { token: params.token },
  });

  return socket;
}

/**
 * Clean disconnect (used on logout / unmount).
 */
export function disconnectSocket() {
  if (!socket) return;
  socket.disconnect();
  socket = null;
}

/**
 * Event subscriptions (return an unsubscribe function).
 * This pattern helps prevent duplicate listeners and memory leaks.
 */
export function onPresence(handler: (payload: PresencePayload) => void) {
  socket?.on("presence:update", handler);
  return () => socket?.off("presence:update", handler);
}

export function onMessageCreate(handler: (payload: MessageEventPayload) => void) {
  socket?.on("message:create", handler);
  return () => socket?.off("message:create", handler);
}

export function onMessageUpdate(handler: (payload: MessageEventPayload) => void) {
  socket?.on("message:update", handler);
  return () => socket?.off("message:update", handler);
}

export function onMessageDelete(handler: (payload: DeleteEventPayload) => void) {
  socket?.on("message:delete", handler);
  return () => socket?.off("message:delete", handler);
}
