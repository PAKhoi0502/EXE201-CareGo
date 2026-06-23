import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../api/client.js";
import SupportChatPanel from "../../components/support/SupportChatPanel.jsx";
import { connectLocationSocket, locationSocket } from "../../socket/locationSocket.js";

const statusLabels = { waiting: "Chờ hỗ trợ", active: "Đang xử lý", resolved: "Đã giải quyết" };

export default function AdminSupportPage() {
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [error, setError] = useState("");

  const loadConversations = useCallback(async () => {
    try {
      const data = await api.get(`/support/admin/conversations?status=${statusFilter}`);
      setError("");
      setConversations(data.conversations || []);
      setSelected((current) =>
        current ? data.conversations?.find((item) => item._id === current._id) || current : data.conversations?.[0] || null,
      );
    } catch (loadError) {
      setError(loadError.message);
    }
  }, [statusFilter]);

  useEffect(() => {
    Promise.resolve().then(loadConversations);
    connectLocationSocket();
    const refresh = () => {
      loadConversations();
    };
    locationSocket.emit("support:admin:join");
    locationSocket.on("support:new-conversation", refresh);
    locationSocket.on("support:conversation-updated", refresh);
    return () => {
      locationSocket.off("support:new-conversation", refresh);
      locationSocket.off("support:conversation-updated", refresh);
    };
  }, [loadConversations]);

  const stats = useMemo(
    () => ({
      total: conversations.length,
      urgent: conversations.filter((item) => item.priority === "urgent").length,
      waiting: conversations.filter((item) => item.status === "waiting").length,
    }),
    [conversations],
  );

  const updateConversationLocally = useCallback((updated) => {
    if (!updated?._id) return;
    setSelected(updated);
    setConversations((current) => [updated, ...current.filter((item) => item._id !== updated._id)]);
  }, []);

  const patchConversation = async (payload) => {
    if (!selected?._id) return;
    try {
      const data = await api.patch(`/support/admin/conversations/${selected._id}`, payload);
      updateConversationLocally(data.conversation);
    } catch (patchError) {
      setError(patchError.message);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] bg-gradient-to-br from-teal-700 to-cyan-500 p-6 text-white shadow-xl shadow-teal-900/15">
        <p className="text-xs font-black uppercase tracking-wide text-teal-100">CareGo Support</p>
        <h1 className="mt-2 text-3xl font-black">Trung tâm hỗ trợ người dùng</h1>
        <p className="mt-2 text-sm font-semibold text-white/80">Nhận và xử lý yêu cầu từ khách hàng, người đồng hành theo thời gian thực.</p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {[["Tổng hội thoại", stats.total], ["Đang chờ", stats.waiting], ["Khẩn cấp", stats.urgent]].map(([label, value]) => (
          <div key={label} className="rounded-3xl border border-teal-100 bg-white p-5 shadow-lg shadow-teal-900/5">
            <p className="text-sm font-bold text-slate-500">{label}</p>
            <p className="mt-2 text-3xl font-black text-teal-700">{value}</p>
          </div>
        ))}
      </section>

      {error ? <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">{error}</div> : null}

      <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <aside className="max-h-[690px] overflow-y-auto rounded-[28px] border border-teal-100 bg-white p-3 shadow-xl shadow-teal-900/5">
          <div className="p-2">
            <h2 className="font-black">Hàng chờ hỗ trợ</h2>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="mt-3 min-h-10 w-full rounded-xl border border-teal-100 px-3 text-sm font-bold outline-none focus:border-teal-400"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="waiting">Chờ hỗ trợ</option>
              <option value="active">Đang xử lý</option>
              <option value="resolved">Đã giải quyết</option>
            </select>
          </div>
          <div className="mt-2 grid gap-2">
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
                <p className="mt-1 text-xs font-bold text-teal-700">{item.userId?.name || "Người dùng"} · {item.userId?.role}</p>
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{item.lastMessage}</p>
              </button>
            ))}
          </div>
        </aside>

        <div className="space-y-4">
          {selected ? (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-teal-100 bg-white p-3 shadow-sm">
              <button
                type="button"
                onClick={() => patchConversation({ assignToMe: true, status: "active" })}
                className="rounded-full bg-teal-700 px-4 py-2 text-xs font-black text-white"
              >
                Nhận xử lý
              </button>
              <select
                value={selected.status}
                onChange={(event) => patchConversation({ status: event.target.value })}
                className="min-h-9 rounded-full border border-teal-100 px-3 text-xs font-black outline-none"
              >
                {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <select
                value={selected.priority}
                onChange={(event) => patchConversation({ priority: event.target.value })}
                className="min-h-9 rounded-full border border-teal-100 px-3 text-xs font-black outline-none"
              >
                <option value="normal">Ưu tiên thường</option>
                <option value="urgent">Khẩn cấp</option>
              </select>
            </div>
          ) : null}
          <SupportChatPanel conversation={selected} onConversationChange={updateConversationLocally} />
        </div>
      </div>
    </div>
  );
}
