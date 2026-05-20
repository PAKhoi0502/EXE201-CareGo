import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, setToken } from "../api/client.js";
import { locationSocket } from "../socket/locationSocket.js";

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
  const userId = user?.id || user?._id;

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
    return api.post("/auth/signup", payload);
  };

  const registerCompanion = async (payload) => {
    return api.post("/companions/register", payload);
  };

  const verifyEmail = async (payload) => {
    return api.post("/auth/verify-email", payload);
  };

  const resendOtp = async (email) => {
    return api.post("/auth/resend-otp", { email });
  };

  const logout = () => {
    if (userId) {
      locationSocket.emit("user:offline");
      locationSocket.disconnect();
    }
    setToken(null);
    setUser(null);
  };

  useEffect(() => {
    if (!userId) return undefined;

    locationSocket.connect();
    locationSocket.emit("user:online", { userId });

    const heartbeat = setInterval(() => {
      locationSocket.emit("user:heartbeat", { userId });
    }, 15000);

    const markOffline = () => {
      locationSocket.emit("user:offline");
    };

    window.addEventListener("beforeunload", markOffline);

    return () => {
      clearInterval(heartbeat);
      window.removeEventListener("beforeunload", markOffline);
      locationSocket.emit("user:offline");
    };
  }, [userId]);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      registerCustomer,
      registerCompanion,
      verifyEmail,
      resendOtp,
      logout,
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
