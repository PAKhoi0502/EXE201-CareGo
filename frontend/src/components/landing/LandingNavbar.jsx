import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../../context/AuthContext.jsx";
import LandingButton from "./LandingButton.jsx";

const navItems = [
  ["Dịch vụ", "#services"],
  ["Quy trình", "#steps"],
  ["Người đồng hành", "#companion-join"],
  ["An toàn", "#safety"],
  ["Liên hệ", "#contact"],
];

const getInitial = (name = "C") => name.trim().charAt(0).toUpperCase() || "C";

const LandingNavbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const isCustomer = user?.role === "customer";
  const bookingPath = isCustomer ? "/customer/bookings/new" : "/register";
  const sectionNavItems = isCustomer
    ? navItems.map(([label, href]) => [label, `/${href}`])
    : navItems;

  const handleLogout = () => {
    logout();
    setOpen(false);
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-40 border-b border-teal-900/10 bg-[#f5fbfa]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-20 w-[min(1180px,92%)] items-center justify-between">
        <Link to="/" className="flex items-center gap-3 text-2xl font-black text-teal-800">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-teal-700 text-xl font-black text-white shadow-lg shadow-teal-700/25">
            +
          </span>
          CareGo
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-bold text-slate-600 md:flex">
          {sectionNavItems.map(([label, href]) => (
            <a key={href} href={href} className="transition hover:text-teal-800">
              {label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {user ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpen((current) => !current)}
                className="flex items-center gap-3 rounded-full border border-teal-100 bg-white py-2 pl-2 pr-4 shadow-lg shadow-teal-900/5 transition hover:border-teal-300"
              >
                <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-teal-100 to-sky-100 text-sm font-black text-teal-800">
                  {getInitial(user.name)}
                </span>
                <span className="hidden text-left sm:block">
                  <span className="block text-sm font-black text-[#12312f]">{user.name}</span>
                  <span className="block text-xs font-semibold text-slate-500">
                    {isCustomer ? "Khách hàng" : user.role}
                  </span>
                </span>
                <span className="text-xs font-black text-teal-700">{open ? "^" : "v"}</span>
              </button>

              {open ? (
                <div className="absolute right-0 mt-3 w-64 overflow-hidden rounded-3xl border border-teal-100 bg-white shadow-2xl shadow-teal-900/15">
                  <div className="border-b border-teal-50 p-4">
                    <p className="font-black text-[#12312f]">{user.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{user.email}</p>
                  </div>
                  <div className="grid p-2 text-sm font-bold text-slate-600">
                    {isCustomer ? (
                      <>
                        <Link onClick={() => setOpen(false)} to="/customer/bookings/new" className="rounded-2xl px-4 py-3 hover:bg-teal-50 hover:text-teal-800">
                          Đặt lịch chăm sóc
                        </Link>
                        <Link onClick={() => setOpen(false)} to="/customer/bookings" className="rounded-2xl px-4 py-3 hover:bg-teal-50 hover:text-teal-800">
                          Lịch của tôi
                        </Link>
                        <Link onClick={() => setOpen(false)} to="/customer/elders" className="rounded-2xl px-4 py-3 hover:bg-teal-50 hover:text-teal-800">
                          Hồ sơ người thân
                        </Link>
                      </>
                    ) : null}
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="rounded-2xl px-4 py-3 text-left font-bold text-rose-600 hover:bg-rose-50"
                    >
                      Đăng xuất
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <LandingButton to="/login" variant="secondary" className="hidden sm:inline-flex">
              Đăng nhập
            </LandingButton>
          )}
          <LandingButton to={bookingPath}>Đặt lịch</LandingButton>
        </div>
      </div>
    </header>
  );
};

export default LandingNavbar;
