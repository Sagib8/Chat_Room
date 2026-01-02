import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import * as AuthAPI from "../api/auth";

const AVATAR_OPTIONS = [
  { label: "Avatar 1", value: "/avatars/avatar-01.jpg" },
  { label: "Avatar 2", value: "/avatars/avatar-02.jpg" },
  { label: "Avatar 3", value: "/avatars/avatar-03.avif" },
  { label: "Avatar 4", value: "/avatars/avatar-04.jpg" },
  { label: "Avatar 5", value: "/avatars/avatar-05.avif" },
  { label: "Avatar 6", value: "/avatars/avatar-06.webp" },
];

export function RegisterPage() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(AVATAR_OPTIONS[0].value);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const u = username.trim();
    if (!u || password.length < 8) {
      setError("Username is required and password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      await AuthAPI.register(u, password, avatarUrl);
      navigate("/login", { replace: true });
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || "Registration failed";
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "64px auto", fontFamily: "sans-serif" }}>
      <h2 style={{ marginBottom: 16 }}>Register</h2>

      {error && <div style={{ marginBottom: 12, color: "crimson" }}>{error}</div>}

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 10 }}>
        <input
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          style={{ padding: 10 }}
        />
        <input
          placeholder="Password (min 8 chars)"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ padding: 10 }}
        />

        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontSize: 14, opacity: 0.8 }}>Pick a profile vibe</div>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(64px, 1fr))" }}>
            {AVATAR_OPTIONS.map((opt) => {
              const selected = avatarUrl === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setAvatarUrl(opt.value)}
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

        <button disabled={loading} style={{ padding: 10 }}>
          {loading ? "Creating..." : "Create account"}
        </button>
      </form>

      <div style={{ marginTop: 12, fontSize: 14 }}>
        Already have an account? <Link to="/login">Login</Link>
      </div>
    </div>
  );
}
