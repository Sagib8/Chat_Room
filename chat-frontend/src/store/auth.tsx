import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { setAccessToken } from "../api/http";
import * as AuthAPI from "../api/auth";
import type { Role } from "../api/auth";

type AuthState = {
  accessToken: string | null;
  role: Role | null;
  bootstrapping: boolean;
};

type AuthContextValue = {
  accessToken: string | null;
  role: Role | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  bootstrapping: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    accessToken: null,
    role: null,
    bootstrapping: true,
  });

  /**
   * Session restore on app start:
   * - If refresh cookie exists -> get a new access token
   * - Otherwise -> stay logged out
   */
  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const { accessToken, role } = await AuthAPI.refresh();
        if (cancelled) return;

        setAccessToken(accessToken);
        setState({ accessToken, role: role ?? null, bootstrapping: false });
      } catch {
        if (cancelled) return;

        setAccessToken(null);
        setState({ accessToken: null, role: null, bootstrapping: false });
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const isAuthenticated = Boolean(state.accessToken);
    const isAdmin = state.role === "ADMIN";

    return {
      accessToken: state.accessToken,
      role: state.role,
      isAuthenticated,
      isAdmin,
      bootstrapping: state.bootstrapping,

      async login(username: string, password: string) {
        const { accessToken, role } = await AuthAPI.login(username, password);
        setAccessToken(accessToken);
        setState({ accessToken, role: role ?? null, bootstrapping: false });
      },

      async logout() {
        try {
          await AuthAPI.logout();
        } finally {
          setAccessToken(null);
          setState({ accessToken: null, role: null, bootstrapping: false });
        }
      },
    };
  }, [state.accessToken, state.role, state.bootstrapping]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}