import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, setToken } from "../api/client.js";
import { connectLocationSocket, locationSocket } from "../socket/locationSocket.js";

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
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem("carego_token")));
  const userId = user?.id || user?._id;
  const isCompanion = user?.role === "companion";

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

  const updateProfile = async (payload) => {
    const data = await api.patch("/auth/current-user", payload);
    const nextUser = normalizeUser(data);
    setUser(nextUser);
    return nextUser;
  };

  const updateCompanionProfile = async (payload) => {
    const data = await api.patch("/companions/me", payload);
    const nextUser = normalizeUser(data);
    setUser(nextUser);
    return nextUser;
  };

  const verifyEmail = async (payload) => {
    return api.post("/auth/verify-email", payload);
  };

  const resendOtp = async (email) => {
    return api.post("/auth/resend-otp", { email });
  };

  const logout = useCallback(() => {
    if (userId) {
      if (isCompanion) {
        locationSocket.emit("companion:gps:stop", { companionId: userId });
      }
      locationSocket.emit("user:offline");
      locationSocket.disconnect();
    }
    setToken(null);
    setUser(null);
  }, [isCompanion, userId]);

  useEffect(() => {
    if (!userId) return undefined;

    connectLocationSocket();
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

  useEffect(() => {
    if (!userId || !isCompanion) return undefined;

    connectLocationSocket();

    if (!navigator.geolocation) {
      locationSocket.emit("companion:gps:stop", { companionId: userId });
      return undefined;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        locationSocket.emit("companion:gps:update", {
          companionId: userId,
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => {
        locationSocket.emit("companion:gps:stop", { companionId: userId });
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 15000,
      },
    );

    const stopGps = () => {
      locationSocket.emit("companion:gps:stop", { companionId: userId });
    };

    window.addEventListener("beforeunload", stopGps);

    return () => {
      navigator.geolocation.clearWatch(watchId);
      window.removeEventListener("beforeunload", stopGps);
      stopGps();
    };
  }, [userId, isCompanion]);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      registerCustomer,
      registerCompanion,
      updateProfile,
      updateCompanionProfile,
      verifyEmail,
      resendOtp,
      logout,
    }),
    [user, loading, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
