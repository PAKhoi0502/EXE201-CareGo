import { useCallback, useEffect, useMemo, useState } from "react";
import { api, setToken } from "../api/client.js";
import AuthContext from "./auth-context.js";
import { connectLocationSocket, locationSocket } from "../socket/locationSocket.js";
import { isApprovedCompanion } from "../utils/authNavigation.js";

const normalizeUser = (data) => {
  if (!data?.user) {
    return null;
  }

  return {
    ...data.user,
    companionProfile: data.user.companionProfile || data.companionProfile || null,
    companionApplication: data.user.companionApplication || data.companionApplication || null,
  };
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem("carego_token")));
  const userId = user?.id || user?._id;
  const isApprovedCompanionUser = isApprovedCompanion(user);

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

  const registerCustomer = async (payload) => api.post("/auth/signup", payload);

  const registerCompanion = useCallback(async (payload) => {
    if (!user) {
      throw new Error("Vui lÃ²ng Ä‘Äƒng nháº­p báº±ng tÃ i khoáº£n customer trÆ°á»›c khi Ä‘Äƒng kÃ½ companion.");
    }

    const data = await api.post("/companions/me/apply", payload);
    const nextUser = normalizeUser(data);
    setUser(nextUser);
    return nextUser;
  }, [user]);

  const resubmitCompanionApplication = useCallback(async (payload) => {
    if (!user) {
      throw new Error("Vui lÃ²ng Ä‘Äƒng nháº­p báº±ng tÃ i khoáº£n customer trÆ°á»›c khi gá»­i láº¡i há»“ sÆ¡.");
    }

    const data = await api.patch("/companions/me/application", payload);
    const nextUser = normalizeUser(data);
    setUser(nextUser);
    return nextUser;
  }, [user]);

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

  const requestCompanionPhoneOtp = async (phone) =>
    api.post("/companions/me/phone-otp/request", { phone });

  const verifyCompanionPhoneOtp = async (otp) => {
    const data = await api.post("/companions/me/phone-otp/verify", { otp });
    const nextUser = normalizeUser(data);
    setUser(nextUser);
    return nextUser;
  };

  const changeInitialPassword = useCallback(async (payload) => {
    const data = await api.patch("/auth/current-user/initial-password", payload);
    const nextUser = normalizeUser(data);
    setUser(nextUser);
    return nextUser;
  }, []);

  const verifyEmail = async (payload) => api.post("/auth/verify-email", payload);
  const resendOtp = async (email) => api.post("/auth/resend-otp", { email });

  const clearClientSession = useCallback(() => {
    if (userId) {
      if (isApprovedCompanionUser) {
        locationSocket.emit("companion:gps:stop", { companionId: userId });
      }
      locationSocket.emit("user:offline");
      locationSocket.disconnect();
    }
    setToken(null);
    setUser(null);
  }, [isApprovedCompanionUser, userId]);

  const logout = useCallback(async () => {
    clearClientSession();

    try {
      await api.post("/auth/logout", {});
    } catch {
      return null;
    }

    return null;
  }, [clearClientSession]);

  useEffect(() => {
    if (!userId || user?.mustChangePassword) return undefined;

    const markOnline = () => {
      locationSocket.emit("user:online", { userId });
    };

    connectLocationSocket();
    if (locationSocket.connected) {
      markOnline();
    }
    locationSocket.on("connect", markOnline);

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
      locationSocket.off("connect", markOnline);
      locationSocket.emit("user:offline");
    };
  }, [user, userId]);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      registerCustomer,
      registerCompanion,
      resubmitCompanionApplication,
      updateProfile,
      updateCompanionProfile,
      requestCompanionPhoneOtp,
      verifyCompanionPhoneOtp,
      changeInitialPassword,
      verifyEmail,
      resendOtp,
      logout,
    }),
    [user, loading, logout, registerCompanion, resubmitCompanionApplication, changeInitialPassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
