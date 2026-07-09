import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { api } from "../../api/client.js";
import AdminDetailModal, { DetailGrid, DetailItem } from "../../components/AdminDetailModal.jsx";
import AdminPagination from "../../components/AdminPagination.jsx";
import { Button, StatusBadge } from "../../components/Ui.jsx";
import { useAsync } from "../../hooks/useAsync.js";
import { dateTime } from "../../utils/format.js";

const initials = (name = "CG") =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const AccountLockBadge = ({ active }) => (
  <span
    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
      active
        ? "bg-blue-50 text-blue-700 ring-blue-200"
        : "bg-rose-50 text-rose-700 ring-rose-200"
    }`}
  >
    {active ? "Tài khoản mở" : "Tài khoản bị khóa"}
  </span>
);

const OnlineBadge = ({ status }) => (
  <span
    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
      status?.isOnline
        ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
        : "bg-slate-100 text-slate-600 ring-slate-200"
    }`}
  >
    {status?.isOnline ? "Trực tuyến" : "Ngoại tuyến"}
  </span>
);

const AdminUsersPage = () => {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState(null);
  const [onlineStatuses, setOnlineStatuses] = useState({});
  const [actionError, setActionError] = useState("");
  const [processingUserId, setProcessingUserId] = useState("");
  const deferredQuery = useDeferredValue(query.trim());
  const { data, loading, error, reload } = useAsync(() => {
    const params = new URLSearchParams({ page: String(page), limit: "25", role: "customer" });
    if (deferredQuery) params.set("search", deferredQuery);
    if (statusFilter !== "all") params.set("status", statusFilter);
    return api.get(`/admin/users?${params.toString()}`);
  }, [page, deferredQuery, statusFilter]);

  const customers = useMemo(
    () => data?.users || [],
    [data?.users],
  );
  const summary = data?.summary || {};
  const pagination = data?.pagination || { page, limit: 25, total: 0, totalPages: 1 };
  const getOnlineStatus = (id) => onlineStatuses[id] || null;

  useEffect(() => {
    const loadOnlineStatuses = async () => {
      try {
        const response = await api.get("/admin/online-statuses");
        setOnlineStatuses(response.onlineStatuses || {});
      } catch {
        setOnlineStatuses({});
      }
    };

    loadOnlineStatuses();
    const timer = setInterval(loadOnlineStatuses, 10000);
    return () => clearInterval(timer);
  }, []);

  const filteredCustomers = customers;

  const toggleUserStatus = async (user) => {
    const actionLabel = user.isActive ? "khóa" : "mở khóa";
    if (!window.confirm(`Xác nhận ${actionLabel} tài khoản ${user.name || user.email}?`)) return;

    setActionError("");
    setProcessingUserId(user._id);
    try {
      const response = await api.patch(`/admin/users/${user._id}/status`, {
        isActive: !user.isActive,
      });
      await reload();
      setSelectedUser((current) =>
        current?._id === user._id ? { ...current, ...response.user } : current,
      );
    } catch (updateError) {
      setActionError(updateError.message);
    } finally {
      setProcessingUserId("");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Quản lý người dùng</h1>
          <p className="mt-1 text-sm text-slate-500">
            Quản lý tài khoản khách hàng sử dụng dịch vụ CareGo.
          </p>
        </div>
        <div className="relative w-full lg:w-96">
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Tìm tên, email, số điện thoại..."
            className="min-h-11 w-full rounded-xl border border-transparent bg-slate-100 px-4 pl-10 text-sm outline-none transition focus:border-teal-300 focus:bg-white focus:ring-2 focus:ring-teal-100"
          />
          <span className="absolute left-3 top-2.5 text-slate-400">⌕</span>
        </div>
      </div>

      {error || actionError ? (
        <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{error || actionError}</p>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="block text-xs font-medium text-slate-400">Tổng khách hàng</span>
          <p className="mt-2 text-2xl font-bold text-slate-900">{summary.total || 0}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="block text-xs font-medium text-slate-400">Tài khoản hoạt động</span>
          <p className="mt-2 text-2xl font-bold text-emerald-700">{summary.active || 0}</p>
        </div>
        <div className="rounded-xl border-l-4 border-rose-500 bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <span className="block text-xs font-medium text-rose-600">Tài khoản tạm khóa</span>
          <p className="mt-2 text-2xl font-bold text-slate-900">{summary.suspended || 0}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="block text-xs font-medium text-slate-400">Email đã xác thực</span>
          <p className="mt-2 text-2xl font-bold text-blue-600">{summary.verified || 0}</p>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 bg-slate-50/70 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-bold text-slate-900">Danh sách khách hàng</h2>
            <p className="mt-1 text-xs text-slate-400">Chỉ hiển thị tài khoản có vai trò khách hàng.</p>
          </div>
          <select
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 outline-none focus:ring-2 focus:ring-teal-100"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="all">Trạng thái: Tất cả</option>
            <option value="active">Hoạt động</option>
            <option value="suspended">Tạm khóa</option>
          </select>
        </div>

        {loading ? <p className="p-6 text-sm text-slate-500">Đang tải người dùng...</p> : null}

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50 text-xs font-semibold uppercase text-slate-400">
                <th className="p-4">Khách hàng</th>
                <th className="p-4">Liên hệ</th>
                <th className="p-4">Xác thực email</th>
                <th className="p-4">Trạng thái</th>
                <th className="p-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredCustomers.map((user) => (
                <tr key={user._id} className="hover:bg-slate-50/80">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                        {initials(user.name)}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800">{user.name}</p>
                        <p className="text-xs text-slate-400">Mã: {user._id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-slate-500">
                    <p>{user.email}</p>
                    <p className="text-xs">{user.phone || "Chưa có số điện thoại"}</p>
                  </td>
                  <td className="p-4">
                    <StatusBadge status={user.isEmailVerified ? "approved" : "pending"} />
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1">
                      <AccountLockBadge active={user.isActive} />
                      <OnlineBadge status={getOnlineStatus(user._id)} />
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="muted"
                        className="min-h-8 px-2.5 text-xs"
                        onClick={() => setSelectedUser(user)}
                      >
                        Chi tiết
                      </Button>
                      <Button
                        variant={user.isActive ? "danger" : "secondary"}
                        className="min-h-8 px-2.5 text-xs"
                        onClick={() => toggleUserStatus(user)}
                        disabled={processingUserId === user._id}
                      >
                        {processingUserId === user._id
                          ? "Đang xử lý..."
                          : user.isActive ? "Khóa" : "Mở khóa"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!filteredCustomers.length && !loading ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-sm text-slate-400">
                    Không tìm thấy khách hàng phù hợp.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <AdminPagination
          pagination={pagination}
          loading={loading}
          onPageChange={setPage}
          itemLabel="khách hàng"
        />
      </section>

      {selectedUser ? (
        <AdminDetailModal
          title={selectedUser.name}
          subtitle={`Mã người dùng: ${selectedUser._id}`}
          status={selectedUser.isActive ? "approved" : "suspended"}
          onClose={() => setSelectedUser(null)}
        >
          <DetailGrid>
            <DetailItem label="Email" value={selectedUser.email} />
            <DetailItem label="Số điện thoại" value={selectedUser.phone || "Chưa cập nhật"} />
            <DetailItem label="Vai trò" value="Khách hàng" />
            <DetailItem
              label="Xác thực email"
              value={selectedUser.isEmailVerified ? "Đã xác thực" : "Chưa xác thực"}
            />
            <DetailItem label="Trạng thái tài khoản">
              <AccountLockBadge active={selectedUser.isActive} />
            </DetailItem>
            <DetailItem label="Trạng thái kết nối">
              <OnlineBadge status={getOnlineStatus(selectedUser._id)} />
            </DetailItem>
            <DetailItem label="Ngày tạo" value={dateTime(selectedUser.createdAt)} />
            <DetailItem label="Cập nhật lần cuối" value={dateTime(selectedUser.updatedAt)} />
            <DetailItem label="Ảnh đại diện" value={selectedUser.avatar?.url ? "Đã có ảnh" : "Chưa có ảnh"} />
          </DetailGrid>
        </AdminDetailModal>
      ) : null}
    </div>
  );
};

export default AdminUsersPage;
