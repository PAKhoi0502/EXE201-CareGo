import { useMemo, useState } from "react";
import { api } from "../../api/client.js";
import AdminDetailModal, { DetailGrid, DetailItem } from "../../components/AdminDetailModal.jsx";
import { Button, Input, Select } from "../../components/Ui.jsx";
import { useAsync } from "../../hooks/useAsync.js";
import { dateTime } from "../../utils/format.js";

const PAGE_SIZE = 25;

const toDateInput = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const createDefaultFilters = () => {
  const today = new Date();
  const firstDay = new Date(today);
  firstDay.setDate(firstDay.getDate() - 6);
  return {
    search: "",
    role: "all",
    source: "all",
    outcome: "all",
    method: "all",
    from: toDateInput(firstDay),
    to: toDateInput(today),
  };
};

const actionLabels = {
  "http.read": "Xem dữ liệu",
  "http.create": "Tạo dữ liệu",
  "http.replace": "Thay thế dữ liệu",
  "http.update": "Cập nhật dữ liệu",
  "http.delete": "Xóa dữ liệu",
  "http.request": "Gửi yêu cầu",
  "auth.login": "Đăng nhập",
  "auth.logout": "Đăng xuất",
  "auth.refresh": "Làm mới phiên đăng nhập",
  "auth.signup.verify": "Xác thực đăng ký",
  "auth.email.verify": "Xác thực email",
  "customer.profile.update": "Cập nhật hồ sơ customer",
  "customer.password.otp_request": "Yêu cầu OTP đổi mật khẩu",
  "customer.password.change": "Đổi mật khẩu",
  "customer.companion.apply": "Đăng ký làm companion",
  "customer.elder.create": "Tạo hồ sơ người thân",
  "customer.elder.update": "Cập nhật hồ sơ người thân",
  "customer.elder.delete": "Xóa hồ sơ người thân",
  "customer.booking.create": "Tạo booking",
  "customer.booking.cancel": "Hủy booking",
  "customer.booking.pay": "Thanh toán booking",
  "customer.review.create": "Gửi đánh giá",
  "customer.payment.sync": "Đồng bộ thanh toán",
  "customer.support.create": "Tạo yêu cầu hỗ trợ",
  "socket.connect": "Kết nối realtime",
  "socket.disconnect": "Ngắt kết nối realtime",
  "gps.start": "Bật GPS",
  "gps.stop": "Tắt GPS",
};

const getActionLabel = (action) => actionLabels[action] || action || "Không xác định";

const roleMeta = {
  admin: { label: "Admin", className: "bg-violet-50 text-violet-700" },
  companion: { label: "Companion", className: "bg-cyan-50 text-cyan-700" },
  customer: { label: "Customer", className: "bg-blue-50 text-blue-700" },
};

