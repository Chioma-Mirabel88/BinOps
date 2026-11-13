import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import api from "../lib/api";

interface Organisation {
  id: string;
  name: string;
  type: string;
  role: string;
}

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  isActive?: boolean;
  organisations: Organisation[];
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function isUnauthorized(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    (error as { response?: { status?: number } }).response?.status === 401
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = async () => {
    const response = await api.get("/users/me");
    setUser(response.data.user);
  };

  const logout = () => {
    localStorage.removeItem("binops_token");
    setUser(null);
  };

  const login = async (email: string, password: string) => {
    const response = await api.post("/auth/login", { email, password });
    localStorage.setItem("binops_token", response.data.token);

    try {
      await refreshProfile();
    } catch (error) {
      if (isUnauthorized(error)) {
        logout();
      }

      throw error;
    }
  };

  useEffect(() => {
    const restoreSession = async () => {
      const token = localStorage.getItem("binops_token");

      if (!token) {
        setLoading(false);
        return;
      }

      try {
        await refreshProfile();
      } catch (error) {
        if (isUnauthorized(error)) {
          logout();
        } else {
          console.error(
            "Unable to restore BinOps session. The saved token has been retained.",
            error
          );
        }
      } finally {
        setLoading(false);
      }
    };

    void restoreSession();
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, login, logout, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
