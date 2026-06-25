import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../api/client.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { connectLocationSocket, locationSocket } from "../../socket/locationSocket.js";
import BookingChatPanel from "./BookingChatPanel.jsx";

export default function BookingChatFloatingButton() {
  const { user } = useAuth();
  const [chats, setChats] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const containerRef = useRef(null);

  const loadChats = useCallback(async () => {
    try {
      const data = await api.get("/booking-chat/active");
      const nextChats = data.chats || [];
      setChats(nextChats);
      setSelectedId((current) =>
        nextChats.some((chat) => String(chat.booking?._id) === current)
          ? current
          : String(nextChats[0]?.booking?._id || ""),
      );
      if (nextChats.length === 0) setOpen(false);
      setError("");
    } catch (loadError) {
      setError(loadError.message);
    }
  }, []);

  useEffect(() => {
    if (!user || !["customer", "companion"].includes(user.role)) return undefined;

    const initialTimer = window.setTimeout(loadChats, 0);
    connectLocationSocket();
    locationSocket.on("booking-chat:state", loadChats);
    const refreshTimer = window.setInterval(loadChats, 30000);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(refreshTimer);
      locationSocket.off("booking-chat:state", loadChats);
    };
  }, [loadChats, user]);

  useEffect(() => {
    const expiringChats = chats
      .map((chat) => (chat.expiresAt ? new Date(chat.expiresAt).getTime() : null))
      .filter((expiresAt) => expiresAt && expiresAt > Date.now());
    if (expiringChats.length === 0) return undefined;

    const delay = Math.min(...expiringChats) - Date.now();
    const timer = window.setTimeout(loadChats, delay + 100);
    return () => window.clearTimeout(timer);
  }, [chats, loadChats]);

  useEffect(() => {
    const openRequestedChat = (event) => {
      const bookingId = String(event.detail?.bookingId || "");
      if (!chats.some((chat) => String(chat.booking?._id) === bookingId)) return;
      setSelectedId(bookingId);
      setOpen(true);
    };

    window.addEventListener("carego:open-booking-chat", openRequestedChat);
    return () => window.removeEventListener("carego:open-booking-chat", openRequestedChat);
  }, [chats]);

  useEffect(() => {
    if (!open) return undefined;

    const closeOnOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const selectedChat = useMemo(
    () => chats.find((chat) => String(chat.booking?._id) === selectedId) || chats[0],
    [chats, selectedId],
  );
  const booking = selectedChat?.booking;
  const userId = String(user?.id || user?._id || "");
  const bookingCustomerId = String(booking?.customerId?._id || booking?.customerId || "");
  const counterpart = bookingCustomerId === userId ? booking?.companionId : booking?.customerId;

  const updateChat = useCallback((nextChat) => {
    if (!nextChat?.booking?._id) return;
    setChats((current) =>
      current.map((chat) =>
        String(chat.booking?._id) === String(nextChat.booking._id)
          ? {
              ...chat,
              ...nextChat,
              booking: {
                ...chat.booking,
                ...nextChat.booking,
              },
            }
          : chat,
      ),
    );
  }, []);

  if (!user || !["customer", "companion"].includes(user.role) || chats.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="fixed bottom-[86px] right-5 z-50 flex flex-col items-end gap-3 sm:bottom-[104px] sm:right-7"
    >
      {open ? (
        <section className="w-[min(390px,calc(100vw-32px))] overflow-hidden rounded-[26px] border border-teal-100 bg-white shadow-2xl shadow-teal-950/20">
          <header className="bg-gradient-to-br from-[#12312f] to-teal-600 px-4 py-3 text-white">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-wide text-teal-100">Trao đổi ca chăm sóc</p>
                <h2 className="mt-0.5 truncate font-black">
                  {counterpart?.name || "Người tham gia booking"}
                </h2>
                <p className="mt-1 truncate text-xs text-white/70">
                  {booking?.serviceId?.name || "Dịch vụ CareGo"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Đóng chat booking"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/15 text-lg font-bold transition hover:bg-white/25"
              >
                ×
              </button>
            </div>
            {chats.length > 1 ? (
              <select
                value={String(booking?._id || "")}
                onChange={(event) => setSelectedId(event.target.value)}
                className="mt-3 min-h-9 w-full rounded-xl border border-white/20 bg-white/15 px-3 text-xs font-bold text-white outline-none"
              >
                {chats.map((chat) => (
                  <option key={chat.booking._id} value={chat.booking._id} className="text-slate-900">
                    {chat.booking.serviceId?.name || "Ca chăm sóc"} - {chat.booking.elderProfileId?.fullName || "Người thân"}
                  </option>
                ))}
              </select>
            ) : null}
          </header>

          {error ? (
            <p className="border-b border-red-100 bg-red-50 px-4 py-2 text-xs font-bold text-red-600">
              {error}
            </p>
          ) : null}
          <BookingChatPanel
            key={booking?._id}
            chat={selectedChat}
            onChatChange={updateChat}
            onUnavailable={loadChats}
          />
        </section>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label="Mở chat booking"
        aria-expanded={open}
        className="group flex h-14 items-center gap-3 rounded-full bg-[#12312f] px-4 text-white shadow-2xl shadow-slate-900/30 transition hover:-translate-y-1 hover:bg-teal-900 sm:h-16 sm:px-5"
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0" fill="none" aria-hidden="true">
          <path
            d="M7 18.5 3.5 21v-5.2A8 8 0 1 1 7 18.5Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M8 10h8M8 14h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span className="hidden text-left sm:block">
          <span className="block text-sm font-black">Trao đổi ca</span>
          <span className="block text-[10px] font-semibold text-white/70">
            {chats.length > 1 ? `${chats.length} booking đang mở` : `Chat với ${counterpart?.name || "đối phương"}`}
          </span>
        </span>
      </button>
    </div>
  );
}
