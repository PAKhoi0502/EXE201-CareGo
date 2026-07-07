import { useCallback, useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router";
import CareGoLogo from "../components/CareGoLogo.jsx";
import { useAuth } from "../context/useAuth.js";
import { connectLocationSocket, locationSocket } from "../socket/locationSocket.js";

const ADMIN_ALERT_LIMIT = 3;
const ADMIN_ALERT_TTL_MS = 10000;

const adminAlertToneClasses = {
  urgent: "border-rose-200 bg-rose-50 text-rose-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  info: "border-sky-200 bg-white/95 text-slate-700",
};

const adminLinks = [
  { label: "Tổng quan", to: "/admin" },
  { label: "Người dùng", to: "/admin/users" },
  { label: "Người đồng hành", to: "/admin/companions" },
  { label: "Booking", to: "/admin/bookings" },
  { label: "Blog", to: "/admin/blogs" },
  { label: "Dịch vụ", to: "/admin/services" },
  { label: "Yêu cầu rút tiền", to: "/admin/withdrawals" },
  { label: "Hỗ trợ", to: "/admin/support" },
  { label: "Báo cáo", to: "/admin/reports" },
  { label: "Nhật ký hoạt động", to: "/admin/audit-logs" },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [adminAlerts, setAdminAlerts] = useState([]);
  const alertTimers = useRef(new Map());

  const dismissAdminAlert = useCallback((alertId) => {
    const timer = alertTimers.current.get(alertId);
    if (timer) window.clearTimeout(timer);
    alertTimers.current.delete(alertId);
    setAdminAlerts((current) => current.filter((item) => item.id !== alertId));
  }, []);

  useEffect(() => {
    if (user?.role !== "admin") return undefined;

    const handleAdminAlert = ({ alert }) => {
      if (!alert) return;
      const alertId = alert.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const nextAlert = {
        id: alertId,
        type: alert.type || "admin_alert",
        title: alert.title || "Có cập nhật mới",
        message: alert.message || "Có sự kiện mới cần admin kiểm tra.",
        tone: alert.tone || "info",
        link: alert.link || "",
        createdAt: alert.createdAt || new Date().toISOString(),
      };

      setAdminAlerts((current) => [
        nextAlert,
        ...current.filter((item) => item.id !== alertId),
      ].slice(0, ADMIN_ALERT_LIMIT));

      const currentTimer = alertTimers.current.get(alertId);
      if (currentTimer) window.clearTimeout(currentTimer);
      alertTimers.current.set(
        alertId,
        window.setTimeout(() => dismissAdminAlert(alertId), ADMIN_ALERT_TTL_MS),
      );
    };

    locationSocket.on("admin:alert", handleAdminAlert);
    connectLocationSocket();

    return () => {
      locationSocket.off("admin:alert", handleAdminAlert);
    };
  }, [dismissAdminAlert, user?.role]);

  useEffect(() => () => {
    alertTimers.current.forEach((timer) => window.clearTimeout(timer));
    alertTimers.current.clear();
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const openAdminAlert = (alert) => {
    if (!alert.link) return;
    dismissAdminAlert(alert.id);
    navigate(alert.link);
  };

  return (
    <div className="min-h-screen bg-[#f5fbfa] text-slate-900">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r border-teal-900/10 bg-gradient-to-b from-teal-100 via-teal-50 to-emerald-100 shadow-xl shadow-teal-900/10 lg:flex">
        <div className="flex h-20 items-center gap-3 border-b border-teal-900/10 px-6">
          <CareGoLogo
            subtitle="Admin"
            imageClassName="h-12 w-12"
            subtitleClassName="block text-xs font-bold uppercase tracking-wide text-slate-400"
          />
        </div>

        <nav className="space-y-2 p-4">
          {adminLinks.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/admin"}
              className={({ isActive }) =>
                [
                  "flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-extrabold transition",
                  isActive
                    ? "bg-teal-50 text-teal-700 shadow-sm"
                  : "text-slate-600 hover:bg-teal-50/70 hover:text-teal-700",
                ].join(" ")
              }
            >
              <span>{item.label}</span>
              {/* {item.to === "/admin/withdrawals" && (
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-700">
                  mới
                </span>
              )} */}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto p-4">
          {adminAlerts.length > 0 ? (
            <div className="mb-3 space-y-2" aria-live="polite">
              {adminAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`rounded-2xl border p-3 shadow-sm shadow-teal-900/5 ${adminAlertToneClasses[alert.tone] || adminAlertToneClasses.info}`}
                >
                  <p className="text-xs font-black uppercase tracking-wide">{alert.title}</p>
                  <p className="mt-1 text-xs font-semibold leading-5">{alert.message}</p>
                  <div className="mt-3 flex items-center gap-2">
                    {alert.link ? (
                      <button
                        type="button"
                        onClick={() => openAdminAlert(alert)}
                        className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-black text-slate-700 ring-1 ring-current/10 transition hover:bg-white"
                      >
                        Xem
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => dismissAdminAlert(alert.id)}
                      className="rounded-full bg-white/70 px-3 py-1 text-[11px] font-black text-current ring-1 ring-current/10 transition hover:bg-white"
                    >
                      Đóng
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleLogout}
            className="w-full rounded-2xl border border-red-100 bg-white/90 px-5 py-3 text-sm font-extrabold text-red-600 shadow-sm shadow-teal-900/5 transition hover:border-red-200 hover:bg-red-50"
          >
            Đăng xuất
          </button>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-teal-900/10 bg-[#f5fbfa]/90 backdrop-blur-xl">
          <div className="flex min-h-20 flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="lg:hidden">
              <CareGoLogo
                subtitle="Admin"
                className="flex items-center gap-3 text-xl font-black text-teal-700"
                subtitleClassName="block text-xs font-bold text-slate-400"
              />
            </div>

            <div className="flex gap-2 overflow-x-auto lg:hidden">
              {adminLinks.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/admin"}
                  className={({ isActive }) =>
                    [
                      "shrink-0 rounded-full px-4 py-2 text-xs font-extrabold",
                      isActive
                        ? "bg-teal-600 text-white"
                        : "bg-white text-slate-600 ring-1 ring-teal-100",
                    ].join(" ")
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>

            <div className="hidden lg:block">
              <p className="text-sm font-bold text-slate-400">Hệ thống quản trị</p>
              <h1 className="text-2xl font-black text-slate-900">CareGo Admin</h1>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="rounded-full border border-teal-100 bg-white px-5 py-2.5 text-sm font-extrabold text-slate-600 shadow-sm shadow-teal-900/5 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 lg:hidden"
            >
              Đăng xuất
            </button>
          </div>
        </header>

        <main className="p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
