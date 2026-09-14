"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { session } from "@/lib/api";
import { api } from "@/lib/api";

type AuthContextValue = {
  ready: boolean;
  authenticated: boolean;
  username: string;
  login: (username: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const PUBLIC_ROUTES = new Set(["/login", "/register"]);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [username, setUsername] = useState("");
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    let active = true;
    void api.session().then((valid) => {
    if (!active) return;
    const storedUser = session.username() || "Trader";
    setAuthenticated(valid);
    setUsername(storedUser);
    setReady(true);
    if (!valid && !PUBLIC_ROUTES.has(pathname)) router.replace("/login");
    if (valid && PUBLIC_ROUTES.has(pathname)) router.replace("/");
    });
    return () => { active = false; };
  }, [pathname, router]);

  const login = useCallback((user: string) => {
    session.set(user);
    setUsername(user);
    setAuthenticated(true);
    router.replace("/");
  }, [router]);

  const logout = useCallback(() => {
    void api.signout();
    session.clear();
    setAuthenticated(false);
    setUsername("");
    router.replace("/login");
  }, [router]);

  const value = useMemo(() => ({ ready, authenticated, username, login, logout }), [ready, authenticated, username, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}

export function Protected({ children }: { children: React.ReactNode }) {
  const { ready, authenticated } = useAuth();
  if (!ready || !authenticated) {
    return <div className="boot-screen"><div className="brand-mark">N</div><div className="boot-line" /></div>;
  }
  return <>{children}</>;
}
