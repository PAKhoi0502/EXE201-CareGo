import { useEffect, useRef, useState } from "react";
import { api } from "../../api/client.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { connectLocationSocket, locationSocket } from "../../socket/locationSocket.js";

const formatTime = (value) =>
  value
    ? new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" }).format(new Date(value))
    : "";

export default function SupportChatPanel({ conversation, onConversationChange, compact = false }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [typingName, setTypingName] = useState("");
  const bottomRef = useRef(null);
  const typingTimerRef = useRef(null);
  const userId = String(user?.id || user?._id || "");

  useEffect(() => {
    if (!conversation?._id) {
      setMessages([]);
      return undefined;
    }

    let active = true;
    setLoading(true);
    setError("");
    api
      .get(`/support/conversations/${conversation._id}/messages`)
      .then((data) => {
        if (active) setMessages(data.messages || []);
      })
      .catch((fetchError) => {
        if (active) setError(fetchError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    connectLocationSocket();
    locationSocket.emit("support:join", { conversationId: conversation._id });

    const onNewMessage = ({ message, conversation: updatedConversation }) => {
      if (String(message?.conversationId) !== String(conversation._id)) return;
      setMessages((current) =>
        current.some((item) => item._id === message._id) ? current : [...current, message],
      );
      onConversationChange?.(updatedConversation);
    };

    const onUpdated = ({ conversation: updatedConversation }) => {
      if (String(updatedConversation?._id) === String(conversation._id)) {
        onConversationChange?.(updatedConversation);
      }
    };

    const onTyping = ({ conversationId, userId: typingUserId, isTyping }) => {
      if (String(conversationId) !== String(conversation._id) || String(typingUserId) === userId) return;
      setTypingName(isTyping ? "Đối phương đang nhập..." : "");
    };

    locationSocket.on("support:new-message", onNewMessage);
    locationSocket.on("support:conversation-updated", onUpdated);
    locationSocket.on("support:typing", onTyping);

    return () => {
      active = false;
      locationSocket.emit("support:leave", { conversationId: conversation._id });
      locationSocket.off("support:new-message", onNewMessage);
      locationSocket.off("support:conversation-updated", onUpdated);
      locationSocket.off("support:typing", onTyping);
    };
  }, [conversation?._id, onConversationChange, userId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingName]);

  const handleTyping = (value) => {
    setText(value);
    if (!conversation?._id) return;
    locationSocket.emit("support:typing", {
      conversationId: conversation._id,
      userId,
      isTyping: true,
    });
    window.clearTimeout(typingTimerRef.current);
    typingTimerRef.current = window.setTimeout(() => {
      locationSocket.emit("support:typing", {
        conversationId: conversation._id,
        userId,
        isTyping: false,
      });
    }, 900);
  };

  const sendMessage = async (event) => {
    event.preventDefault();
    const message = text.trim();
    if (!message || sending || conversation?.status === "resolved") return;

    setSending(true);
    setError("");
    setText("");
    try {
      const data = await api.post(`/support/conversations/${conversation._id}/messages`, { message });
      setMessages((current) =>
        current.some((item) => item._id === data.message?._id) ? current : [...current, data.message],
      );
      onConversationChange?.(data.conversation);
    } catch (sendError) {
      setText(message);
      setError(sendError.message);
    } finally {
      setSending(false);
    }
  };

  if (!conversation) {
    return (
      <div className={`grid place-items-center border border-dashed border-teal-200 bg-white p-8 text-center ${
        compact ? "h-[430px]" : "h-[70vh] min-h-[520px] max-h-[680px] rounded-[28px]"
      }`}>
        <div>
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-teal-50 text-2xl text-teal-700">?</div>
          <p className="mt-4 font-black text-slate-800">Chọn một cuộc trò chuyện</p>
          <p className="mt-2 text-sm text-slate-500">Tin nhắn hỗ trợ sẽ hiển thị tại đây.</p>
        </div>
      </div>
    );
  }

  return (
    <section className={`flex flex-col overflow-hidden border border-teal-100 bg-white shadow-xl shadow-teal-900/5 ${
      compact ? "h-[min(520px,70vh)] rounded-none border-x-0 border-b-0 shadow-none" : "h-[70vh] min-h-[520px] max-h-[680px] rounded-[28px]"
    }`}>
      <header className={`shrink-0 border-b border-teal-100 bg-gradient-to-r from-teal-50 to-sky-50 ${compact ? "px-4 py-3" : "px-5 py-4"}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-teal-700">Hỗ trợ CareGo</p>
            <h2 className={`${compact ? "max-w-[210px] truncate text-sm" : "mt-1 text-lg"} font-black text-[#12312f]`}>{conversation.subject}</h2>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-black ${
            conversation.status === "resolved"
              ? "bg-slate-100 text-slate-600"
              : conversation.status === "active"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-amber-100 text-amber-700"
          }`}>
            {conversation.status === "resolved"
              ? "Đã giải quyết"
              : conversation.status === "active"
                ? "Đang xử lý"
                : "Chờ hỗ trợ"}
          </span>
        </div>
      </header>

      <div className={`min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain bg-[#f8fdfc] ${compact ? "p-3" : "p-5"}`}>
        {loading ? <p className="text-center text-sm font-bold text-slate-400">Đang tải tin nhắn...</p> : null}
        {messages.map((message) => {
          const senderId = String(message.senderId?._id || message.senderId || "");
          const mine = senderId === userId;
          return (
            <div key={message._id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[82%] rounded-3xl px-4 py-3 text-sm shadow-sm ${
                mine ? "rounded-br-md bg-teal-700 text-white" : "rounded-bl-md border border-teal-100 bg-white text-slate-700"
              }`}>
                <p className={`mb-1 text-[11px] font-black ${mine ? "text-white/70" : "text-teal-700"}`}>
                  {mine ? "Bạn" : message.senderId?.role === "admin" ? "CareGo Admin" : message.senderId?.name || "Người dùng"}
                </p>
                <p className="whitespace-pre-wrap leading-6">{message.message}</p>
                <p className={`mt-1 text-right text-[10px] ${mine ? "text-white/60" : "text-slate-400"}`}>
                  {formatTime(message.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
        {typingName ? <p className="text-xs font-semibold text-slate-400">{typingName}</p> : null}
        <div ref={bottomRef} />
      </div>

      {error ? <p className="shrink-0 border-t border-red-100 bg-red-50 px-5 py-2 text-xs font-bold text-red-600">{error}</p> : null}

      <form onSubmit={sendMessage} className={`flex shrink-0 gap-2 border-t border-teal-100 bg-white ${compact ? "p-3" : "p-4"}`}>
        <textarea
          value={text}
          onChange={(event) => handleTyping(event.target.value)}
          disabled={conversation.status === "resolved"}
          rows={1}
          placeholder={conversation.status === "resolved" ? "Cuộc trò chuyện đã được giải quyết" : "Nhập tin nhắn hỗ trợ..."}
          className={`${compact ? "min-h-10 px-3 py-2" : "min-h-12 px-4 py-3"} min-w-0 flex-1 resize-none rounded-2xl border border-teal-100 bg-[#fbfffe] text-sm outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-slate-100`}
        />
        <button
          type="submit"
          disabled={!text.trim() || sending || conversation.status === "resolved"}
          className={`${compact ? "min-h-10 px-4" : "min-h-12 px-5"} rounded-2xl bg-teal-700 text-sm font-black text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50`}
        >
          Gửi
        </button>
      </form>
    </section>
  );
}
