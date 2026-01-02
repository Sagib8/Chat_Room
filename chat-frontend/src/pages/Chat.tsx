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

type QuickRange = "none" | "24h" | "7d" | "30d";

type ListMessagesParams = {
  limit: number;
  search?: string;
  from?: string;
  to?: string;
};

function startOfDayISO(dateStr: string) {
  // Converts a local calendar date (YYYY-MM-DD) to an ISO timestamp at 00:00:00 local time.
  return new Date(`${dateStr}T00:00:00`).toISOString();
}

function endOfDayISO(dateStr: string) {
  // Converts a local calendar date (YYYY-MM-DD) to an ISO timestamp at 23:59:59.999 local time.
  return new Date(`${dateStr}T23:59:59.999`).toISOString();
}

function sortByCreatedAtDesc(items: Message[]) {
  // Newest-first so fresh messages appear at the top.
  return [...items].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
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

  // Filters
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(50);

  // Date filters (date-only inputs for better UX)
  const [fromDate, setFromDate] = useState(""); // YYYY-MM-DD
  const [toDate, setToDate] = useState(""); // YYYY-MM-DD
  const [quickRange, setQuickRange] = useState<QuickRange>("none");

  // Editing state (one message at a time)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");

/**
 * Build the query once; quick ranges override manual dates to keep inputs predictable.
 */
  const params = useMemo<ListMessagesParams>(() => {
    const p: ListMessagesParams = { limit };

    const q = search.trim();
    if (q) p.search = q;

    if (quickRange !== "none") {
      const now = Date.now();
      const deltaMs =
        quickRange === "24h"
          ? 24 * 60 * 60 * 1000
          : quickRange === "7d"
            ? 7 * 24 * 60 * 60 * 1000
            : 30 * 24 * 60 * 60 * 1000;

      p.from = new Date(now - deltaMs).toISOString();
      p.to = new Date(now).toISOString();
      return p;
    }

    if (fromDate) p.from = startOfDayISO(fromDate);
    if (toDate) p.to = endOfDayISO(toDate);

    return p;
  }, [limit, search, fromDate, toDate, quickRange]);

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
    setLimit(50);
    setFromDate("");
    setToDate("");
    setQuickRange("none");
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
            <button type="button" onClick={() => navigate("/audit")}>
              Audit
            </button>
          )}

          <button type="button" onClick={logout}>
            Logout
          </button>
        </div>
      </div>

      {error && <div style={{ marginTop: 12, color: "crimson" }}>{error}</div>}

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

      <div className="surface" style={{ marginTop: 16, padding: 12 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input
            style={{ width: 220 }}
            placeholder="Search..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setQuickRange("none");
            }}
          />

          <label style={{ fontSize: 12, opacity: 0.8 }}>Limit</label>
          <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
            <option value={10}>10</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </select>

          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 12, opacity: 0.8 }}>Quick</span>
            <button type="button" onClick={() => setQuickRange("24h")}>24h</button>
            <button type="button" onClick={() => setQuickRange("7d")}>7d</button>
            <button type="button" onClick={() => setQuickRange("30d")}>30d</button>
            <button type="button" onClick={() => setQuickRange("none")}>None</button>
          </div>

          <label style={{ fontSize: 12, opacity: 0.8 }}>From</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => {
              setFromDate(e.target.value);
              setQuickRange("none");
            }}
          />

          <label style={{ fontSize: 12, opacity: 0.8 }}>To</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => {
              setToDate(e.target.value);
              setQuickRange("none");
            }}
          />

          <button type="button" onClick={onApply}>Apply</button>
          <button type="button" onClick={clearFilters}>Clear</button>
        </div>
      </div>

      <div className="surface" style={{ marginTop: 16, padding: 12 }}>
        <div style={{ fontSize: 12, opacity: 0.8, color: "var(--muted)" }}>
          Online: {presence.length}
        </div>

        <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {presence.map((u) => (
            <span
              key={u.id}
              className="surface"
              style={{
                borderRadius: 999,
                padding: "6px 12px",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
              title={`connections: ${u.connections}`}
            >
              {u.username}
              <span className="muted" style={{ fontSize: 11 }}>×{u.connections}</span>
            </span>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        {loading && <div>Loading messages...</div>}
        {!loading && messages.length === 0 && <div>No messages yet.</div>}

        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
          {messages.map((m) => {
            const isEditing = editingId === m.id;

            return (
              <li key={m.id} className="surface" style={{ padding: 12 }}>
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  <b>{m.author.username}</b> • {new Date(m.createdAt).toLocaleString()}
                  {m.updatedAt ? ` • edited ${new Date(m.updatedAt).toLocaleString()}` : ""}
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
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
