import { NavLink, Outlet, useNavigate } from "react-router";
import { useAuth } from "../context/AuthContext.jsx";
import { Button, StatusBadge } from "../components/Ui.jsx";
import LandingNavbar from "../components/landing/LandingNavbar.jsx";

const navByRole = {
  customer: [
    ["Tong quan", "/customer"],
    ["Dich vu", "/customer/services"],
    ["Nguoi than", "/customer/elders"],
    ["Nguoi dong hanh", "/customer/companions"],
    ["Dat lich", "/customer/bookings/new"],
    ["Lich cua toi", "/customer/bookings"],
  ],
  companion: [
    ["Tong quan", "/companion"],
    ["Ca lam", "/companion/bookings"],
  ],
  admin: [
    ["Dashboard", "/admin"],
    ["Dich vu", "/admin/services"],
    ["Nguoi dong hanh", "/admin/companions"],
    ["Nguoi dung", "/admin/users"],
    ["Booking", "/admin/bookings"],
  ],
};

const AppLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const navItems = navByRole[user?.role] || [];
  const vettingStatus = user?.companionProfile?.vettingStatus;
  const isCustomer = user?.role === "customer";

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  if (isCustomer) {
    return (
      <div className="min-h-screen bg-[#f5fbfa] text-slate-900">
        <LandingNavbar />
        <main className="mx-auto w-[min(1180px,92%)] py-7">
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-md bg-teal-700 font-black text-white">
              CG
            </div>
            <div>
              <p className="font-black text-slate-950">CareGo</p>
              <p className="text-xs text-slate-500">Can cham soc la co ngay</p>
            </div>
          </div>

          <nav className="flex flex-wrap gap-2">
            {navItems.map(([label, to]) => (
              <NavLink
                key={to}
                to={to}
                end={to === `/${user.role}`}
                className={({ isActive }) =>
                  `rounded-md px-3 py-2 text-sm font-bold transition ${
                    isActive ? "bg-teal-50 text-teal-800" : "text-slate-600 hover:bg-slate-100"
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {vettingStatus ? <StatusBadge status={vettingStatus} /> : null}
            <div className="text-right">
              <p className="text-sm font-bold">{user?.name}</p>
              <p className="text-xs text-slate-500">{user?.role}</p>
            </div>
            <Button variant="secondary" onClick={handleLogout}>
              Dang xuat
            </Button>
          </div>
        </div>
      </header>

      {user?.role === "companion" && vettingStatus !== "approved" ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Ho so nguoi dong hanh cua ban dang o trang thai <b>{vettingStatus || "pending"}</b>.
          Ban co the dang nhap de theo doi, nhung chi duoc nhan/cap nhat ca sau khi admin duyet.
        </div>
      ) : null}

      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
};

export default AppLayout;
