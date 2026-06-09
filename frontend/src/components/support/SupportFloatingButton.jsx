import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import { api } from "../../api/client.js";
import { useAuth } from "../../context/AuthContext.jsx";
import SupportChatPanel from "./SupportChatPanel.jsx";

export default function SupportFloatingButton() {
  const { user } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [conversation, setConversation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ subject: "", message: "" });
  const containerRef = useRef(null);
  const supportPath = user?.role === "companion" ? "/companion/support" : "/customer/support";

  useEffect(() => {
    if (!open || conversation) return;

    setLoading(true);
    setError("");
    api
      .get("/support/my-conversations")
      .then((data) => {
        const conversations = data.conversations || [];
        const activeConversation =
          conversations.find((item) => item.status !== "resolved") || null;
        setConversation(activeConversation);
      })
      .catch((loadError) => setError(loadError.message))
      .finally(() => setLoading(false));
  }, [open, conversation]);

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

  const createConversation = async (event) => {
    event.preventDefault();
    if (!form.subject.trim() || !form.message.trim()) return;

    setCreating(true);
    setError("");
    try {
      const data = await api.post("/support/conversations", {
        subject: form.subject,
        message: form.message,
        category: "other",
        priority: "normal",
      });
      setConversation(data.conversation);
      setForm({ subject: "", message: "" });
    } catch (createError) {
      setError(createError.message);
    } finally {
      setCreating(false);
    }
  };

  if (!user || user.role === "admin" || location.pathname.endsWith("/support")) return null;

  return (
    <div ref={containerRef} className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3 sm:bottom-7 sm:right-7">
      {open ? (
        <section className="w-[min(390px,calc(100vw-32px))] overflow-hidden rounded-[26px] border border-teal-100 bg-white shadow-2xl shadow-teal-950/20">
          <header className="flex items-center justify-between gap-3 bg-gradient-to-br from-teal-700 to-cyan-500 px-4 py-3 text-white">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-teal-100">CareGo Support</p>
              <h2 className="mt-0.5 font-black">Chat trực tiếp với Admin</h2>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to={supportPath}
                onClick={() => setOpen(false)}
                className="rounded-full bg-white/15 px-3 py-2 text-xs font-black transition hover:bg-white/25"
              >
                Mở rộng
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Đóng hỗ trợ"
                className="grid h-8 w-8 place-items-center rounded-full bg-white/15 text-lg font-bold transition hover:bg-white/25"
              >
                ×
              </button>
            </div>
          </header>

          {loading ? (
            <div className="grid h-[430px] place-items-center text-sm font-bold text-slate-400">
              Đang tải cuộc trò chuyện...
            </div>
          ) : conversation ? (
            <SupportChatPanel
              compact
              conversation={conversation}
              onConversationChange={setConversation}
            />
          ) : (
            <form onSubmit={createConversation} className="grid gap-3 p-4">
              <div className="rounded-2xl border border-teal-100 bg-teal-50/70 p-3 text-sm leading-6 text-slate-600">
                Bạn chưa có cuộc trò chuyện đang mở. Hãy gửi nội dung để bắt đầu chat với Admin.
              </div>
              <input
                value={form.subject}
                onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))}
                placeholder="Chủ đề cần hỗ trợ"
                className="min-h-11 rounded-2xl border border-teal-100 px-4 text-sm outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
              />
              <textarea
                value={form.message}
                onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
                placeholder="Mô tả vấn đề của bạn..."
                className="min-h-28 resize-none rounded-2xl border border-teal-100 px-4 py-3 text-sm outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
              />
              {error ? <p className="text-xs font-bold text-red-600">{error}</p> : null}
              <button
                type="submit"
                disabled={creating || !form.subject.trim() || !form.message.trim()}
                className="min-h-11 rounded-2xl bg-teal-700 px-4 text-sm font-black text-white transition hover:bg-teal-800 disabled:opacity-50"
              >
                {creating ? "Đang gửi..." : "Bắt đầu chat"}
              </button>
            </form>
          )}
        </section>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label="Mở hỗ trợ CareGo"
        aria-expanded={open}
        className="group flex h-14 items-center gap-3 rounded-full bg-teal-700 px-4 text-white shadow-2xl shadow-teal-900/30 transition hover:-translate-y-1 hover:bg-teal-800 sm:h-16 sm:px-5"
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0" fill="none" aria-hidden="true">
          <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12a8 8 0 0 1 16 0v5a2 2 0 0 1-2 2h-3m-6 0H6a2 2 0 0 1-2-2v-5" />
            <path d="M4 12h3v5H4m16-5h-3v5h3M9 21h6" />
          </g>
        </svg>
        <span className="hidden text-left sm:block">
          <span className="block text-sm font-black">Hỗ trợ</span>
          <span className="block text-[10px] font-semibold text-white/70">Chat với Admin</span>
        </span>
      </button>
    </div>
  );
}
