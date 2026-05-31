import { NavLink, Outlet, useNavigate } from "react-router";
import { useAuth } from "../context/AuthContext.jsx";

const adminLinks = [
  { label: "Tổng quan", to: "/admin" },
  { label: "Người dùng", to: "/admin/users" },
  { label: "Người đồng hành", to: "/admin/companions" },
  { label: "Booking", to: "/admin/bookings" },
  { label: "Dịch vụ", to: "/admin/services" },
  { label: "Yêu cầu rút tiền", to: "/admin/withdrawals" },
  { label: "Báo cáo", to: "/admin/reports" },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#f5fbfa] text-slate-900">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r border-teal-900/10 bg-gradient-to-b from-teal-100 via-teal-50 to-emerald-100 shadow-xl shadow-teal-900/10 lg:flex">
        <div className="flex h-20 items-center gap-3 border-b border-teal-900/10 px-6">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-teal-700 to-teal-400 text-2xl font-black text-white shadow-lg shadow-teal-200">
            +
          </div>
          <div>
            <p className="text-2xl font-black text-teal-700">CareGo</p>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Admin
            </p>
          </div>
        </div>

        <nav className="space-y-2 p-4">
          {adminLinks.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/admin"}
              className={({ isActive }) =>
                [
                  "flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-extrabold transition",
                  isActive
                    ? "bg-teal-50 text-teal-700 shadow-sm"
                  : "text-slate-600 hover:bg-teal-50/70 hover:text-teal-700",
                ].join(" ")
              }
            >
              <span>{item.label}</span>
              {/* {item.to === "/admin/withdrawals" && (
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-700">
                  mới
                </span>
              )} */}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto p-4">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full rounded-2xl border border-red-100 bg-white/90 px-5 py-3 text-sm font-extrabold text-red-600 shadow-sm shadow-teal-900/5 transition hover:border-red-200 hover:bg-red-50"
          >
            Đăng xuất
          </button>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-teal-900/10 bg-[#f5fbfa]/90 backdrop-blur-xl">
          <div className="flex min-h-20 flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3 lg:hidden">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-teal-700 to-teal-400 text-xl font-black text-white">
                +
              </div>
              <div>
                <p className="text-xl font-black text-teal-700">CareGo</p>
                <p className="text-xs font-bold text-slate-400">Admin</p>
              </div>
            </div>

            <div className="flex gap-2 overflow-x-auto lg:hidden">
              {adminLinks.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/admin"}
                  className={({ isActive }) =>
                    [
                      "shrink-0 rounded-full px-4 py-2 text-xs font-extrabold",
                      isActive
                        ? "bg-teal-600 text-white"
                        : "bg-white text-slate-600 ring-1 ring-teal-100",
                    ].join(" ")
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>

            <div className="hidden lg:block">
              <p className="text-sm font-bold text-slate-400">Hệ thống quản trị</p>
              <h1 className="text-2xl font-black text-slate-900">CareGo Admin</h1>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="rounded-full border border-teal-100 bg-white px-5 py-2.5 text-sm font-extrabold text-slate-600 shadow-sm shadow-teal-900/5 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 lg:hidden"
            >
              Đăng xuất
            </button>
          </div>
        </header>

        <main className="p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
