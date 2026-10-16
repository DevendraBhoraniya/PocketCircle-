import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";

import { apiClient } from "../api/client";
import { AuthContext } from "./auth-context";
import type { User } from "./auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    const response = await apiClient("/auth/refresh", { method: "POST" });
    return response.ok;
  }, []);

  const checkAuth = useCallback(async () => {
    try {
      let response = await apiClient("/auth/me");

      if (response.status === 401 && await refreshSession()) {
        response = await apiClient("/auth/me");
      }

      if (response.ok) {
        const data: { user: User } = await response.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error("Auth check failed", error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [refreshSession]);

  const logout = useCallback(async () => {
    try {
      const response = await apiClient("/auth/logout", { method: "POST" });
      if (!response.ok) {
        return false;
      }

      setUser(null);
      return true;
    } catch (error) {
      console.error("Logout failed", error);
      return false;
    }
  }, []);

  useEffect(() => {
    const loadSession = async () => {
      await checkAuth();
    };

    void loadSession();
  }, [checkAuth]);

  return (
    <AuthContext.Provider value={{ user, loading, checkAuth, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
