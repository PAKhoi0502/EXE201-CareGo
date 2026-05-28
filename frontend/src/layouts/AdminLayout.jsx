import { NavLink, Outlet, useNavigate } from "react-router";
import { Button } from "../components/Ui.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const navItems = [
  {
    label: "Tổng quan",
    to: "/admin",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 13h8V3H3v10zm10 8h8V11h-8v10zM3 21h8v-6H3v6zm10-18v6h8V3h-8z" />
      </svg>
    ),
  },
  {
    label: "Người đồng hành",
    to: "/admin/companions",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M16 11a4 4 0 1 0-8 0" />
        <path d="M12 15c-4.418 0-8 2.239-8 5v1h16v-1c0-2.761-3.582-5-8-5z" />
        <path d="M20 8a3 3 0 1 1-6 0" />
      </svg>
    ),
  },
  {
    label: "Người dùng",
    to: "/admin/users",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4z" />
        <path d="M4 20a8 8 0 0 1 16 0" />
      </svg>
    ),
  },
  {
    label: "Quản lý booking",
    to: "/admin/bookings",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M7 3v4M17 3v4M3 9h18" />
        <rect x="3" y="5" width="18" height="16" rx="2" />
      </svg>
    ),
  },
  {
    label: "Dịch vụ",
    to: "/admin/services",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 7h16M4 12h16M4 17h10" />
      </svg>
    ),
  },
  {
    label: "Báo cáo",
    to: "/admin/reports",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 19h16" />
        <path d="M8 17V9m4 8V5m4 12v-6" />
      </svg>
    ),
  },
];

const AdminLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#f5fbfa] text-slate-800">
      <aside className="hidden w-64 flex-col justify-between bg-teal-800 text-white md:flex">
        <div>
          <div className="flex items-center gap-3 border-b border-teal-700/80 p-5">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-teal-700 text-xl font-black text-white shadow-lg shadow-teal-700/25">
            +
          </span>
            <div>
              <h1 className="text-lg font-bold leading-tight">CareGo</h1>
              <span className="text-xs text-teal-200">Nền tảng chăm sóc</span>
            </div>
          </div>

          <nav className="space-y-2 p-4">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/admin"}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${isActive ? "bg-teal-950 text-white shadow" : "text-teal-100 hover:bg-teal-700"
                  }`
                }
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-white">
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="border-t border-teal-700/80 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-teal-400 bg-teal-100 text-sm font-bold text-teal-800">
              {user?.name?.slice(0, 2)?.toUpperCase() || "AD"}
            </div>
            <div className="min-w-0">
              <h4 className="truncate text-sm font-semibold">{user?.name || "Admin"}</h4>
              <span className="text-xs text-teal-300">Quản trị viên</span>
            </div>
          </div>
          <Button
            variant="danger"
            className="mt-4 flex w-full items-center justify-center gap-2"
            onClick={handleLogout}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="M16 17l5-5-5-5" />
              <path d="M21 12H9" />
            </svg>
            Đăng xuất
          </Button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-y-auto">
        <header className="sticky top-0 z-10 flex min-h-16 items-center justify-between border-b border-slate-200/70 bg-white/90 px-4 backdrop-blur md:px-6">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-800 font-bold text-white md:hidden">
              CG
            </div>
            <h2 className="text-lg font-bold text-slate-800 md:text-xl">Hệ thống quản lý CareGo</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative cursor-pointer rounded-full bg-rose-50 p-2 text-rose-600">
              <span className="text-lg">!</span>
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-rose-600" />
            </div>
            <span className="hidden text-sm font-medium text-slate-500 sm:inline">
              Hôm nay: {new Intl.DateTimeFormat("vi-VN").format(new Date())}
            </span>
          </div>
        </header>

        <div className="border-b border-slate-200 bg-white px-4 py-3 md:hidden">
          <nav className="flex gap-2 overflow-x-auto">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/admin"}
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold ${isActive ? "bg-teal-800 text-white" : "bg-slate-100 text-slate-600"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 p-4 md:p-6">
          <Outlet />
        </main>

        <footer className="border-t border-slate-200 bg-white px-6 py-4 text-center text-xs text-slate-400">
          (c) 2026 CareGo - Nền tảng kết nối chăm sóc người cao tuổi.
        </footer>
      </div>
    </div>
  );
};

export default AdminLayout;
