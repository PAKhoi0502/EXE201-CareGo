import { useCallback, useEffect, useState } from "react";
import { api } from "../../api/client.js";
import SupportChatPanel from "../../components/support/SupportChatPanel.jsx";
import { connectLocationSocket, locationSocket } from "../../socket/locationSocket.js";

const categories = [
  ["booking", "Vấn đề booking"],
  ["payment", "Thanh toán / rút tiền"],
  ["account", "Tài khoản"],
  ["safety", "An toàn / SOS"],
  ["other", "Khác"],
];

export default function SupportPage() {
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ subject: "", category: "booking", priority: "normal", message: "" });

  const loadConversations = useCallback(async () => {
    try {
      setError("");
      const data = await api.get("/support/my-conversations");
      setConversations(data.conversations || []);
      setSelected((current) => {
        if (!current) return data.conversations?.[0] || null;
        return data.conversations?.find((item) => item._id === current._id) || current;
      });
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
    connectLocationSocket();
    const refresh = () => loadConversations();
    locationSocket.on("support:conversation-updated", refresh);
    return () => locationSocket.off("support:conversation-updated", refresh);
  }, [loadConversations]);

  const updateConversation = useCallback((updated) => {
    if (!updated?._id) return;
    setSelected(updated);
    setConversations((current) => {
      const next = current.filter((item) => item._id !== updated._id);
      return [updated, ...next];
    });
  }, []);

  const createConversation = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const data = await api.post("/support/conversations", form);
      updateConversation(data.conversation);
      setShowCreate(false);
      setForm({ subject: "", category: "booking", priority: "normal", message: "" });
    } catch (createError) {
      setError(createError.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[30px] bg-gradient-to-br from-teal-700 to-cyan-500 p-7 text-white shadow-xl shadow-teal-900/15">
        <p className="text-xs font-black uppercase tracking-wide text-teal-100">Trung tâm hỗ trợ</p>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-black">Chat với CareGo Admin</h1>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-white/80">
              Gửi vấn đề về booking, tài khoản, thanh toán hoặc an toàn. Admin sẽ phản hồi trực tiếp tại đây.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreate((value) => !value)}
            className="rounded-full bg-white px-5 py-3 text-sm font-black text-teal-700 shadow-lg"
          >
            {showCreate ? "Đóng biểu mẫu" : "Tạo yêu cầu hỗ trợ"}
          </button>
        </div>
      </section>

      {showCreate ? (
        <form onSubmit={createConversation} className="grid gap-4 rounded-[28px] border border-teal-100 bg-white p-6 shadow-xl shadow-teal-900/5">
          <h2 className="text-xl font-black">Yêu cầu hỗ trợ mới</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold text-slate-700">
              Chủ đề
              <input
                value={form.subject}
                onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))}
                className="min-h-12 rounded-2xl border border-teal-100 px-4 outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
                placeholder="VD: Không thể thanh toán booking"
                required
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-slate-700">
              Loại vấn đề
              <select
                value={form.category}
                onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                className="min-h-12 rounded-2xl border border-teal-100 px-4 outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
              >
                {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          </div>
          <label className="grid gap-2 text-sm font-bold text-slate-700">
            Nội dung
            <textarea
              value={form.message}
              onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
              className="min-h-28 rounded-2xl border border-teal-100 px-4 py-3 outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
              placeholder="Mô tả rõ vấn đề bạn đang gặp..."
              required
            />
          </label>
          <label className="flex items-center gap-2 text-sm font-bold text-rose-600">
            <input
              type="checkbox"
              checked={form.priority === "urgent"}
              onChange={(event) => setForm((current) => ({ ...current, priority: event.target.checked ? "urgent" : "normal" }))}
              className="h-4 w-4 accent-rose-600"
            />
            Đây là vấn đề khẩn cấp
          </label>
          <button disabled={submitting} className="min-h-12 rounded-2xl bg-teal-700 px-5 text-sm font-black text-white disabled:opacity-50">
            {submitting ? "Đang gửi..." : "Gửi yêu cầu"}
          </button>
        </form>
      ) : null}

      {error ? <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">{error}</div> : null}

      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <aside className="max-h-[650px] overflow-y-auto rounded-[28px] border border-teal-100 bg-white p-3 shadow-xl shadow-teal-900/5">
          <div className="px-2 pb-3 pt-2">
            <h2 className="font-black">Yêu cầu của bạn</h2>
            <p className="mt-1 text-xs text-slate-500">{conversations.length} cuộc trò chuyện</p>
          </div>
          {loading ? <p className="p-4 text-sm font-bold text-slate-400">Đang tải...</p> : null}
          <div className="grid gap-2">
            {conversations.map((item) => (
              <button
                key={item._id}
                type="button"
                onClick={() => setSelected(item)}
                className={`rounded-2xl border p-4 text-left transition ${
                  selected?._id === item._id ? "border-teal-300 bg-teal-50" : "border-transparent bg-slate-50 hover:border-teal-100"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="line-clamp-2 text-sm font-black text-slate-800">{item.subject}</p>
                  {item.priority === "urgent" ? <span className="rounded-full bg-rose-100 px-2 py-1 text-[10px] font-black text-rose-600">Khẩn</span> : null}
                </div>
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{item.lastMessage}</p>
              </button>
            ))}
          </div>
        </aside>

        <SupportChatPanel conversation={selected} onConversationChange={updateConversation} />
      </div>
    </div>
  );
}
