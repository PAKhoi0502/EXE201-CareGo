import { useMemo, useState } from "react";
import { api } from "../../api/client.js";
import { Button, StatusBadge } from "../../components/Ui.jsx";
import { useAsync } from "../../hooks/useAsync.js";

const initials = (name = "CG") =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const vettingLabel = {
  pending: "Cho xac thuc",
  approved: "Da duyet",
  rejected: "Tu choi",
  suspended: "Tam khoa",
};

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

  const users = usersData?.users || [];
  const companions = companionsData?.companions || [];
  const customers = users.filter((user) => user.role === "customer");
  const activeUsers = users.filter((user) => user.isActive).length;
  const pendingCompanions = companions.filter((item) => item.vettingStatus === "pending");
  const approvedCompanions = companions.filter((item) => item.vettingStatus === "approved");
  const healthMajorCount = companions.filter((item) =>
    `${item.major || ""} ${item.university || ""}`.toLowerCase().match(/y|duoc|dieu duong|tam ly/),
  ).length;

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
    await api.patch(`/companions/${id}/status`, { vettingStatus });
    reloadCompanions();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tong Quan Ly Nguoi Dung</h1>
          <p className="mt-1 text-sm text-slate-500">
            Dieu phoi tai khoan khach hang, sinh vien dong hanh va quy trinh kiem duyet.
          </p>
        </div>
        <div className="relative w-full lg:w-96">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tim ten, email, so dien thoai..."
            className="min-h-11 w-full rounded-xl border border-transparent bg-slate-100 px-4 pl-10 text-sm outline-none transition focus:border-teal-300 focus:bg-white focus:ring-2 focus:ring-teal-100"
          />
          <span className="absolute left-3 top-2.5 text-slate-400">⌕</span>
        </div>
      </div>

      {error ? <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="block text-xs font-medium text-slate-400">Tong khach hang</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-800">{customers.length}</span>
            <span className="text-xs font-semibold text-emerald-600">active data</span>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="block text-xs font-medium text-slate-400">Sinh vien onboard</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-teal-700">{approvedCompanions.length}</span>
            <span className="text-xs text-slate-400">
              {companions.length ? Math.round((healthMajorCount / companions.length) * 100) : 0}% khoi suc khoe
            </span>
          </div>
        </div>
        <div className="rounded-xl border-l-4 border-amber-500 bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <span className="block text-xs font-medium text-amber-600">Ho so cho xac thuc</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-800">{pendingCompanions.length}</span>
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
              Moi nhan
            </span>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="block text-xs font-semibold text-slate-400">Ty le hoat dong</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-blue-600">
              {users.length ? Math.round((activeUsers / users.length) * 100) : 0}%
            </span>
            <span className="text-xs text-slate-400">tai khoan active</span>
          </div>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 bg-slate-50/70 p-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex w-full rounded-xl bg-slate-200 p-1 sm:w-fit">
            <button
              className={`rounded-lg px-4 py-2 text-xs font-bold transition ${
                activeTab === "companions" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
              onClick={() => setActiveTab("companions")}
            >
              Sinh vien dong hanh ({companions.length})
            </button>
            <button
              className={`rounded-lg px-4 py-2 text-xs font-bold transition ${
                activeTab === "customers" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
              onClick={() => setActiveTab("customers")}
            >
              Khach hang con cai ({customers.length})
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
                    {major === "all" ? "Chuyen nganh: Tat ca" : major}
                  </option>
                ))}
              </select>
            ) : null}
            <select
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 outline-none focus:ring-2 focus:ring-teal-100"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">Trang thai: Tat ca</option>
              {activeTab === "companions" ? (
                <>
                  <option value="approved">Da duyet</option>
                  <option value="pending">Cho xac thuc</option>
                  <option value="rejected">Tu choi</option>
                  <option value="suspended">Tam khoa</option>
                </>
              ) : (
                <>
                  <option value="active">Hoat dong</option>
                  <option value="suspended">Tam khoa</option>
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
                  <th className="p-4">Thong tin Companion</th>
                  <th className="p-4">Xac thuc 3 lop</th>
                  <th className="p-4">Ky nang chuyen mon</th>
                  <th className="p-4">Danh gia he thong</th>
                  <th className="p-4">Trang thai</th>
                  <th className="p-4 text-right">Thao tac</th>
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
                            {item.userId?.email} | {item.university || "Chua co truong"} ({item.major || "Chua co nganh"})
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="space-y-1 p-4">
                      <div className="flex items-center gap-1.5 font-semibold text-emerald-600">
                        <span>●</span> <span>L1: CCCD/The SV {item.documents?.citizenId ? "da nhap" : "cho bo sung"}</span>
                      </div>
                      <div className="flex items-center gap-1.5 font-semibold text-emerald-600">
                        <span>●</span> <span>L2: Ky nang mem</span>
                      </div>
                      <div
                        className={`flex items-center gap-1.5 font-semibold ${
                          item.vettingStatus === "approved" ? "text-emerald-600" : "text-amber-600"
                        }`}
                      >
                        <span>●</span> <span>L3: {item.vettingStatus === "approved" ? "Hoan tat" : "Cho admin duyet"}</span>
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
                      <p className="font-bold text-slate-700">{item.completedBookings || 0} ca hoan thanh</p>
                      <span className="font-medium text-amber-500">
                        ★★★★★ {Number(item.ratingAverage || 0).toFixed(1)}
                      </span>
                    </td>
                    <td className="p-4">
                      <StatusBadge status={item.vettingStatus} />
                      <p className="mt-1 text-[11px] font-semibold text-slate-400">
                        {vettingLabel[item.vettingStatus] || item.vettingStatus}
                      </p>
                    </td>
                    <td className="space-x-1 whitespace-nowrap p-4 text-right">
                      {item.vettingStatus === "pending" ? (
                        <>
                          <Button className="min-h-8 px-2.5 text-xs" onClick={() => updateCompanionStatus(item._id, "approved")}>
                            Phe duyet
                          </Button>
                          <Button
                            variant="secondary"
                            className="min-h-8 px-2.5 text-xs"
                            onClick={() => updateCompanionStatus(item._id, "rejected")}
                          >
                            Tu choi
                          </Button>
                        </>
                      ) : (
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
                          {item.vettingStatus === "suspended" ? "Mo khoa" : "Tam khoa"}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {!filteredCompanions.length ? (
                  <tr>
                    <td colSpan="6" className="p-8 text-center text-sm text-slate-400">
                      Khong tim thay companion phu hop.
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
                  <th className="p-4">Khach hang</th>
                  <th className="p-4">Lien he</th>
                  <th className="p-4">Vai tro</th>
                  <th className="p-4">Trang thai</th>
                  <th className="p-4 text-right">Thao tac</th>
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
                      <p className="text-xs">{user.phone || "Chua co so dien thoai"}</p>
                    </td>
                    <td className="p-4">
                      <StatusBadge status={user.role} />
                    </td>
                    <td className="p-4">
                      <StatusBadge status={user.isActive ? "approved" : "suspended"} />
                    </td>
                    <td className="p-4 text-right">
                      <Button
                        variant={user.isActive ? "danger" : "secondary"}
                        className="min-h-8 px-2.5 text-xs"
                        onClick={() => toggleUserStatus(user)}
                      >
                        {user.isActive ? "Khoa" : "Mo khoa"}
                      </Button>
                    </td>
                  </tr>
                ))}
                {!filteredCustomers.length ? (
                  <tr>
                    <td colSpan="5" className="p-8 text-center text-sm text-slate-400">
                      Khong tim thay khach hang phu hop.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 p-4 text-xs">
          <span className="font-medium text-slate-500">
            Hien thi {activeTab === "companions" ? filteredCompanions.length : filteredCustomers.length} ban ghi
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
    </div>
  );
};

export default AdminUsersPage;
