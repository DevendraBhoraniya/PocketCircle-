import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";

import { apiClient, setUnauthorizedCallback } from "../api/client";
import { AuthContext } from "./auth-context";
import type { User } from "./auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Register unauthorized callback to reset user when refresh token is invalid
  useEffect(() => {
    setUnauthorizedCallback(() => {
      setUser(null);
    });
    return () => {
      setUnauthorizedCallback(null);
    };
  }, []);

  const checkAuth = useCallback(async () => {
    try {
      // apiClient automatically intercepts 401 and refreshes session if expired
      const response = await apiClient("/auth/me");

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
  }, []);

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

  const logoutAll = useCallback(async () => {
    try {
      const response = await apiClient("/auth/logout-all", { method: "POST" });
      if (!response.ok) {
        return false;
      }

      setUser(null);
      return true;
    } catch (error) {
      console.error("Logout all failed", error);
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
    <AuthContext.Provider value={{ user, loading, checkAuth, logout, logoutAll }}>
      {children}
    </AuthContext.Provider>
  );
}

