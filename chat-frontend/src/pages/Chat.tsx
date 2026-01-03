import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createMessage,
  deleteMessage,
  listMessages,
  updateMessage,
  type Message,
} from "../api/messages";
import {
  connectSocket,
  disconnectSocket,
  onMessageCreate,
  onMessageDelete,
  onMessageUpdate,
  onPresence,
  type PresencePayload,
} from "../realtime/socket";
import { useAuth } from "../store/auth";
import { listUsers, type User } from "../api/users";

type ListMessagesParams = {
  search?: string;
  from?: string;
  to?: string;
};

function toIso(datetimeLocal: string) {
  // Accepts a datetime-local string (local time) and returns ISO UTC.
  if (!datetimeLocal) return undefined;
  const d = new Date(datetimeLocal);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

function sortByCreatedAtDesc(items: Message[]) {
  // Newest-first so fresh messages appear at the top.
  return [...items].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

const FALLBACK_AVATAR = "/avatars/fallback.svg";

function avatarSrc(url: string | null) {
  return url && url.trim().length > 0 ? url : FALLBACK_AVATAR;
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString("he-IL")} ${d.toLocaleTimeString("he-IL", { hour12: false })}`;
}

// Lightweight JWT decoder (no signature verification) to extract user id/role from the access token.
function decodeAccessToken(token: string): { id: string; role?: string } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return { id: String(payload.sub), role: payload.role };
  } catch {
    return null;
  }
}

export function ChatPage() {
  const navigate = useNavigate();
  const { logout, accessToken, isAdmin } = useAuth();

  // Messages state
  const [messages, setMessages] = useState<Message[]>([]);
  const [content, setContent] = useState("");

  // UI state
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Presence state (online users)
  const [presence, setPresence] = useState<PresencePayload["onlineUsers"]>([]);
  const onlineUserIds = useMemo(() => new Set(presence.map((u) => u.id)), [presence]);
  const [users, setUsers] = useState<User[]>([]);
  const [usersError, setUsersError] = useState<string | null>(null);

  // Date/time filters (local datetime inputs, converted to ISO)
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState(""); // e.g., 2026-01-03T12:00
  const [toDate, setToDate] = useState(""); // e.g., 2026-01-03T18:00

  const currentUser = useMemo(() => {
    if (!accessToken) return null;
    const decoded = decodeAccessToken(accessToken);
    if (!decoded) return null;
    const presenceUser = presence.find((u) => u.id === decoded.id);
    return {
      id: decoded.id,
      username: presenceUser?.username ?? "You",
      avatarUrl: presenceUser?.avatarUrl ?? null,
    };
  }, [accessToken, presence]);

  // Editing state (one message at a time)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");

  const params = useMemo<ListMessagesParams>(() => {
    const p: ListMessagesParams = {};
    const q = search.trim();
    if (q) p.search = q;
    if (fromDate) p.from = toIso(fromDate);
    if (toDate) p.to = toIso(toDate);
    return p;
  }, [search, fromDate, toDate]);

  const roster = useMemo(() => {
    const byName = [...users].sort((a, b) => a.username.localeCompare(b.username));
    return byName.sort((a, b) => Number(onlineUserIds.has(b.id)) - Number(onlineUserIds.has(a.id)));
  }, [users, onlineUserIds]);

  async function load() {
    setError(null);
    setLoading(true);

    try {
      const data = await listMessages(params);
      setMessages(sortByCreatedAtDesc(data));
    } catch (err: any) {
      const msg =
        err?.response?.data?.error || err?.message || "Failed to load messages";
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  }

  /**
   * Initial fetch; avoid refetching on every keystroke.
   */
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Realtime lifecycle: connect once per token and clean up listeners on change/unmount.
   */
  useEffect(() => {
    if (!accessToken) return;

    const socketBaseUrl =
      import.meta.env.VITE_SOCKET_URL ?? import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

    connectSocket({
      baseUrl: socketBaseUrl,
      token: accessToken,
    });

    const offPresence = onPresence((payload) => {
      setPresence(payload.onlineUsers);
    });

    const offCreate = onMessageCreate(({ message }) => {
      setMessages((prev) => {
        // Deduplicate in case the message already exists (e.g., after a reload).
        if (prev.some((m) => m.id === message.id)) return prev;
        return sortByCreatedAtDesc([...prev, message]);
      });
    });

    const offUpdate = onMessageUpdate(({ message }) => {
      setMessages((prev) =>
        sortByCreatedAtDesc(prev.map((m) => (m.id === message.id ? message : m))),
      );
    });

    const offDelete = onMessageDelete(({ id }) => {
      setMessages((prev) => prev.filter((m) => m.id !== id));
    });

    return () => {
      offPresence();
      offCreate();
      offUpdate();
      offDelete();
      disconnectSocket();
    };
  }, [accessToken]);

  useEffect(() => {
    async function loadUsers() {
      setUsersError(null);
      try {
        const all = await listUsers();
        setUsers(all);
      } catch (err: any) {
        const msg = err?.response?.data?.error || err?.message || "Failed to load users";
        setUsersError(String(msg));
      }
    }

    loadUsers();
  }, []);

  /**
   * Create message: rely on socket broadcast to update state.
   */
  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = content.trim();
    if (!trimmed) return;

    setSending(true);
    try {
      await createMessage(trimmed);
      setContent("");
    } catch (err: any) {
      const msg =
        err?.response?.data?.error || err?.message || "Failed to send message";
      setError(String(msg));
    } finally {
      setSending(false);
    }
  }

  function startEdit(m: Message) {
    setEditingId(m.id);
    setEditingValue(m.content);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingValue("");
  }

  /**
   * Update message: state updates via socket broadcast.
   */
  async function saveEdit(id: string) {
    const trimmed = editingValue.trim();
    if (!trimmed) return;

    setError(null);
    try {
      await updateMessage(id, trimmed);
      cancelEdit();
    } catch (err: any) {
      const msg =
        err?.response?.data?.error || err?.message || "Failed to update message";
      setError(String(msg));
    }
  }

  /**
   * Delete message: state updates via socket broadcast.
   */
  async function onDelete(id: string) {
    setError(null);
    try {
      await deleteMessage(id);
    } catch (err: any) {
      const msg =
        err?.response?.data?.error || err?.message || "Failed to delete message";
      setError(String(msg));
    }
  }

  function clearFilters() {
    setSearch("");
    setFromDate("");
    setToDate("");
    setTimeout(load, 0);
  }

  function onApply() {
    load();
  }

  return (
    <div style={{ maxWidth: 960, margin: "24px auto", padding: "0 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>Chat</h2>

        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={load} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </button>

          {isAdmin && (
            <>
              <button type="button" onClick={() => navigate("/admin")}>
                Admin
              </button>
              <button type="button" onClick={() => navigate("/audit")}>
                Audit
              </button>
            </>
          )}

          <button type="button" onClick={logout}>
            Logout
          </button>
        </div>
      </div>

      {currentUser && (
        <div
          style={{
            marginTop: 8,
            padding: "8px 12px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            borderLeft: "4px solid #2563eb",
            background: "rgba(37,99,235,0.08)",
            borderRadius: 6,
          }}
        >
          <img
            src={avatarSrc(currentUser.avatarUrl)}
            alt="Your avatar"
            width={32}
            height={32}
            style={{ borderRadius: "50%", objectFit: "cover", background: "#111827" }}
          />
          <span style={{ fontSize: 14, opacity: 0.7 }}>Username:</span>
          <strong>{currentUser.username}</strong>
        </div>
      )}

      {error && <div style={{ marginTop: 12, color: "crimson" }}>{error}</div>}

      <div className="surface" style={{ marginTop: 16, padding: 12 }}>
        <div style={{ fontSize: 12, opacity: 0.8, color: "var(--muted)" }}>Users in chat:</div>
        {usersError && <div style={{ color: "crimson", marginTop: 6 }}>{usersError}</div>}

        <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {roster.map((u) => {
            const isOnline = onlineUserIds.has(u.id);
            const connections = presence.find((p) => p.id === u.id)?.connections ?? 0;
            return (
              <span
                key={u.id}
                className="surface"
                style={{
                  borderRadius: 999,
                  padding: "6px 12px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  opacity: isOnline ? 1 : 0.6,
                }}
                title={isOnline ? `Online • connections: ${connections}` : "Offline"}
              >
                <span
                  aria-label={isOnline ? "online" : "offline"}
                  style={{
                    display: "inline-block",
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    backgroundColor: isOnline ? "#22c55e" : "#ef4444",
                  }}
                />
                <img
                  src={avatarSrc(u.avatarUrl)}
                  alt={`${u.username} avatar`}
                  width={28}
                  height={28}
                  style={{ borderRadius: "50%", objectFit: "cover", background: "#1f2933" }}
                />
                <span>{u.username}</span>
                {isOnline && (
                  <span className="muted" style={{ fontSize: 11 }}>
                    ×{connections}
                  </span>
                )}
              </span>
            );
          })}
        </div>
      </div>

      <div className="surface" style={{ marginTop: 16, padding: 12 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input
            style={{ width: 220 }}
            placeholder="Search messages by keyword"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <label style={{ fontSize: 12, opacity: 0.8 }}>From</label>
          <input
            type="datetime-local"
            value={fromDate}
            onChange={(e) => {
              setFromDate(e.target.value);
            }}
          />

          <label style={{ fontSize: 12, opacity: 0.8 }}>To</label>
          <input
            type="datetime-local"
            value={toDate}
            onChange={(e) => {
              setToDate(e.target.value);
            }}
          />

          <button type="button" onClick={onApply}>Apply</button>
          <button type="button" onClick={clearFilters}>Clear</button>
        </div>
      </div>

      <div className="surface" style={{ marginTop: 16, padding: 12 }}>
        <form onSubmit={onSend} style={{ display: "flex", gap: 8 }}>
          <input
            style={{ flex: 1 }}
            placeholder="Type a message..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <button disabled={sending}>{sending ? "Sending..." : "Send"}</button>
        </form>
      </div>

      <div style={{ marginTop: 16 }}>
        {loading && <div>Loading messages...</div>}
        {!loading && messages.length === 0 && <div>No messages yet.</div>}

        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
          {messages.map((m) => {
            const isEditing = editingId === m.id;

            return (
              <li
                key={m.id}
                className="surface"
                style={{ padding: 12, display: "grid", gridTemplateColumns: "56px 1fr", gap: 12 }}
              >
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <div style={{ position: "relative", width: 48, height: 48 }}>
                    <img
                      src={avatarSrc(m.author.avatarUrl)}
                      alt={`${m.author.username} avatar`}
                      width={48}
                      height={48}
                      style={{ borderRadius: "50%", objectFit: "cover", background: "#111827" }}
                    />
                    <span
                      aria-label={onlineUserIds.has(m.author.id) ? "online" : "offline"}
                      title={onlineUserIds.has(m.author.id) ? "Online" : "Offline"}
                      style={{
                        position: "absolute",
                        right: -2,
                        bottom: -2,
                        width: 14,
                        height: 14,
                        borderRadius: "50%",
                        border: "2px solid var(--surface, #0b1224)",
                        backgroundColor: onlineUserIds.has(m.author.id) ? "#22c55e" : "#ef4444",
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    <b>{m.author.username}</b> • Sent: {formatDateTime(m.createdAt)}
                    {m.updatedAt ? ` • Last edited at: ${formatDateTime(m.updatedAt)}` : ""}
                  </div>

                  {!isEditing ? (
                    <div style={{ marginTop: 6 }}>{m.content}</div>
                  ) : (
                    <div style={{ marginTop: 6, display: "flex", gap: 8 }}>
                      <input
                        style={{ flex: 1, padding: 8 }}
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                      />
                      <button type="button" onClick={() => saveEdit(m.id)}>Save</button>
                      <button type="button" onClick={cancelEdit}>Cancel</button>
                    </div>
                  )}

                  {!isEditing && (
                    <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                      <button type="button" onClick={() => startEdit(m)}>Edit</button>
                      <button type="button" onClick={() => onDelete(m.id)}>Delete</button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
