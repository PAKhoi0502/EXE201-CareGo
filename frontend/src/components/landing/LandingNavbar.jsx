import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import CareGoLogo from "../CareGoLogo.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import NotificationBell from "../notifications/NotificationBell.jsx";
import LandingButton from "./LandingButton.jsx";
import { hasCustomerAccess, isApprovedCompanion } from "../../utils/authNavigation.js";

const navItems = [
  ["Dịch vụ", "#services"],
  ["Quy trình", "#steps"],
  ["Người đồng hành", "#companion-join"],
  ["An toàn", "#safety"],
  ["Liên hệ", "#contact"],
  ["Blog", "/blog"],
];

const getInitial = (name = "C") => name.trim().charAt(0).toUpperCase() || "C";

const MenuIcon = ({ type, tone = "teal" }) => {
  const colors = {
    teal: "bg-teal-50 text-teal-700",
    rose: "bg-rose-50 text-rose-600",
  };

  const paths = {
    user: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7 8a7 7 0 0 0-14 0" />,
    plus: <path d="M12 5v14M5 12h14" />,
    calendar: <path d="M8 3v3m8-3v3M4 9h16M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />,
    family: <path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8-1a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM3 20a6 6 0 0 1 12 0m-1.5-4.5A5 5 0 0 1 21 20" />,
    support: <path d="M4 12a8 8 0 0 1 16 0v5a2 2 0 0 1-2 2h-3m-6 0H6a2 2 0 0 1-2-2v-5Zm0 0h3v5H4m16-5h-3v5h3M9 21h6" />,
    wallet: <path d="M4 7a2 2 0 0 1 2-2h12v14H6a2 2 0 0 1-2-2V7Zm12 6h4v4h-4a2 2 0 0 1 0-4Z" />,
    logout: <path d="M10 17H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h4m5 10 5-5-5-5m5 5H9" />,
  };

  return (
    <span className={`grid h-7 w-7 place-items-center rounded-full ${colors[tone] || colors.teal}`}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {paths[type]}
        </g>
      </svg>
    </span>
  );
};

const UserAvatar = ({ user, className = "h-10 w-10", fallbackClassName = "" }) =>
  user?.avatar?.url ? (
    <img
      src={user.avatar.url}
      alt={user.avatar.alt || user.name || "Avatar"}
      className={`${className} rounded-full object-cover ${fallbackClassName}`}
    />
  ) : (
    <span className={`grid ${className} place-items-center rounded-full bg-gradient-to-br from-teal-100 to-sky-100 text-sm font-black text-teal-800 ${fallbackClassName}`}>
      {getInitial(user?.name)}
    </span>
  );

