import { NavLink, Outlet, useNavigate } from "react-router";
import { Button } from "../components/Ui.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const navItems = [
  { label: "Tong quan", to: "/admin", icon: "◇" },
  { label: "Sinh vien Companion", to: "/admin/companions", icon: "✚" },
  { label: "Người dùng", to: "/admin/users", icon: "◉" },
  { label: "Quan ly lịch đặt", to: "/admin/bookings", icon: "✓" },
  { label: "Dich vu", to: "/admin/services", icon: "▣" },
];

const AdminLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-800">
      <aside className="hidden w-64 flex-col justify-between bg-teal-800 text-white md:flex">
        <div>
          <div className="flex items-center gap-3 border-b border-teal-700 p-5">
            <div className="rounded-lg bg-white px-3 py-2 text-xl font-bold text-teal-800">CG</div>
            <div>
              <h1 className="text-lg font-bold leading-tight">CareGo</h1>
              <span className="text-xs text-teal-200">Nut Bam Hieu Thao</span>
            </div>
          </div>

          <nav className="space-y-2 p-4">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/admin"}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                    isActive ? "bg-teal-900 text-white" : "text-teal-100 hover:bg-teal-700"
                  }`
                }
              >
                <span className="flex w-5 justify-center text-base">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="border-t border-teal-700 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-teal-400 bg-teal-100 text-sm font-bold text-teal-800">
              {user?.name?.slice(0, 2)?.toUpperCase() || "AD"}
            </div>
            <div className="min-w-0">
              <h4 className="truncate text-sm font-semibold">{user?.name || "Admin"}</h4>
              <span className="text-xs text-teal-300">Quan tri vien QA</span>
            </div>
          </div>
          <Button variant="secondary" className="mt-4 w-full border-teal-600 bg-teal-900 text-white hover:bg-teal-700" onClick={handleLogout}>
            Dang xuat
          </Button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-y-auto">
        <header className="sticky top-0 z-10 flex min-h-16 items-center justify-between border-b border-slate-200 bg-white px-4 md:px-6">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-800 font-bold text-white md:hidden">
              CG
            </div>
            <h2 className="text-lg font-bold text-slate-800 md:text-xl">He thong Quan ly CareGo</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative cursor-pointer rounded-full bg-rose-50 p-2 text-rose-600">
              <span className="text-lg">!</span>
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-rose-600" />
            </div>
            <span className="hidden text-sm font-medium text-slate-500 sm:inline">
              Hom nay: {new Intl.DateTimeFormat("vi-VN").format(new Date())}
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
                  `whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${
                    isActive ? "bg-teal-800 text-white" : "bg-slate-100 text-slate-600"
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
          © 2026 CareGo - Nen tang ket noi Cham soc Nguoi cao tuoi.
        </footer>
      </div>
    </div>
  );
};

export default AdminLayout;
