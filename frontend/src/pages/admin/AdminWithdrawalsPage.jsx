import { useMemo, useState } from "react";
import { api } from "../../api/client";
import { useAsync } from "../../hooks/useAsync";

const statusLabels = {
  pending: "Chờ xử lý",
  approved: "Đã duyệt",
  paid: "Đã chuyển tiền",
  rejected: "Từ chối",
};

const statusClasses = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  approved: "bg-blue-50 text-blue-700 border-blue-200",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
};

const currency = (value) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const dateTime = (value) => {
  if (!value) return "-";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
};

const getRequests = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.requests)) return data.requests;
  if (Array.isArray(data?.withdrawals)) return data.withdrawals;
  if (Array.isArray(data?.withdrawalRequests)) return data.withdrawalRequests;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

export default function AdminWithdrawalsPage() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [processingId, setProcessingId] = useState("");
  const [selectedRequest, setSelectedRequest] = useState(null);
  const { data, loading, error, reload } = useAsync(
    () => api.get("/withdrawals/admin"),
    []
  );

  const requests = useMemo(() => getRequests(data), [data]);
  const filteredRequests = useMemo(() => {
    if (statusFilter === "all") return requests;
    return requests.filter((item) => item.status === statusFilter);
  }, [requests, statusFilter]);

  const stats = useMemo(() => {
    return requests.reduce(
      (acc, item) => {
        acc.total += Number(item.amount || 0);
        acc[item.status] = (acc[item.status] || 0) + Number(item.amount || 0);
        return acc;
      },
      { total: 0, pending: 0, approved: 0, paid: 0, rejected: 0 }
    );
  }, [requests]);

  const updateStatus = async (id, status) => {
    try {
      setProcessingId(`${id}-${status}`);
      await api.patch(`/withdrawals/admin/${id}/status`, { status });
      await reload();
    } finally {
      setProcessingId("");
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-teal-100 bg-gradient-to-br from-teal-700 to-teal-400 p-6 text-white shadow-xl shadow-teal-100">
        <p className="text-sm font-black uppercase tracking-wide text-teal-100">
          Quản lý ví người đồng hành
        </p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-black">Yêu cầu rút tiền</h1>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-teal-50">
              Theo dõi yêu cầu rút tiền từ người đồng hành, duyệt hoặc từ chối
              trước khi chuyển khoản.
            </p>
          </div>
          <button
            type="button"
            onClick={reload}
            className="rounded-full bg-white px-5 py-3 text-sm font-black text-teal-700 shadow-lg shadow-teal-800/10 transition hover:-translate-y-0.5"
          >
            Làm mới
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        {[
          ["Tổng yêu cầu", currency(stats.total)],
          ["Chờ xử lý", currency(stats.pending)],
          ["Đã duyệt", currency(stats.approved)],
          ["Đã chuyển", currency(stats.paid)],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-3xl border border-teal-100 bg-white p-5 shadow-lg shadow-teal-50"
          >
            <p className="text-sm font-bold text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-[28px] border border-teal-100 bg-white p-5 shadow-xl shadow-teal-50">
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-950">
              Danh sách yêu cầu
            </h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {filteredRequests.length} yêu cầu đang hiển thị
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              ["all", "Tất cả"],
              ["pending", "Chờ xử lý"],
              ["approved", "Đã duyệt"],
              ["paid", "Đã chuyển"],
              ["rejected", "Từ chối"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatusFilter(value)}
                className={`rounded-full px-4 py-2 text-xs font-black transition ${
                  statusFilter === value
                    ? "bg-teal-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-teal-50 hover:text-teal-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center font-bold text-slate-500">
            Đang tải yêu cầu rút tiền...
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center font-bold text-slate-500">
            Chưa có yêu cầu rút tiền.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-black uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3">Người đồng hành</th>
                  <th className="px-4 py-3">Số tiền</th>
                  <th className="px-4 py-3">Ngân hàng</th>
                  <th className="px-4 py-3">Thời gian</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((request) => {
                  const companion = request.companion || request.companionId || {};
                  const name =
                    companion.fullName ||
                    companion.name ||
                    request.companionName ||
                    "Người đồng hành";

                  return (
                    <tr
                      key={request._id}
                      className="border-b border-slate-100 align-top last:border-0"
                    >
                      <td className="px-4 py-4">
                        <p className="font-black text-slate-950">{name}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          {companion.email || request.email || "-"}
                        </p>
                      </td>
                      <td className="px-4 py-4 font-black text-teal-700">
                        {currency(request.amount)}
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-bold text-slate-800">
                          {request.bankName || "-"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {request.bankAccountNumber || "-"} ·{" "}
                          {request.bankAccountName || "-"}
                        </p>
                      </td>
                      <td className="px-4 py-4 font-semibold text-slate-500">
                        {dateTime(request.createdAt)}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${
                            statusClasses[request.status] || statusClasses.pending
                          }`}
                        >
                          {statusLabels[request.status] || "Chờ xử lý"}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedRequest(request)}
                            className="rounded-full bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-teal-50 hover:text-teal-700"
                          >
                            Chi tiết
                          </button>
                          <button
                            type="button"
                            disabled={processingId || request.status === "approved"}
                            onClick={() => updateStatus(request._id, "approved")}
                            className="rounded-full bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Duyệt
                          </button>
                          <button
                            type="button"
                            disabled={processingId || request.status === "paid"}
                            onClick={() => updateStatus(request._id, "paid")}
                            className="rounded-full bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Đã chuyển
                          </button>
                          <button
                            type="button"
                            disabled={processingId || request.status === "rejected"}
                            onClick={() => updateStatus(request._id, "rejected")}
                            className="rounded-full bg-red-50 px-3 py-2 text-xs font-black text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Từ chối
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedRequest ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4"
          onClick={() => setSelectedRequest(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[30px] border border-teal-100 bg-white p-6 shadow-2xl shadow-slate-950/20"
            onClick={(event) => event.stopPropagation()}
          >
            {(() => {
              const companion =
                selectedRequest.companion || selectedRequest.companionId || {};
              const name =
                companion.fullName ||
                companion.name ||
                selectedRequest.companionName ||
                "Người đồng hành";

              return (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-black uppercase tracking-wide text-teal-700">
                        Chi tiết yêu cầu rút tiền
                      </p>
                      <h2 className="mt-2 text-2xl font-black text-slate-950">
                        {currency(selectedRequest.amount)}
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedRequest(null)}
                      className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-xl font-black text-slate-500 transition hover:bg-red-50 hover:text-red-600"
                    >
                      ×
                    </button>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-teal-100 bg-[#fbfffe] p-4">
                      <p className="text-xs font-black uppercase text-slate-400">
                        Người đồng hành
                      </p>
                      <p className="mt-2 font-black text-slate-950">{name}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-500">
                        {companion.email || selectedRequest.email || "-"}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-500">
                        {companion.phone || selectedRequest.phone || "-"}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-teal-100 bg-[#fbfffe] p-4">
                      <p className="text-xs font-black uppercase text-slate-400">
                        Trạng thái
                      </p>
                      <span
                        className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-black ${
                          statusClasses[selectedRequest.status] ||
                          statusClasses.pending
                        }`}
                      >
                        {statusLabels[selectedRequest.status] || "Chờ xử lý"}
                      </span>
                      <p className="mt-3 text-sm font-semibold text-slate-500">
                        Tạo lúc: {dateTime(selectedRequest.createdAt)}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-500">
                        Xử lý lúc: {dateTime(selectedRequest.processedAt)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-teal-100 bg-white p-4">
                    <p className="text-xs font-black uppercase text-slate-400">
                      Thông tin ngân hàng
                    </p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <div>
                        <p className="text-xs font-bold text-slate-400">
                          Ngân hàng
                        </p>
                        <p className="mt-1 font-black text-slate-950">
                          {selectedRequest.bankName || "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-400">
                          Số tài khoản
                        </p>
                        <p className="mt-1 font-black text-slate-950">
                          {selectedRequest.bankAccountNumber || "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-400">
                          Chủ tài khoản
                        </p>
                        <p className="mt-1 font-black text-slate-950">
                          {selectedRequest.bankAccountName || "-"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <p className="text-xs font-black uppercase text-slate-400">
                      Ghi chú người đồng hành
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-600">
                      {selectedRequest.note || "Không có ghi chú."}
                    </p>
                  </div>

                  {selectedRequest.adminNote ? (
                    <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 p-4">
                      <p className="text-xs font-black uppercase text-amber-700">
                        Ghi chú admin
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-amber-800">
                        {selectedRequest.adminNote}
                      </p>
                    </div>
                  ) : null}

                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <button
                      type="button"
                      disabled={
                        processingId || selectedRequest.status === "approved"
                      }
                      onClick={async () => {
                        await updateStatus(selectedRequest._id, "approved");
                        setSelectedRequest(null);
                      }}
                      className="min-h-11 rounded-full bg-blue-50 px-4 text-sm font-black text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Duyệt
                    </button>
                    <button
                      type="button"
                      disabled={processingId || selectedRequest.status === "paid"}
                      onClick={async () => {
                        await updateStatus(selectedRequest._id, "paid");
                        setSelectedRequest(null);
                      }}
                      className="min-h-11 rounded-full bg-emerald-50 px-4 text-sm font-black text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Đã chuyển
                    </button>
                    <button
                      type="button"
                      disabled={
                        processingId || selectedRequest.status === "rejected"
                      }
                      onClick={async () => {
                        await updateStatus(selectedRequest._id, "rejected");
                        setSelectedRequest(null);
                      }}
                      className="min-h-11 rounded-full bg-red-50 px-4 text-sm font-black text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Từ chối
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      ) : null}
    </div>
  );
}
