import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../api/client.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { connectLocationSocket, locationSocket } from "../../socket/locationSocket.js";

const formatTime = (value) =>
  value
    ? new Intl.DateTimeFormat("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value))
    : "";

const formatRemaining = (expiresAt, now) => {
  if (!expiresAt) return "Đang mở";
  const remainingMinutes = Math.max(
    0,
    Math.ceil((new Date(expiresAt).getTime() - now) / 60000),
  );
  if (remainingMinutes >= 60) {
    const hours = Math.floor(remainingMinutes / 60);
    const minutes = remainingMinutes % 60;
    return minutes ? `Còn ${hours} giờ ${minutes} phút` : `Còn ${hours} giờ`;
  }
  return `Còn ${remainingMinutes} phút`;
};

export default function BookingChatPanel({ chat, onChatChange, onUnavailable }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [typing, setTyping] = useState(false);
  const [clock, setClock] = useState(() => Date.now());
  const bottomRef = useRef(null);
  const typingTimerRef = useRef(null);
  const booking = chat?.booking;
  const bookingId = String(booking?._id || "");
  const userId = String(user?.id || user?._id || "");
  const counterpart = user?.role === "companion" ? booking?.customerId : booking?.companionId;
  const canSend = Boolean(chat?.canSend) && (!chat?.expiresAt || new Date(chat.expiresAt).getTime() > clock);
  const remainingText = useMemo(
    () => formatRemaining(chat?.expiresAt, clock),
    [chat?.expiresAt, clock],
  );

  useEffect(() => {
    if (!bookingId) return undefined;

    let active = true;
    api
      .get(`/booking-chat/${bookingId}/messages`)
      .then((data) => {
        if (!active) return;
        setMessages(data.messages || []);
        onChatChange?.(data.chat);
      })
      .catch((fetchError) => {
        if (active) setError(fetchError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    connectLocationSocket();
    locationSocket.emit("booking-chat:join", { bookingId });

    const handleMessage = ({ message, chat: nextChat }) => {
      if (String(message?.bookingId) !== bookingId) return;
      setMessages((current) =>
        current.some((item) => item._id === message._id) ? current : [...current, message],
      );
      if (nextChat) onChatChange?.(nextChat);
    };

    const handleTyping = ({ bookingId: eventBookingId, userId: typingUserId, isTyping }) => {
      if (String(eventBookingId) !== bookingId || String(typingUserId) === userId) return;
      setTyping(Boolean(isTyping));
    };

    const handleState = (state) => {
      if (String(state.bookingId) !== bookingId) return;
      if (!state.isAvailable) {
        onUnavailable?.(bookingId);
        return;
      }
      onChatChange?.({
        ...state,
        booking: {
          _id: bookingId,
          status: state.status,
          completedAt: state.completedAt,
        },
      });
    };

    locationSocket.on("booking-chat:new-message", handleMessage);
    locationSocket.on("booking-chat:typing", handleTyping);
    locationSocket.on("booking-chat:state", handleState);

    return () => {
      active = false;
      window.clearTimeout(typingTimerRef.current);
      locationSocket.emit("booking-chat:leave", { bookingId });
      locationSocket.off("booking-chat:new-message", handleMessage);
      locationSocket.off("booking-chat:typing", handleTyping);
      locationSocket.off("booking-chat:state", handleState);
    };
  }, [bookingId, onChatChange, onUnavailable, userId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!chat?.expiresAt) return undefined;
    const delay = new Date(chat.expiresAt).getTime() - Date.now();
    const timer = window.setTimeout(
      () => onUnavailable?.(bookingId),
      Math.max(0, delay) + 100,
    );
    return () => window.clearTimeout(timer);
  }, [bookingId, chat?.expiresAt, onUnavailable]);

  const handleTyping = (value) => {
    setText(value);
    locationSocket.emit("booking-chat:typing", {
      bookingId,
      isTyping: true,
    });
    window.clearTimeout(typingTimerRef.current);
    typingTimerRef.current = window.setTimeout(() => {
      locationSocket.emit("booking-chat:typing", {
        bookingId,
        isTyping: false,
      });
    }, 900);
  };

  const sendMessage = async (event) => {
    event.preventDefault();
    const messageText = text.trim();
    if (!messageText || sending || !canSend) return;

    setSending(true);
    setError("");
    setText("");
    try {
      const data = await api.post(`/booking-chat/${bookingId}/messages`, {
        message: messageText,
      });
      setMessages((current) =>
        current.some((item) => item._id === data.message?._id)
          ? current
          : [...current, data.message],
      );
      onChatChange?.(data.chat);
    } catch (sendError) {
      setText(messageText);
      setError(sendError.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="flex h-[min(520px,70vh)] flex-col overflow-hidden border-x-0 border-b-0 border-t border-teal-100 bg-white">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain bg-[#f8fdfc] p-3">
        {loading ? (
          <p className="text-center text-sm font-bold text-slate-400">Đang tải tin nhắn...</p>
        ) : null}
        {!loading && messages.length === 0 ? (
          <div className="rounded-2xl border border-teal-100 bg-white p-4 text-center text-sm leading-6 text-slate-500">
            Hãy trao đổi các thông tin cần thiết cho ca chăm sóc với {counterpart?.name || "đối phương"}.
          </div>
        ) : null}
        {messages.map((message) => {
          const senderId = String(message.senderId?._id || message.senderId || "");
          const mine = senderId === userId;
          return (
            <div key={message._id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[82%] rounded-3xl px-4 py-3 text-sm shadow-sm ${
                  mine
                    ? "rounded-br-md bg-teal-700 text-white"
                    : "rounded-bl-md border border-teal-100 bg-white text-slate-700"
                }`}
              >
                <p className={`mb-1 text-[11px] font-black ${mine ? "text-white/70" : "text-teal-700"}`}>
                  {mine ? "Bạn" : message.senderId?.name || counterpart?.name || "Đối phương"}
                </p>
                <p className="whitespace-pre-wrap break-words leading-6">{message.message}</p>
                <p className={`mt-1 text-right text-[10px] ${mine ? "text-white/60" : "text-slate-400"}`}>
                  {formatTime(message.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
        {typing ? <p className="text-xs font-semibold text-slate-400">Đối phương đang nhập...</p> : null}
        <div ref={bottomRef} />
      </div>

      {chat?.expiresAt ? (
        <p className="shrink-0 border-t border-amber-100 bg-amber-50 px-4 py-2 text-center text-xs font-bold text-amber-700">
          Chat sau ca: {remainingText}
        </p>
      ) : null}
      {error ? (
        <p className="shrink-0 border-t border-red-100 bg-red-50 px-4 py-2 text-xs font-bold text-red-600">
          {error}
        </p>
      ) : null}

      <form onSubmit={sendMessage} className="flex shrink-0 gap-2 border-t border-teal-100 bg-white p-3">
        <textarea
          value={text}
          onChange={(event) => handleTyping(event.target.value)}
          disabled={!canSend}
          rows={1}
          placeholder={canSend ? "Nhập tin nhắn..." : "Cuộc trò chuyện đã đóng"}
          className="min-h-10 min-w-0 flex-1 resize-none rounded-2xl border border-teal-100 bg-[#fbfffe] px-3 py-2 text-sm outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-slate-100"
        />
        <button
          type="submit"
          disabled={!text.trim() || sending || !canSend}
          className="min-h-10 rounded-2xl bg-teal-700 px-4 text-sm font-black text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Gửi
        </button>
      </form>
    </section>
  );
}