const LandingNavbar = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const canUseCustomerWorkspace = hasCustomerAccess(user);
  const isCompanion = user?.role === "companion";
  const isApprovedCompanionUser = isApprovedCompanion(user);
  const bookingPath = canUseCustomerWorkspace ? "/customer/bookings/new" : "/register";
  const sectionNavItems = navItems.map(([label, href]) => [
    label,
    href.startsWith("#") && (location.pathname !== "/" || canUseCustomerWorkspace) ? `/${href}` : href,
  ]);
  const roleLabel = isCompanion ? "Khách hàng & đồng hành" : "Khách hàng";

  const handleLogout = () => {
    logout();
    setOpen(false);
    navigate("/");
  };

  useEffect(() => {
    if (!open) return undefined;

    const closeOnOutsideClick = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-teal-900/10 bg-[#f5fbfa]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-20 w-[min(1180px,92%)] items-center justify-between">
        <Link to="/">
          <CareGoLogo />
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-bold text-slate-600 md:flex">
          {sectionNavItems.map(([label, href]) =>
            href.startsWith("/") ? (
              <Link key={href} to={href} className="transition hover:text-teal-800">
                {label}
              </Link>
            ) : (
              <a key={href} href={href} className="transition hover:text-teal-800">
                {label}
              </a>
            )
          )}
        </nav>

        <div className="flex items-center gap-3">
          {canUseCustomerWorkspace ? <NotificationBell /> : null}
          {user ? (
            <div ref={menuRef} className="relative">
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpen((current) => !current)}
                className="flex items-center gap-3 rounded-full border border-teal-100 bg-white py-2 pl-2 pr-4 shadow-lg shadow-teal-900/5 transition hover:border-teal-300"
              >
                <UserAvatar user={user} />
                <span className="hidden text-left sm:block">
                  <span className="block text-sm font-black text-[#12312f]">{user.name}</span>
                  <span className="block text-xs font-semibold text-slate-500">
                    {roleLabel}
                  </span>
                </span>
                <span className={`grid h-6 w-6 place-items-center rounded-full bg-teal-50 text-teal-700 transition ${open ? "rotate-180" : "rotate-0"}`}>
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </button>

              {open ? (
                <div className="absolute right-0 mt-3 w-72 overflow-hidden rounded-[28px] border border-teal-100 bg-white shadow-2xl shadow-teal-900/15">
                  <div className="border-b border-teal-50 bg-gradient-to-r from-teal-50 to-sky-50 p-4">
                    <div className="flex items-center gap-3">
                      <UserAvatar user={user} className="h-11 w-11" fallbackClassName="bg-white text-base text-teal-700 shadow-sm" />
                      <div>
                        <p className="font-black text-[#12312f]">{user.name}</p>
                        <p className="mt-1 text-xs text-slate-500">{user.email}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-1 p-2 text-sm font-bold text-slate-600">
                    {canUseCustomerWorkspace ? (
                      <>
                        <Link
                          onClick={() => setOpen(false)}
                          to="/customer/profile"
                          className="flex items-center gap-2 rounded-2xl px-4 py-3 transition hover:bg-teal-50 hover:text-teal-800"
                        >
                          <MenuIcon type="user" />
                          Hồ sơ cá nhân
                        </Link>
                        <Link
                          onClick={() => setOpen(false)}
                          to="/customer/bookings/new"
                          className="flex items-center gap-2 rounded-2xl px-4 py-3 transition hover:bg-teal-50 hover:text-teal-800"
                        >
                          <MenuIcon type="plus" />
                          Đặt lịch chăm sóc
                        </Link>
                        <Link
                          onClick={() => setOpen(false)}
                          to="/customer/bookings"
                          className="flex items-center gap-2 rounded-2xl px-4 py-3 transition hover:bg-teal-50 hover:text-teal-800"
                        >
                          <MenuIcon type="calendar" />
                          Lịch của tôi
                        </Link>
                        <Link
                          onClick={() => setOpen(false)}
                          to="/customer/elders"
                          className="flex items-center gap-2 rounded-2xl px-4 py-3 transition hover:bg-teal-50 hover:text-teal-800"
                        >
                          <MenuIcon type="family" />
                          Hồ sơ người thân
                        </Link>
                      </>
                    ) : null}
                    {isCompanion ? (
                      <>
                        <div className="my-1 h-px bg-teal-50" />
                        <Link
                          onClick={() => setOpen(false)}
                          to={isApprovedCompanionUser ? "/companion/bookings" : "/companion-status"}
                          className="flex items-center gap-2 rounded-2xl px-4 py-3 transition hover:bg-teal-50 hover:text-teal-800"
                        >
                          <MenuIcon type="calendar" />
                          Khu người đồng hành
                        </Link>
                        {isApprovedCompanionUser ? (
                          <Link
                            onClick={() => setOpen(false)}
                            to="/companion/earnings"
                            className="flex items-center gap-2 rounded-2xl px-4 py-3 transition hover:bg-teal-50 hover:text-teal-800"
                          >
                            <MenuIcon type="wallet" />
                            Thu nhập companion
                          </Link>
                        ) : null}
                      </>
                    ) : null}
                    <div className="my-1 h-px bg-teal-50" />
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex items-center gap-2 rounded-2xl px-4 py-3 text-left font-bold text-rose-600 transition hover:bg-rose-50"
                    >
                      <MenuIcon type="logout" tone="rose" />
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
