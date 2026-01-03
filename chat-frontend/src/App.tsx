import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./store/auth";
import { LoginPage } from "./pages/Login";
import { ChatPage } from "./pages/Chat";
import { AuditPage } from "./pages/AuditPage";
import { RegisterPage } from "./pages/Register";
import { AdminUsersPage } from "./pages/AdminUsers";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, bootstrapping } = useAuth();

  // Avoid redirecting before we know if refresh cookie exists
  if (bootstrapping) return <div style={{ padding: 24 }}>Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return <>{children}</>;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAdmin, bootstrapping } = useAuth();

  if (bootstrapping) return <div style={{ padding: 24 }}>Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/chat" replace />;

  return <>{children}</>;
}

function AppRoutes() {
  const { isAuthenticated, bootstrapping } = useAuth();

  if (bootstrapping) return <div style={{ padding: 24 }}>Loading...</div>;

  return (
    <Routes>
      <Route path="/" element={<Navigate to={isAuthenticated ? "/chat" : "/login"} replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route
        path="/chat"
        element={
          <RequireAuth>
            <ChatPage />
          </RequireAuth>
        }
      />

      <Route
        path="/audit"
        element={
          <RequireAdmin>
            <AuditPage />
          </RequireAdmin>
        }
      />
      <Route
        path="/admin"
        element={
          <RequireAdmin>
            <AdminUsersPage />
          </RequireAdmin>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
