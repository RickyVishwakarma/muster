import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, getAuthToken, setAuthToken, setUnauthorizedHandler } from "./api";
import type { User } from "./types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, name: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // A 401 from any request clears the session.
    setUnauthorizedHandler(() => {
      setAuthToken(null);
      setUser(null);
    });

    // Restore a session from a stored token on load.
    if (getAuthToken()) {
      api
        .me()
        .then(setUser)
        .catch(() => setAuthToken(null))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  async function login(email: string, password: string) {
    const { token, user } = await api.login(email, password);
    setAuthToken(token);
    setUser(user);
  }

  async function register(email: string, name: string, password: string) {
    const { token, user } = await api.register(email, name, password);
    setAuthToken(token);
    setUser(user);
  }

  function logout() {
    setAuthToken(null);
    setUser(null);
  }

  const value = useMemo(
    () => ({ user, loading, login, register, logout }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
