import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useNotifications } from "../../context/NotificationContext.jsx";

const typeStyles = {
  CUSTOMER_WELCOME: "bg-emerald-50 text-emerald-700",
  BOOKING_CREATED: "bg-teal-50 text-teal-700",
  BOOKING_ACCEPTED: "bg-sky-50 text-sky-700",
  COMPANION_CHECKED_IN: "bg-indigo-50 text-indigo-700",
  SHIFT_NOTE_UPDATED: "bg-amber-50 text-amber-700",
  BOOKING_COMPLETED: "bg-violet-50 text-violet-700",
  PAYMENT_REMINDER: "bg-rose-50 text-rose-700",
  PAYMENT_SUCCESS: "bg-emerald-50 text-emerald-700",
  REVIEW_REMINDER: "bg-orange-50 text-orange-700",
};

const timeFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const formatNotificationTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return timeFormatter.format(date);
};

const BellIcon = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </g>
  </svg>
);

const NotificationBell = () => {
  const {
    notifications,
    unreadCount,
    loading,
    error,
    toast,
    markAsRead,
    markAllAsRead,
    clearToast,
  } = useNotifications();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const closeOnOutsideClick = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const openNotification = async (notification) => {
    try {
      if (!notification?.readAt) {
        await markAsRead(notification._id);
      }
    } catch {
      // Navigation should still work if the read receipt request is interrupted.
    }

    setOpen(false);
    if (notification?.link) {
      navigate(notification.link);
    }
  };

  return (
    <>
      <div ref={wrapperRef} className="relative">
        <button
          type="button"
          aria-label="Thông báo"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          className="relative grid h-12 w-12 place-items-center rounded-full border border-teal-100 bg-white text-teal-700 shadow-lg shadow-teal-900/5 transition hover:border-teal-300 hover:bg-teal-50"
        >
          <BellIcon />
          {unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </button>

        {open ? (
          <div className="absolute right-0 mt-3 w-[min(360px,calc(100vw-24px))] overflow-hidden rounded-[28px] border border-teal-100 bg-white shadow-2xl shadow-teal-900/15">
            <div className="flex items-center justify-between gap-3 border-b border-teal-50 bg-gradient-to-r from-teal-50 to-sky-50 p-4">
              <div>
                <p className="text-sm font-black text-[#12312f]">Thông báo</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {unreadCount ? `${unreadCount} thông báo chưa đọc` : "Bạn đã đọc hết thông báo"}
                </p>
              </div>
              {unreadCount > 0 ? (
                <button
                  type="button"
                  onClick={() => markAllAsRead().catch(() => null)}
                  className="rounded-full bg-white px-3 py-2 text-xs font-black text-teal-700 shadow-sm transition hover:bg-teal-50"
                >
                  Đọc hết
                </button>
              ) : null}
            </div>

            <div className="max-h-[420px] overflow-y-auto p-2">
              {loading ? (
                <p className="p-4 text-sm font-semibold text-slate-500">Đang tải thông báo...</p>
              ) : null}
              {error ? (
                <p className="rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</p>
              ) : null}
              {!loading && !error && notifications.length === 0 ? (
                <p className="p-4 text-sm font-semibold text-slate-500">Chưa có thông báo nào.</p>
              ) : null}

              {notifications.map((notification) => (
                <button
                  key={notification._id}
                  type="button"
                  onClick={() => openNotification(notification)}
                  className={`mb-2 flex w-full gap-3 rounded-3xl p-3 text-left transition hover:bg-teal-50 ${
                    notification.readAt ? "bg-white" : "bg-teal-50/70"
                  }`}
                >
                  <span
                    className={`mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${
                      typeStyles[notification.type] || "bg-teal-50 text-teal-700"
                    }`}
                  >
                    <BellIcon />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <strong className="line-clamp-2 text-sm font-black text-slate-900">
                        {notification.title}
                      </strong>
                      {!notification.readAt ? (
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-rose-500" />
                      ) : null}
                    </span>
                    <span className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-slate-500">
                      {notification.message}
                    </span>
                    <span className="mt-2 block text-[11px] font-black text-teal-700">
                      {formatNotificationTime(notification.createdAt)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {toast ? (
        <button
          type="button"
          onClick={() => {
            clearToast();
            openNotification(toast);
          }}
          className="fixed right-4 top-24 z-50 w-[min(360px,calc(100vw-32px))] rounded-[26px] border border-teal-100 bg-white p-4 text-left shadow-2xl shadow-teal-900/20 transition hover:-translate-y-0.5"
        >
          <span className="text-xs font-black uppercase tracking-wide text-teal-700">Thông báo mới</span>
          <strong className="mt-1 block text-sm font-black text-slate-950">{toast.title}</strong>
          <span className="mt-1 line-clamp-2 block text-xs font-semibold leading-5 text-slate-500">
            {toast.message}
          </span>
        </button>
      ) : null}
    </>
  );
};

export default NotificationBell;
