import { useEffect, useMemo, useState } from "react";
import { api } from "../../api/client.js";
import AdminDetailModal, { DetailGrid, DetailItem, DetailTags } from "../../components/AdminDetailModal.jsx";
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

const getReviewerName = (companion) => {
  const reviewer = companion?.reviewedBy || {};
  return reviewer.name || reviewer.email || "-";
};

const vettingLabel = {
  pending: "Chờ xác thực",
  approved: "Đã duyệt",
  rejected: "Từ chối",
  suspended: "Tạm khóa",
};

const AccountLockBadge = ({ active }) => (
  <span
    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${active ? "bg-blue-50 text-blue-700 ring-blue-200" : "bg-rose-50 text-rose-700 ring-rose-200"
      }`}
  >
    {active ? "Tài khoản mở" : "Tài khoản bị khóa"}
  </span>
);

const OnlineBadge = ({ status }) => (
  <span
    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${status?.isOnline ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-slate-100 text-slate-600 ring-slate-200"
      }`}
  >
    {status?.isOnline ? "Online" : "Offline"}
  </span>
);

const GpsBadge = ({ status }) => (
  <span
    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${status?.isGpsOn ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-slate-100 text-slate-600 ring-slate-200"
      }`}
  >
    GPS {status?.isGpsOn ? "đang bật" : "đang tắt"}
  </span>
);

const DocumentImage = ({ label, src }) => (
  <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
    {src ? (
      <a href={src} target="_blank" rel="noreferrer" className="mt-2 block overflow-hidden rounded-xl border border-teal-100 bg-white">
        <img src={src} alt={label} className="h-40 w-full object-cover" />
      </a>
    ) : (
      <p className="mt-2 text-sm font-semibold text-slate-500">Chưa bổ sung</p>
    )}
  </div>
);

const AdminUsersPage = () => {
  const { data: usersData, loading, error, reload: reloadUsers } = useAsync(
    () => api.get("/admin/users"),
    [],
  );
  const { data: companionsData, reload: reloadCompanions } = useAsync(
    () => api.get("/companions/admin/all"),
    [],
  );
  const [activeTab, setActiveTab] = useState("companions");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [majorFilter, setMajorFilter] = useState("all");
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [gpsStatuses, setGpsStatuses] = useState({});
  const [onlineStatuses, setOnlineStatuses] = useState({});

  const users = useMemo(() => usersData?.users || [], [usersData?.users]);
  const companions = useMemo(() => companionsData?.companions || [], [companionsData?.companions]);
  const getGpsStatus = (companion) => gpsStatuses[companion.userId?._id || companion.userId] || null;
  const getOnlineStatus = (id) => onlineStatuses[id] || null;
  const getCompanionOnlineStatus = (companion) => getOnlineStatus(companion.userId?._id || companion.userId);
  const customers = users.filter((user) => user.role === "customer");
  const activeUsers = users.filter((user) => user.isActive).length;
  const pendingCompanions = companions.filter((item) => item.vettingStatus === "pending");
  const approvedCompanions = companions.filter((item) => item.vettingStatus === "approved");
  const healthMajorCount = companions.filter((item) =>
    `${item.major || ""} ${item.university || ""}`.toLowerCase().match(/y|duoc|dieu duong|tam ly/),
  ).length;

  useEffect(() => {
    const loadRealtimeStatuses = async () => {
      try {
        const [gpsResponse, onlineResponse] = await Promise.all([
          api.get("/admin/gps-statuses"),
          api.get("/admin/online-statuses"),
        ]);
        setGpsStatuses(gpsResponse.gpsStatuses || {});
        setOnlineStatuses(onlineResponse.onlineStatuses || {});
      } catch {
        setGpsStatuses({});
        setOnlineStatuses({});
      }
    };

    loadRealtimeStatuses();
    const timer = setInterval(loadRealtimeStatuses, 10000);
    return () => clearInterval(timer);
  }, []);

  const majors = useMemo(() => {
    const values = companions.map((item) => item.major).filter(Boolean);
    return ["all", ...new Set(values)];
  }, [companions]);

  const filteredCompanions = companions.filter((item) => {
    const text = `${item.fullName} ${item.userId?.email} ${item.phone} ${item.university} ${item.major}`.toLowerCase();
    const matchesQuery = text.includes(query.toLowerCase());
    const matchesStatus = statusFilter === "all" || item.vettingStatus === statusFilter;
    const matchesMajor = majorFilter === "all" || item.major === majorFilter;
    return matchesQuery && matchesStatus && matchesMajor;
  });

  const filteredCustomers = customers.filter((user) => {
    const text = `${user.name} ${user.email} ${user.phone}`.toLowerCase();
    const matchesQuery = text.includes(query.toLowerCase());
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && user.isActive) ||
      (statusFilter === "suspended" && !user.isActive);
    return matchesQuery && matchesStatus;
  });

  const toggleUserStatus = async (user) => {
    await api.patch(`/admin/users/${user._id}/status`, { isActive: !user.isActive });
    reloadUsers();
  };

  const updateCompanionStatus = async (id, vettingStatus) => {
    const payload = { vettingStatus };
    if (vettingStatus === "rejected") {
      const rejectionReason = window.prompt("Nhập lý do từ chối hồ sơ companion:");
      if (!rejectionReason?.trim()) return;
      payload.rejectionReason = rejectionReason.trim();
    }

    const response = await api.patch(`/companions/${id}/status`, payload);
    await reloadCompanions();
    if (response?.companion) {
      setSelectedDetail((current) =>
        current?.type === "companion" && current.data?._id === id
          ? { ...current, data: { ...current.data, ...response.companion } }
          : current,
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tổng quản lý người dùng</h1>
          <p className="mt-1 text-sm text-slate-500">
            Điều phối tài khoản khách hàng, sinh viên đồng hành và quy trình kiểm duyệt.
          </p>
        </div>
        <div className="relative w-full lg:w-96">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm tên, email, số điện thoại..."
            className="min-h-11 w-full rounded-xl border border-transparent bg-slate-100 px-4 pl-10 text-sm outline-none transition focus:border-teal-300 focus:bg-white focus:ring-2 focus:ring-teal-100"
          />
          <span className="absolute left-3 top-2.5 text-slate-400">⌕</span>
        </div>
      </div>

      {error ? <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="block text-xs font-medium text-slate-400">Tổng khách hàng</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-800">{customers.length}</span>
            <span className="text-xs font-semibold text-emerald-600">active data</span>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="block text-xs font-medium text-slate-400">Sinh viên onboard</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-teal-700">{approvedCompanions.length}</span>
            <span className="text-xs text-slate-400">
              {companions.length ? Math.round((healthMajorCount / companions.length) * 100) : 0}% khối sức khỏe
            </span>
          </div>
        </div>
        <div className="rounded-xl border-l-4 border-amber-500 bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <span className="block text-xs font-medium text-amber-600">Hồ sơ chờ xác thực</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-800">{pendingCompanions.length}</span>
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
              Mới nhận
            </span>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="block text-xs font-semibold text-slate-400">Tỷ lệ hoạt động</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-blue-600">
              {users.length ? Math.round((activeUsers / users.length) * 100) : 0}%
            </span>
            <span className="text-xs text-slate-400">tài khoản active</span>
          </div>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 bg-slate-50/70 p-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex w-full rounded-xl bg-slate-200 p-1 sm:w-fit">
            <button
              className={`rounded-lg px-4 py-2 text-xs font-bold transition ${activeTab === "companions" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                }`}
              onClick={() => setActiveTab("companions")}
            >
              Sinh viên đồng hành ({companions.length})
            </button>
            <button
              className={`rounded-lg px-4 py-2 text-xs font-bold transition ${activeTab === "customers" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                }`}
              onClick={() => setActiveTab("customers")}
            >
              Khách hàng con cái ({customers.length})
            </button>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            {activeTab === "companions" ? (
              <select
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 outline-none focus:ring-2 focus:ring-teal-100"
                value={majorFilter}
                onChange={(event) => setMajorFilter(event.target.value)}
              >
                {majors.map((major) => (
                  <option key={major} value={major}>
                    {major === "all" ? "Chuyên ngành: Tất cả" : major}
                  </option>
                ))}
              </select>
            ) : null}
            <select
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 outline-none focus:ring-2 focus:ring-teal-100"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">Trạng thái: Tất cả</option>
              {activeTab === "companions" ? (
                <>
                  <option value="approved">Đã duyệt</option>
                  <option value="pending">Chờ xác thực</option>
                  <option value="rejected">Từ chối</option>
                  <option value="suspended">Tạm khóa</option>
                </>
              ) : (
                <>
                  <option value="active">Hoạt động</option>
                  <option value="suspended">Tạm khóa</option>
                </>
              )}
            </select>
          </div>
        </div>

        {loading ? <p className="p-6 text-sm text-slate-500">Dang tai nguoi dung...</p> : null}

        {activeTab === "companions" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50 text-xs font-semibold uppercase text-slate-400">
                  <th className="p-4">Thông tin companion</th>
                  <th className="p-4">Xác thực 3 lớp</th>
                  <th className="p-4">Kỹ năng chuyên môn</th>
                  <th className="p-4">Đánh giá hệ thống</th>
                  <th className="p-4">Trạng thái</th>
                  <th className="p-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredCompanions.map((item) => (
                  <tr key={item._id} className={item.vettingStatus === "pending" ? "bg-amber-50/30" : "hover:bg-slate-50/80"}>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-teal-200 bg-teal-100 text-xs font-bold text-teal-800">
                          {initials(item.fullName)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800">{item.fullName}</p>
                          <p className="text-[11px] text-slate-400">
                            {item.userId?.email} | {item.university || "Chưa có trường"} ({item.major || "Chưa có ngành"})
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1">
                            <AccountLockBadge active={item.userId?.isActive} />
                            <OnlineBadge status={getCompanionOnlineStatus(item)} />
                            <GpsBadge status={getGpsStatus(item)} />
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="space-y-1 p-4">
                      <div className="flex items-center gap-1.5 font-semibold text-emerald-600">
                        <span>●</span> <span>L1: CCCD/Thẻ SV {item.documents?.citizenId ? "đã nhập" : "chờ bổ sung"}</span>
                      </div>
                      <div className="flex items-center gap-1.5 font-semibold text-emerald-600">
                        <span>●</span> <span>L2: Kỹ năng mềm</span>
                      </div>
                      <div
                        className={`flex items-center gap-1.5 font-semibold ${item.vettingStatus === "approved" ? "text-emerald-600" : "text-amber-600"
                          }`}
                      >
                        <span>●</span> <span>L3: {item.vettingStatus === "approved" ? "Hoàn tất" : "Chờ admin duyệt"}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex max-w-56 flex-wrap gap-1">
                        {(item.skills?.length ? item.skills : ["Chua cap nhat"]).slice(0, 4).map((skill) => (
                          <span key={skill} className="rounded bg-teal-50 px-2 py-0.5 text-[10px] font-medium text-teal-700">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-4">
                      <p className="font-bold text-slate-700">{item.completedBookings || 0} ca hoàn thành</p>
                      <span className="font-medium text-amber-500">
                        ★★★★★ {Number(item.ratingAverage || 0).toFixed(1)}
                      </span>
                    </td>
                    <td className="p-4">
                      <StatusBadge status={item.vettingStatus} />
                      <div className="mt-2 flex flex-wrap gap-1">
                        <AccountLockBadge active={item.userId?.isActive} />
                        <OnlineBadge status={getCompanionOnlineStatus(item)} />
                        <GpsBadge status={getGpsStatus(item)} />
                      </div>
                      <p className="mt-1 text-[11px] font-semibold text-slate-400">
                        {vettingLabel[item.vettingStatus] || item.vettingStatus}
                      </p>
                    </td>
                    <td className="space-x-1 whitespace-nowrap p-4 text-right">
                      <Button
                        variant="muted"
                        className="min-h-8 px-2.5 text-xs"
                        onClick={() => setSelectedDetail({ type: "companion", data: item })}
                      >
                        Chi tiết
                      </Button>
                      {item.vettingStatus === "approved" || item.vettingStatus === "suspended" ? (
                        <Button
                          variant={item.vettingStatus === "suspended" ? "secondary" : "danger"}
                          className="min-h-8 px-2.5 text-xs"
                          onClick={() =>
                            updateCompanionStatus(
                              item._id,
                              item.vettingStatus === "suspended" ? "approved" : "suspended",
                            )
                          }
                        >
                          {item.vettingStatus === "suspended" ? "Mở khóa" : "Tạm khóa"}
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {!filteredCompanions.length ? (
                  <tr>
                    <td colSpan="6" className="p-8 text-center text-sm text-slate-400">
                      Không tìm thấy companion phù hợp.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50 text-xs font-semibold uppercase text-slate-400">
                  <th className="p-4">Khách hàng</th>
                  <th className="p-4">Liên hệ</th>
                  <th className="p-4">Vai trò</th>
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
                          <p className="text-xs text-slate-400">ID: {user._id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-slate-500">
                      <p>{user.email}</p>
                      <p className="text-xs">{user.phone || "Chưa có số điện thoại"}</p>
                    </td>
                    <td className="p-4">
                      <StatusBadge status={user.role} />
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
                          onClick={() => setSelectedDetail({ type: "customer", data: user })}
                        >
                          Chi tiết
                        </Button>
                        <Button
                          variant={user.isActive ? "danger" : "secondary"}
                          className="min-h-8 px-2.5 text-xs"
                          onClick={() => toggleUserStatus(user)}
                        >
                          {user.isActive ? "Khóa" : "Mở khóa"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!filteredCustomers.length ? (
                  <tr>
                    <td colSpan="5" className="p-8 text-center text-sm text-slate-400">
                      Không tìm thấy khách hàng phù hợp.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 p-4 text-xs">
          <span className="font-medium text-slate-500">
            Hiển thị {activeTab === "companions" ? filteredCompanions.length : filteredCustomers.length} bản ghi
          </span>
          <div className="inline-flex rounded-xl shadow-sm">
            <button className="rounded-l-xl border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-500">
              ‹
            </button>
            <button className="border-y border-slate-200 bg-teal-50 px-3 py-1.5 font-bold text-teal-700">1</button>
            <button className="rounded-r-xl border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-500">
              ›
            </button>
          </div>
        </div>
      </section>

      {selectedDetail?.type === "companion" ? (
        <AdminDetailModal
          title={selectedDetail.data.fullName}
          subtitle={`Tai khoan companion: ${selectedDetail.data.userId?.email || "Chua co email"}`}
          status={selectedDetail.data.vettingStatus}
          onClose={() => setSelectedDetail(null)}
        >
          <div className="space-y-5">
            <DetailGrid>
              <DetailItem label="ID ho so" value={selectedDetail.data._id} />
              <DetailItem label="User ID" value={selectedDetail.data.userId?._id} />
              <DetailItem label="So dien thoai" value={selectedDetail.data.phone} />
              <DetailItem label="Truong" value={selectedDetail.data.university} />
              <DetailItem label="Chuyen nganh" value={selectedDetail.data.major} />
              <DetailItem label="Ngay tao" value={dateTime(selectedDetail.data.createdAt)} />
              <DetailItem label="Nguoi xu ly" value={getReviewerName(selectedDetail.data)} />
              <DetailItem label="Xu ly luc" value={dateTime(selectedDetail.data.reviewedAt)} />
              <DetailItem label="So ca hoan thanh" value={`${selectedDetail.data.completedBookings || 0} ca`} />
              <DetailItem label="Trang thai tai khoan">
                <AccountLockBadge active={selectedDetail.data.userId?.isActive} />
              </DetailItem>
              <DetailItem label="Online / Offline">
                <OnlineBadge status={getCompanionOnlineStatus(selectedDetail.data)} />
              </DetailItem>
              <DetailItem label="Trang thai GPS">
                <GpsBadge status={getGpsStatus(selectedDetail.data)} />
              </DetailItem>
              <DetailItem
                label="Danh gia"
                value={`${Number(selectedDetail.data.ratingAverage || 0).toFixed(1)} / 5 (${selectedDetail.data.ratingCount || 0})`}
              />
            </DetailGrid>
            {selectedDetail.data.vettingStatus === "rejected" ? (
              <section className="rounded-xl border border-rose-100 bg-rose-50 p-4">
                <h3 className="font-bold text-rose-700">Ly do tu choi</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm font-semibold text-rose-700">
                  {selectedDetail.data.rejectionReason || "Chua co ly do tu choi."}
                </p>
              </section>
            ) : null}
            <section className="rounded-xl border border-slate-100 p-4">
              <h3 className="font-bold text-slate-900">Ky nang / khu vuc</h3>
              <div className="mt-3 space-y-3">
                <DetailTags items={selectedDetail.data.skills || []} tone="blue" empty="Chua co ky nang" />
                <DetailTags items={selectedDetail.data.serviceAreas || []} tone="teal" empty="Chua co khu vuc" />
              </div>
            </section>
            <section className="rounded-xl border border-slate-100 p-4">
              <h3 className="font-bold text-slate-900">Kiểm duyệt 3 lớp</h3>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <DetailItem
                  label="CCCD"
                  value={
                    selectedDetail.data.documents?.citizenIdFrontUrl && selectedDetail.data.documents?.citizenIdBackUrl
                      ? "Đã chụp đủ mặt trước / mặt sau"
                      : selectedDetail.data.documents?.citizenId || "Chưa bổ sung"
                  }
                />
                <DetailItem label="Thẻ sinh viên" value={selectedDetail.data.documents?.studentCardUrl ? "Đã có file" : "Chưa bổ sung"} />
                <DetailItem label="Lý lịch tư pháp" value={selectedDetail.data.documents?.backgroundCheckUrl ? "Đã có file" : "Chưa bổ sung"} />
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <DocumentImage label="CCCD mặt trước" src={selectedDetail.data.documents?.citizenIdFrontUrl} />
                <DocumentImage label="CCCD mặt sau" src={selectedDetail.data.documents?.citizenIdBackUrl} />
              </div>
              <p className="mt-3 text-xs font-semibold text-slate-400">
                Cập nhật lần cuối: {dateTime(selectedDetail.data.updatedAt)}
              </p>
            </section>

            {selectedDetail.data.vettingStatus === "pending" ? (
              <section className="rounded-xl border border-amber-100 bg-amber-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900">Quyết định kiểm duyệt</h3>
                    <div className="mt-2">
                      <StatusBadge status={selectedDetail.data.vettingStatus} />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" className="min-h-9 px-3 text-xs" onClick={() => updateCompanionStatus(selectedDetail.data._id, "approved")}>
                      Duyệt hồ sơ
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="min-h-9 px-3 text-xs"
                      onClick={() => updateCompanionStatus(selectedDetail.data._id, "rejected")}
                    >
                      Từ chối
                    </Button>
                  </div>
                </div>
              </section>
            ) : null}
          </div>
        </AdminDetailModal>
      ) : null}

      {selectedDetail?.type === "customer" ? (
        <AdminDetailModal
          title={selectedDetail.data.name}
          subtitle={`User ID: ${selectedDetail.data._id}`}
          status={selectedDetail.data.isActive ? "approved" : "suspended"}
          onClose={() => setSelectedDetail(null)}
        >
          <DetailGrid>
            <DetailItem label="Email" value={selectedDetail.data.email} />
            <DetailItem label="So dien thoai" value={selectedDetail.data.phone} />
            <DetailItem label="Vai tro" value={selectedDetail.data.role} />
            <DetailItem label="Email da xac thuc" value={selectedDetail.data.isEmailVerified ? "Da xac thuc" : "Chua xac thuc"} />
            <DetailItem label="Trang thai">
              <AccountLockBadge active={selectedDetail.data.isActive} />
            </DetailItem>
            <DetailItem label="Online / Offline">
              <OnlineBadge status={getOnlineStatus(selectedDetail.data._id)} />
            </DetailItem>
            <DetailItem label="Ngay tao" value={dateTime(selectedDetail.data.createdAt)} />
            <DetailItem label="Cap nhat lan cuoi" value={dateTime(selectedDetail.data.updatedAt)} />
            <DetailItem label="Avatar" value={selectedDetail.data.avatar?.url ? "Da co anh" : "Chua co anh"} />
          </DetailGrid>
        </AdminDetailModal>
      ) : null}
    </div>
  );
};

export default AdminUsersPage;
