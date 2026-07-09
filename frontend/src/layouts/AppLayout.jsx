import { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { api } from "../api/client.js";
import CareGoLogo from "../components/CareGoLogo.jsx";
import LandingNavbar from "../components/landing/LandingNavbar.jsx";
import NotificationBell from "../components/notifications/NotificationBell.jsx";
import SupportFloatingButton from "../components/support/SupportFloatingButton.jsx";
import BookingChatFloatingButton from "../components/booking-chat/BookingChatFloatingButton.jsx";
import { useAuth } from "../context/useAuth.js";
import { useAsync } from "../hooks/useAsync.js";
import { money } from "../utils/format.js";

const MenuIcon = ({ type, tone = "teal" }) => {
  const colors = {
    teal: "bg-teal-50 text-teal-700",
    emerald: "bg-emerald-50 text-emerald-700",
    rose: "bg-rose-50 text-rose-600",
    white: "bg-white/15 text-white",
  };

  const paths = {
    user: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7 8a7 7 0 0 0-14 0" />,
    plus: <path d="M12 5v14M5 12h14" />,
    calendar: <path d="M8 3v3m8-3v3M4 9h16M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />,
    check: <path d="m5 12 4 4L19 6" />,
    family: <path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8-1a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM3 20a6 6 0 0 1 12 0m-1.5-4.5A5 5 0 0 1 21 20" />,
    wallet: <path d="M4 7a2 2 0 0 1 2-2h12v14H6a2 2 0 0 1-2-2V7Zm12 6h4v4h-4a2 2 0 0 1 0-4Z" />,
    support: <path d="M4 12a8 8 0 0 1 16 0v5a2 2 0 0 1-2 2h-3m-6 0H6a2 2 0 0 1-2-2v-5Zm0 0h3v5H4m16-5h-3v5h3M9 21h6" />,
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

const companionWorkNavItems = [
  { to: "/companion/bookings", label: "Ca làm", icon: "calendar", end: true },
  { to: "/companion/bookings/history", label: "Lịch sử", icon: "check" },
  { to: "/companion/earnings", label: "Thu nhập", icon: "wallet", tone: "emerald" },
];

const companionCustomerNavItems = [
  { to: "/customer/bookings/new", label: "Đặt lịch", icon: "plus" },
  { to: "/customer/bookings", label: "Lịch đã đặt", icon: "calendar", end: true },
  { to: "/customer/elders", label: "Người thân", icon: "family" },
];

const companionAllNavItems = [...companionWorkNavItems, ...companionCustomerNavItems];

const companionStatusLabels = {
  pending: "đang chờ duyệt",
  approved: "đã được duyệt",
  rejected: "cần bổ sung thông tin",
  suspended: "đang tạm khóa",
};

const CompanionNavLink = ({ item, compact = false }) => (
  <NavLink
    to={item.to}
    end={item.end}
    className={({ isActive }) =>
      [
        "inline-flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full text-sm font-black transition",
        compact ? "px-3" : "px-3.5",
        isActive
          ? "bg-teal-700 text-white shadow-lg shadow-teal-700/15"
          : "text-slate-600 hover:bg-white hover:text-teal-800",
      ].join(" ")
    }
  >
    {({ isActive }) => (
      <>
        <MenuIcon type={item.icon} tone={isActive ? "white" : item.tone || "teal"} />
        <span>{item.label}</span>
      </>
    )}
  </NavLink>
);

const AppLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const vettingStatus = user?.companionProfile?.vettingStatus;
  const isCustomerSection = location.pathname.startsWith("/customer");
  const isCustomerWorkspace = user?.role === "customer" || isCustomerSection;
  const isApprovedCompanionUser = user?.role === "companion" && vettingStatus === "approved";
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const { data: bookingsData } = useAsync(
    () => (isApprovedCompanionUser ? api.get("/bookings/my?as=companion") : { bookings: [] }),
    [isApprovedCompanionUser],
  );
  const { data: withdrawalSummary, reload: reloadWithdrawalSummary } = useAsync(
    () => (isApprovedCompanionUser ? api.get("/withdrawals/my") : null),
    [isApprovedCompanionUser],
  );

  const totalEarnings = useMemo(() => {
    const bookings = bookingsData?.bookings || [];
    return bookings
      .filter((booking) => booking.status === "paid")
      .reduce((sum, booking) => sum + ((booking.totalAmount || 0) - (booking.platformFee || 0)), 0);
  }, [bookingsData]);

  const availableWalletBalance = useMemo(() => {
    const value =
      withdrawalSummary?.availableBalance ??
      withdrawalSummary?.available ??
      withdrawalSummary?.balance ??
      withdrawalSummary?.walletBalance ??
      withdrawalSummary?.canWithdraw;

    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : totalEarnings;
  }, [withdrawalSummary, totalEarnings]);

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
    navigate("/login");
  };

  useEffect(() => {
    if (!menuOpen) return undefined;

    const closeOnOutsideClick = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!isApprovedCompanionUser) return undefined;

    const timer = window.setInterval(() => {
      reloadWithdrawalSummary?.();
    }, 5000);

    return () => window.clearInterval(timer);
  }, [isApprovedCompanionUser, reloadWithdrawalSummary]);

  if (isCustomerWorkspace) {
    return (
      <div className="min-h-screen bg-[#f5fbfa] text-slate-900">
        <LandingNavbar />
        <main className="mx-auto w-[min(1180px,92%)] py-7">
          <Outlet />
        </main>
        <BookingChatFloatingButton />
        <SupportFloatingButton />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5fbfa] text-slate-900">
      <header className="sticky top-0 z-40 border-b border-teal-900/10 bg-[#f5fbfa]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-20 w-[min(1180px,92%)] items-center justify-between gap-4">
          <Link to="/companion/bookings">
            <CareGoLogo subtitle="Người đồng hành" />
          </Link>

          <div className="flex items-center gap-3">
            <NotificationBell />
            <div ref={menuRef} className="relative">
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
                  <span className="block text-xs font-semibold text-slate-500">Người đồng hành</span>
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
                        <p className="font-black text-[#12312f]">{user?.name || "Người đồng hành"}</p>
                        <p className="mt-1 text-xs text-slate-500">{user?.email || ""}</p>
                      </div>
                    </div>
                    <div className="mt-3 rounded-2xl border border-teal-100 bg-white/80 px-3 py-2">
                      <p className="text-[11px] font-semibold uppercase text-slate-400">Thu nhập ví</p>
                      <p className="mt-1 text-sm font-black text-emerald-700">{money(availableWalletBalance)}</p>
                      <Link
                        to="/companion/withdrawals"
                        onClick={() => setMenuOpen(false)}
                        className="mt-3 flex min-h-10 items-center justify-center rounded-2xl bg-gradient-to-r from-teal-700 to-emerald-500 px-4 text-xs font-black text-white shadow-lg shadow-teal-700/20 transition hover:-translate-y-0.5"
                      >
                        Rút tiền
                      </Link>
                    </div>
                  </div>

                  <div className="grid gap-1 p-2 text-sm font-bold text-slate-600">
                    <Link
                      onClick={() => setMenuOpen(false)}
                      to="/companion/profile"
                      className="flex items-center gap-2 rounded-2xl px-4 py-3 transition hover:bg-teal-50 hover:text-teal-800"
                    >
                      <MenuIcon type="user" />
                      Trang cá nhân
                    </Link>
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
          </div>
        </div>
      </header>

      <div className="sticky top-20 z-30 border-b border-teal-900/10 bg-white/80 py-3 backdrop-blur">
        <nav
          className="mx-auto flex w-[min(1180px,92%)] gap-2 overflow-x-auto 2xl:justify-center"
          aria-label="Điều hướng người đồng hành"
        >
          {companionAllNavItems.map((item) => (
            <CompanionNavLink key={item.to} item={item} compact />
          ))}
        </nav>
      </div>

      {user?.role === "companion" && vettingStatus !== "approved" ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Hồ sơ người đồng hành của bạn <b>{companionStatusLabels[vettingStatus] || "đang được kiểm tra"}</b>.
          Bạn có thể xem thông tin tài khoản, nhưng chỉ được nhận và cập nhật ca sau khi CareGo duyệt hồ sơ.
        </div>
      ) : null}

      <main className="mx-auto w-[min(1180px,92%)] py-7">
        <Outlet />
      </main>
      <BookingChatFloatingButton />
      <SupportFloatingButton />
    </div>
  );
};

export default AppLayout;
