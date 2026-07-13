import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "../api/client";

interface AuthUser {
  id: string;
  email: string;
  totpEnabled?: boolean;
  mustChangePassword?: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ requiresTotp?: boolean; preAuthToken?: string }>;
  loginTotp: (preAuthToken: string, code: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshMe() {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch {
      setUser(null);
    }
  }

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (token) {
      refreshMe().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  function storeTokens(data: { accessToken: string; refreshToken: string }) {
    localStorage.setItem("accessToken", data.accessToken);
    localStorage.setItem("refreshToken", data.refreshToken);
  }

  async function login(email: string, password: string) {
    const { data } = await api.post("/auth/login", { email, password });
    if (data.requiresTotp) {
      return { requiresTotp: true, preAuthToken: data.preAuthToken };
    }
    storeTokens(data);
    setUser(data.user);
    return {};
  }

  async function loginTotp(preAuthToken: string, code: string) {
    const { data } = await api.post("/auth/login/totp", { preAuthToken, code });
    storeTokens(data);
    setUser(data.user);
  }

  async function register(email: string, password: string) {
    const { data } = await api.post("/auth/register", { email, password });
    storeTokens(data);
    setUser(data.user);
  }

  function logout() {
    localStorage.clear();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, loginTotp, register, logout, refreshMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth 必须在 AuthProvider 内使用");
  return ctx;
}
