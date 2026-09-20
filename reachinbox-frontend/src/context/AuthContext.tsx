import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { User } from "../types/auth.types";
import { getCurrentUser, devLogin as devLoginApi, googleLoginUrl } from "../api/auth.api";
import { getToken, setToken, clearToken, registerUnauthorizedHandler } from "../api/client";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  loginWithGoogle: () => void;
  loginAsDev: () => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    try {
      const current = await getCurrentUser();
      setUser(current);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    registerUnauthorizedHandler(() => setUser(null));
    void refreshUser();
  }, [refreshUser]);

  const loginWithGoogle = useCallback(() => {
    // Real backend OAuth redirect — see spec §4/§5. Not a mocked login.
    window.location.href = googleLoginUrl();
  }, []);

  const loginAsDev = useCallback(async () => {
    const result = await devLoginApi();
    setToken(result.token);
    await refreshUser();
  }, [refreshUser]);

  const logout = useCallback(() => {
    // The backend is JWT-based and stateless — there is no server-side session to
    // revoke, so there is no POST /api/auth/logout endpoint to call. Logging out
    // is simply discarding the locally-held token.
    clearToken();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, isLoading, isAuthenticated: !!user, loginWithGoogle, loginAsDev, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