const RoleBadge = ({ role }) => (
  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${roleMeta[role]?.className || "bg-slate-100 text-slate-600"}`}>
    {roleMeta[role]?.label || role || "Không rõ"}
  </span>
);

const OutcomeBadge = ({ outcome, statusCode }) => (
  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${outcome === "success" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
    {outcome === "success" ? "Thành công" : "Thất bại"}{statusCode ? ` · ${statusCode}` : ""}
  </span>
);

const AdminAuditLogsPage = () => {
  const [filters, setFilters] = useState(createDefaultFilters);
  const [appliedFilters, setAppliedFilters] = useState(createDefaultFilters);
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState(null);

  const requestPath = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(PAGE_SIZE),
      from: appliedFilters.from,
      to: appliedFilters.to,
    });
    ["search", "role", "source", "outcome", "method"].forEach((field) => {
      const value = appliedFilters[field];
      if (value && value !== "all") params.set(field, value);
    });
    return `/admin/audit-logs?${params.toString()}`;
  }, [appliedFilters, page]);

  const { data, loading, error, reload } = useAsync(() => api.get(requestPath), [requestPath]);
  const auditLogs = data?.auditLogs || [];
  const summary = data?.summary || {};
  const pagination = data?.pagination || { page: 1, total: 0, totalPages: 0 };

  const updateFilter = (field, value) => {
    setFilters((current) => ({ ...current, [field]: value }));
  };

  const applyFilters = (event) => {
    event.preventDefault();
    setPage(1);
    setAppliedFilters({ ...filters });
  };

  const resetFilters = () => {
    const defaults = createDefaultFilters();
    setFilters(defaults);
    setAppliedFilters(defaults);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-teal-700">Theo dõi hệ thống</p>
          <h1 className="mt-1 text-3xl font-black text-slate-950">Nhật ký hoạt động</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Ghi nhận thao tác HTTP và sự kiện realtime quan trọng của admin, companion; customer chỉ ghi các sự kiện nghiệp vụ nhạy cảm. Dữ liệu tự động được xóa sau {data?.retentionDays || 7} ngày.
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={reload} disabled={loading}>
          {loading ? "Đang tải..." : "Làm mới"}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {[
          ["Tổng hoạt động", summary.total || 0, "text-slate-900"],
          ["Admin", summary.admin || 0, "text-violet-700"],
          ["Companion", summary.companion || 0, "text-cyan-700"],
          ["Customer", summary.customer || 0, "text-blue-700"],
          ["Realtime", summary.socket || 0, "text-teal-700"],
          ["Thất bại", summary.failures || 0, "text-rose-700"],
        ].map(([label, value, tone]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold text-slate-400">{label}</p>
            <p className={`mt-2 text-2xl font-black ${tone}`}>{value}</p>
          </div>
        ))}
      </div>

      <form onSubmit={applyFilters} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Input label="Tìm kiếm" value={filters.search} onChange={(event) => updateFilter("search", event.target.value)} placeholder="Tên, email, route, resource ID..." />
          <Select label="Vai trò" value={filters.role} onChange={(event) => updateFilter("role", event.target.value)}>
            <option value="all">Tất cả</option>
            <option value="admin">Admin</option>
            <option value="companion">Companion</option>
            <option value="customer">Customer</option>
          </Select>
          <Select label="Nguồn" value={filters.source} onChange={(event) => updateFilter("source", event.target.value)}>
            <option value="all">Tất cả</option>
            <option value="http">HTTP</option>
            <option value="socket">Realtime</option>
          </Select>
          <Select label="Kết quả" value={filters.outcome} onChange={(event) => updateFilter("outcome", event.target.value)}>
            <option value="all">Tất cả</option>
            <option value="success">Thành công</option>
            <option value="failure">Thất bại</option>
          </Select>
          <Select label="Phương thức" value={filters.method} onChange={(event) => updateFilter("method", event.target.value)}>
            <option value="all">Tất cả</option>
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="PATCH">PATCH</option>
            <option value="DELETE">DELETE</option>
          </Select>
          <Input label="Từ ngày" type="date" value={filters.from} onChange={(event) => updateFilter("from", event.target.value)} />
          <Input label="Đến ngày" type="date" value={filters.to} onChange={(event) => updateFilter("to", event.target.value)} />
          <div className="flex items-end gap-2">
            <Button className="flex-1">Áp dụng</Button>
            <Button type="button" variant="secondary" onClick={resetFilters}>Đặt lại</Button>
          </div>
        </div>
      </form>

      {error ? (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</div>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 p-5">
          <div>
            <h2 className="font-bold text-slate-900">Hoạt động đã ghi nhận</h2>
            <p className="mt-1 text-xs text-slate-400">{pagination.total || 0} bản ghi phù hợp bộ lọc</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50 text-xs font-semibold uppercase text-slate-400">
                <th className="p-4">Thời gian</th>
                <th className="p-4">Người thực hiện</th>
                <th className="p-4">Hành động</th>
                <th className="p-4">Đối tượng</th>
                <th className="p-4">Kết quả</th>
                <th className="p-4 text-right">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {auditLogs.map((log) => (
                <tr key={log._id} className="hover:bg-slate-50/70">
                  <td className="whitespace-nowrap p-4 text-xs text-slate-500">{dateTime(log.createdAt)}</td>
                  <td className="p-4">
                    <p className="font-bold text-slate-800">{log.actorName || log.actorEmail || log.actorId}</p>
                    <div className="mt-1"><RoleBadge role={log.actorRole} /></div>
                  </td>
                  <td className="p-4">
                    <p className="font-semibold text-slate-800">{getActionLabel(log.action)}</p>
                    <p className="mt-1 text-xs text-slate-400">{log.source === "socket" ? "Realtime" : log.method || "HTTP"}</p>
                  </td>
                  <td className="max-w-sm p-4">
                    <p className="truncate font-mono text-xs text-slate-600">{log.route || log.resourceType}</p>
                    {log.resourceId ? <p className="mt-1 truncate font-mono text-[11px] text-slate-400">{log.resourceId}</p> : null}
                  </td>
                  <td className="p-4">
                    <OutcomeBadge outcome={log.outcome} statusCode={log.statusCode} />
                    <p className="mt-1 text-xs text-slate-400">{log.durationMs ? `${log.durationMs} ms` : "-"}</p>
                  </td>
                  <td className="p-4 text-right">
                    <Button type="button" variant="muted" className="min-h-8 px-3 text-xs" onClick={() => setSelectedLog(log)}>Xem</Button>
                  </td>
                </tr>
              ))}
              {!loading && auditLogs.length === 0 ? (
                <tr><td colSpan="6" className="p-10 text-center text-sm text-slate-400">Chưa có hoạt động phù hợp bộ lọc.</td></tr>
              ) : null}
              {loading ? (
                <tr><td colSpan="6" className="p-10 text-center text-sm text-slate-400">Đang tải nhật ký...</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-400">Trang {pagination.page || 1} / {Math.max(pagination.totalPages || 1, 1)}</p>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)}>Trang trước</Button>
            <Button type="button" variant="secondary" disabled={page >= (pagination.totalPages || 1) || loading} onClick={() => setPage((current) => current + 1)}>Trang sau</Button>
          </div>
        </div>
      </section>

      {selectedLog ? (
        <AdminDetailModal title={getActionLabel(selectedLog.action)} subtitle={`Audit ID: ${selectedLog._id}`} onClose={() => setSelectedLog(null)}>
          <DetailGrid>
            <DetailItem label="Thời gian" value={dateTime(selectedLog.createdAt)} />
            <DetailItem label="Tự động xóa lúc" value={dateTime(selectedLog.expiresAt)} />
            <DetailItem label="Người thực hiện" value={selectedLog.actorName || selectedLog.actorEmail || selectedLog.actorId} />
            <DetailItem label="Vai trò"><RoleBadge role={selectedLog.actorRole} /></DetailItem>
            <DetailItem label="Nguồn" value={selectedLog.source === "socket" ? "Realtime Socket.IO" : "HTTP API"} />
            <DetailItem label="Kết quả"><OutcomeBadge outcome={selectedLog.outcome} statusCode={selectedLog.statusCode} /></DetailItem>
            <DetailItem label="Phương thức" value={selectedLog.method || "Không áp dụng"} />
            <DetailItem label="Thời gian xử lý" value={selectedLog.durationMs ? `${selectedLog.durationMs} ms` : "Không áp dụng"} />
            <DetailItem label="Loại đối tượng" value={selectedLog.resourceType || "-"} />
            <DetailItem label="Resource ID" value={selectedLog.resourceId || "-"} />
            <DetailItem label="Route" value={selectedLog.route || "-"} />
            <DetailItem label="Thiết bị" value={selectedLog.userAgent || "Không xác định"} />
          </DetailGrid>
        </AdminDetailModal>
      ) : null}
    </div>
  );
};

export default AdminAuditLogsPage;
