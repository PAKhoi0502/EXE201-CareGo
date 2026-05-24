import { useState } from "react";
import { Link, Outlet, useNavigate } from "react-router";
import { useAuth } from "../context/AuthContext.jsx";
import { Button } from "../components/Ui.jsx";
import LandingNavbar from "../components/landing/LandingNavbar.jsx";

const AppLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const vettingStatus = user?.companionProfile?.vettingStatus;
  const isCustomer = user?.role === "customer";
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
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
    <div className="min-h-screen bg-[#f5fbfa] text-slate-900">
      <header className="sticky top-0 z-40 border-b border-teal-900/10 bg-[#f5fbfa]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-20 w-[min(1180px,92%)] items-center justify-between gap-4">
          <Link to="/companion" className="flex items-center gap-3 text-2xl font-black text-teal-800">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-teal-700 text-xl font-black text-white shadow-lg shadow-teal-700/25">
              +
            </span>
            <span>
              <span className="block leading-5">CareGo</span>
              <span className="block text-xs font-bold text-teal-700/70">Nguoi dong hanh</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-bold text-slate-600 md:flex">
            <a href="#newBookingSection" className="transition hover:text-teal-800">Booking moi</a>
            <a href="#activeShiftSection" className="transition hover:text-teal-800">GPS</a>
            <a href="#checklistSection" className="transition hover:text-teal-800">Checklist</a>
            <a href="#reportSection" className="transition hover:text-teal-800">Bao cao</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              to="/companion/bookings"
              className="hidden min-h-12 items-center justify-center rounded-full border border-teal-200 bg-white px-5 text-sm font-extrabold text-teal-800 transition hover:-translate-y-0.5 hover:bg-teal-50 sm:inline-flex"
            >
              Lich cua toi
            </Link>
            <div className="relative">
              <button
                type="button"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((open) => !open)}
                className="flex items-center gap-3 rounded-full border border-teal-100 bg-white py-2 pl-2 pr-4 shadow-lg shadow-teal-900/5 transition hover:border-teal-300"
              >
                <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-teal-100 to-sky-100 text-sm font-black text-teal-800">
                  {(user?.name || "C").trim().charAt(0).toUpperCase()}
                </span>
                <span className="hidden text-left sm:block">
                  <span className="block text-sm font-black text-[#12312f]">{user?.name}</span>
                  <span className="block text-xs font-semibold text-slate-500">Nguoi dong hanh</span>
                </span>
                <span className={`grid h-6 w-6 place-items-center rounded-full bg-teal-50 text-teal-700 transition ${menuOpen ? "rotate-180" : "rotate-0"}`}>
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </button>

              {menuOpen ? (
                <div className="absolute right-0 mt-3 w-72 overflow-hidden rounded-[28px] border border-teal-100 bg-white shadow-2xl shadow-teal-900/15">
                  <div className="border-b border-teal-50 bg-gradient-to-r from-teal-50 to-sky-50 p-4">
                    <div className="flex items-center gap-3">
                      <span className="grid h-11 w-11 place-items-center rounded-full bg-white text-base font-black text-teal-700 shadow-sm">
                        {(user?.name || "C").trim().charAt(0).toUpperCase()}
                      </span>
                      <div>
                        <p className="font-black text-[#12312f]">{user?.name || "Nguoi dong hanh"}</p>
                        <p className="mt-1 text-xs text-slate-500">{user?.email || ""}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-1 p-2 text-sm font-bold text-slate-600">
                    <Link
                      onClick={() => setMenuOpen(false)}
                      to="/companion/profile"
                      className="flex items-center gap-2 rounded-2xl px-4 py-3 transition hover:bg-teal-50 hover:text-teal-800"
                    >
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-teal-50 text-teal-700">👤</span>
                      Trang cá nhân
                    </Link>
                    <Link
                      onClick={() => setMenuOpen(false)}
                      to="/companion/bookings"
                      className="flex items-center gap-2 rounded-2xl px-4 py-3 transition hover:bg-teal-50 hover:text-teal-800"
                    >
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-teal-50 text-teal-700">🗓</span>
                      Lịch của tôi
                    </Link>
                    <div className="my-1 h-px bg-teal-50" />
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex items-center gap-2 rounded-2xl px-4 py-3 text-left font-bold text-rose-600 transition hover:bg-rose-50"
                    >
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-rose-50 text-rose-600">⎋</span>
                      Đăng xuất
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      {user?.role === "companion" && vettingStatus !== "approved" ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Ho so nguoi dong hanh cua ban dang o trang thai <b>{vettingStatus || "pending"}</b>.
          Ban co the theo doi tai khoan, nhung chi duoc nhan va cap nhat ca sau khi admin duyet.
        </div>
      ) : null}

      <main className="mx-auto w-[min(1180px,92%)] py-7">
        <Outlet />
      </main>
    </div>
  );
};

export default AppLayout;
