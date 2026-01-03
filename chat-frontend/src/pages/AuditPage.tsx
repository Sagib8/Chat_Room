import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listAudit, type AuditLog } from "../api/audit";
import { useAuth } from "../store/auth";

type QuickRange = "none" | "24h" | "7d" | "30d";

type AuditQueryParams = {
  limit: number;
  action?: string;
  actorUserId?: string;
  from?: string;
  to?: string;
};

function startOfDayISO(dateStr: string) {
  // Converts a local date (YYYY-MM-DD) to an ISO timestamp at 00:00:00 local time.
  return new Date(`${dateStr}T00:00:00`).toISOString();
}

function endOfDayISO(dateStr: string) {
  // Converts a local date (YYYY-MM-DD) to an ISO timestamp at 23:59:59.999 local time.
  return new Date(`${dateStr}T23:59:59.999`).toISOString();
}

function safeJson(value: unknown) {
  // Safely stringify objects for table rendering (never throws).
  if (value == null) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function actorLabel(log: AuditLog) {
  // Prefer username if the backend joined the user. Fallback to "-" when missing.
  return log.actorUser?.username ?? "-";
}

function entityLabel(entityType: string | null) {
  // UX: display only the entity type (no ":id" suffix).
  return entityType ?? "-";
}

export function AuditPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  // Data state
  const [logs, setLogs] = useState<AuditLog[]>([]);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [limit, setLimit] = useState(100);
  const [action, setAction] = useState("");
  const [actorUserId, setActorUserId] = useState("");

  // Date filters (date-only inputs for simple UX)
  const [fromDate, setFromDate] = useState(""); // YYYY-MM-DD
  const [toDate, setToDate] = useState(""); // YYYY-MM-DD
  const [quickRange, setQuickRange] = useState<QuickRange>("none");

/**
 * Compose request params; quick ranges override manual dates for a single source of truth.
 */
  const params = useMemo<AuditQueryParams>(() => {
    const p: AuditQueryParams = { limit };

    const a = action.trim();
    if (a) p.action = a;

    const actor = actorUserId.trim();
    if (actor) p.actorUserId = actor;

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
  }, [limit, action, actorUserId, fromDate, toDate, quickRange]);

  async function load() {
    setError(null);
    setLoading(true);

    try {
      const data = await listAudit(params);
      setLogs(data);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || "Failed to load audit logs";
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  }

  /**
   * Initial fetch; avoids refetch on every keystroke.
   */
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function clearFilters() {
    setLimit(100);
    setAction("");
    setActorUserId("");
    setFromDate("");
    setToDate("");
    setQuickRange("none");
    setTimeout(load, 0);
  }

  return (
    <div style={{ maxWidth: 1200, margin: "24px auto", padding: "0 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>Audit</h2>

        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={() => navigate("/chat")}>
            Back
          </button>
          <button type="button" onClick={() => navigate("/admin")}>
            Admin
          </button>

          <button onClick={load} disabled={loading} type="button">
            {loading ? "Loading..." : "Refresh"}
          </button>

          <button onClick={logout} type="button">
            Logout
          </button>
        </div>
      </div>

      {error && <div style={{ marginTop: 12, color: "crimson" }}>{error}</div>}

      <div className="surface" style={{ marginTop: 16, padding: 12 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <label style={{ fontSize: 12, opacity: 0.8 }}>Limit</label>
          <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </select>

          <input
            style={{ padding: 8, width: 240 }}
            placeholder="Action (e.g. MESSAGE_CREATE)"
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setQuickRange("none");
            }}
          />

          <input
            style={{ padding: 8, width: 280 }}
            placeholder="actorUserId (optional)"
            value={actorUserId}
            onChange={(e) => {
              setActorUserId(e.target.value);
              setQuickRange("none");
            }}
          />

          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 12, opacity: 0.8 }}>Quick</span>
            <button type="button" onClick={() => setQuickRange("24h")}>
              24h
            </button>
            <button type="button" onClick={() => setQuickRange("7d")}>
              7d
            </button>
            <button type="button" onClick={() => setQuickRange("30d")}>
              30d
            </button>
            <button type="button" onClick={() => setQuickRange("none")}>
              None
            </button>
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

          <button type="button" onClick={load}>
            Apply
          </button>

          <button type="button" onClick={clearFilters}>
            Clear
          </button>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        {loading && <div>Loading logs...</div>}
        {!loading && logs.length === 0 && <div>No logs found.</div>}

        <div
          className="surface"
          style={{ marginTop: 8, overflow: "auto", maxHeight: "calc(100vh - 260px)" }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr>
                {["Time", "Action", "Actor", "Entity", "Before", "After", "Metadata"].map((h) => (
                  <th
                    key={h}
                    style={{
                      position: "sticky",
                      top: 0,
                      background: "rgba(15, 23, 42, 0.96)",
                      textAlign: "left",
                      padding: 8,
                      borderBottom: "1px solid var(--border)",
                      fontSize: 11,
                      opacity: 0.9,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td style={{ padding: 8, borderBottom: "1px solid #f2f2f2", whiteSpace: "nowrap" }}>
                    {new Date(l.createdAt).toLocaleString()}
                  </td>

                  <td style={{ padding: 8, borderBottom: "1px solid #f2f2f2", whiteSpace: "nowrap" }}>
                    {l.action}
                  </td>

                  <td
                    style={{ padding: 8, borderBottom: "1px solid #f2f2f2", whiteSpace: "nowrap" }}
                    title={l.actorUserId ?? ""}
                  >
                    {actorLabel(l)}
                  </td>

                  <td style={{ padding: 8, borderBottom: "1px solid #f2f2f2", whiteSpace: "nowrap" }}>
                    {entityLabel(l.entityType)}
                  </td>

                  <td style={{ padding: 8, borderBottom: "1px solid #f2f2f2", verticalAlign: "top" }}>
                    <pre style={{ margin: 0, fontSize: 10, whiteSpace: "pre-wrap" }}>
                      {safeJson(l.before)}
                    </pre>
                  </td>

                  <td style={{ padding: 8, borderBottom: "1px solid #f2f2f2", verticalAlign: "top" }}>
                    <pre style={{ margin: 0, fontSize: 10, whiteSpace: "pre-wrap" }}>
                      {safeJson(l.after)}
                    </pre>
                  </td>

                  <td style={{ padding: 8, borderBottom: "1px solid #f2f2f2", verticalAlign: "top" }}>
                    <pre style={{ margin: 0, fontSize: 10, whiteSpace: "pre-wrap" }}>
                      {safeJson(l.metadata)}
                    </pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
