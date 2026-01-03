import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listUsers, createUser, updateRole, deleteUser, type User } from "../api/users";
import type { Role } from "../api/auth";
import { useAuth } from "../store/auth";

type CreateForm = {
  username: string;
  password: string;
  role: Role;
  avatarUrl: string;
};

const AVATAR_OPTIONS = [
  { label: "Avatar 1", value: "/avatars/avatar-01.jpg" },
  { label: "Avatar 2", value: "/avatars/avatar-02.jpg" },
  { label: "Avatar 3", value: "/avatars/avatar-03.avif" },
  { label: "Avatar 4", value: "/avatars/avatar-04.jpg" },
  { label: "Avatar 5", value: "/avatars/avatar-05.avif" },
  { label: "Avatar 6", value: "/avatars/avatar-06.webp" },
];

export function AdminUsersPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);

  const [createForm, setCreateForm] = useState<CreateForm>({
    username: "",
    password: "",
    role: "USER",
    avatarUrl: AVATAR_OPTIONS[0].value,
  });
  const [creating, setCreating] = useState(false);

  async function loadUsers() {
    setUsersError(null);
    setLoadingUsers(true);
    try {
      const data = await listUsers();
      setUsers(data);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || "Failed to load users";
      setUsersError(String(msg));
    } finally {
      setLoadingUsers(false);
    }
  }

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setUsersError(null);
    setCreating(true);

    try {
      const payload = {
        username: createForm.username.trim(),
        password: createForm.password,
        role: createForm.role,
        avatarUrl: createForm.avatarUrl,
      };

      const user = await createUser(payload);
      setUsers((prev) => [...prev, user].sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
      setCreateForm({ username: "", password: "", role: "USER", avatarUrl: AVATAR_OPTIONS[0].value });
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || "Failed to create user";
      setUsersError(String(msg));
    } finally {
      setCreating(false);
    }
  }

  async function handleRoleChange(id: string, role: Role) {
    setUsersError(null);
    try {
      const updated = await updateRole(id, role);
      setUsers((prev) => prev.map((u) => (u.id === id ? updated : u)));
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || "Failed to update role";
      setUsersError(String(msg));
    }
  }

  async function handleDeleteUser(id: string) {
    if (!window.confirm("Delete this user? Their access will be revoked.")) return;

    setUsersError(null);
    try {
      await deleteUser(id);
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || "Failed to delete user";
      setUsersError(String(msg));
    }
  }

  return (
    <div style={{ maxWidth: 1200, margin: "24px auto", padding: "0 16px", display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>Admin Panel</h2>

        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={() => navigate("/chat")}>
            Chat
          </button>
          <button type="button" onClick={() => navigate("/audit")}>
            Audit
          </button>
          <button type="button" onClick={logout}>
            Logout
          </button>
        </div>
      </div>

      <section className="surface" style={{ padding: 12 }}>
        <h3 style={{ marginTop: 0 }}>Create user</h3>
        {usersError && <div style={{ color: "crimson", marginBottom: 8 }}>{usersError}</div>}
        <form onSubmit={handleCreate} style={{ display: "grid", gap: 8, maxWidth: 520 }}>
          <label style={{ display: "grid", gap: 4 }}>
            Username
            <input
              required
              minLength={3}
              value={createForm.username}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, username: e.target.value }))}
            />
          </label>

          <label style={{ display: "grid", gap: 4 }}>
            Password
            <input
              required
              minLength={8}
              type="password"
              value={createForm.password}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, password: e.target.value }))}
            />
          </label>

          <label style={{ display: "grid", gap: 4 }}>
            Role
            <select
              value={createForm.role}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, role: e.target.value as Role }))}
            >
              <option value="USER">User</option>
              <option value="ADMIN">Admin</option>
            </select>
          </label>

          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontSize: 14, opacity: 0.8 }}>Avatar</div>
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(64px, 1fr))" }}>
              {AVATAR_OPTIONS.map((opt) => {
                const selected = createForm.avatarUrl === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setCreateForm((prev) => ({ ...prev, avatarUrl: opt.value }))}
                    style={{
                      border: selected ? "2px solid #2563eb" : "1px solid #ddd",
                      padding: 6,
                      borderRadius: 12,
                      background: selected ? "rgba(37,99,235,0.08)" : "transparent",
                      display: "block",
                    }}
                    aria-pressed={selected}
                    aria-label={opt.label}
                  >
                    <img
                      src={opt.value}
                      alt={opt.label}
                      style={{ width: "100%", height: 72, borderRadius: 10, objectFit: "cover" }}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          <button type="submit" disabled={creating}>
            {creating ? "Creating..." : "Create"}
          </button>
        </form>
      </section>

      <section className="surface" style={{ padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ marginTop: 0 }}>Users</h3>
          <button type="button" onClick={loadUsers} disabled={loadingUsers}>
            {loadingUsers ? "Loading..." : "Refresh"}
          </button>
        </div>
        {usersError && <div style={{ color: "crimson", marginBottom: 8 }}>{usersError}</div>}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "6px 8px" }}>Username</th>
                <th style={{ textAlign: "left", padding: "6px 8px" }}>Role</th>
                <th style={{ textAlign: "left", padding: "6px 8px" }}>Created</th>
                <th style={{ textAlign: "left", padding: "6px 8px" }}>Last login</th>
                <th style={{ textAlign: "left", padding: "6px 8px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ borderTop: "1px solid #ddd" }}>
                  <td style={{ padding: "6px 8px" }}>{u.username}</td>
                  <td style={{ padding: "6px 8px" }}>{u.role}</td>
                  <td style={{ padding: "6px 8px" }}>{new Date(u.createdAt).toLocaleString()}</td>
                  <td style={{ padding: "6px 8px" }}>
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "-"}
                  </td>
                  <td style={{ padding: "6px 8px", display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button type="button" onClick={() => handleRoleChange(u.id, u.role === "ADMIN" ? "USER" : "ADMIN")}>
                      {u.role === "ADMIN" ? "Make User" : "Make Admin"}
                    </button>
                    <button type="button" onClick={() => handleDeleteUser(u.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
