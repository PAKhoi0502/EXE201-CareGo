import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, setToken } from "../api/client.js";

const AuthContext = createContext(null);

const normalizeUser = (data) => {
  if (!data?.user) {
    return null;
  }

  return {
    ...data.user,
    companionProfile: data.user.companionProfile || data.companionProfile || null,
  };
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadMe = async () => {
      try {
        const data = await api.get("/auth/current-user");
        setUser(normalizeUser(data));
      } catch {
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    if (localStorage.getItem("carego_token")) {
      loadMe();
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (payload) => {
    const data = await api.post("/auth/login", payload);
    setToken(data.accessToken);
    setUser(normalizeUser(data));
    return normalizeUser(data);
  };

  const registerCustomer = async (payload) => {
    await api.post("/auth/signup", payload);
    return login({ email: payload.email, password: payload.password });
  };

  const registerCompanion = async (payload) => {
    await api.post("/companions/register", payload);
    return login({ email: payload.email, password: payload.password });
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  const value = useMemo(
    () => ({ user, loading, login, registerCustomer, registerCompanion, logout }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
