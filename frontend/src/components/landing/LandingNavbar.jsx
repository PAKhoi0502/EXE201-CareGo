import LandingButton from "./LandingButton.jsx";

const navItems = [
  ["Dịch vụ", "#services"],
  ["Quy trình", "#steps"],
  ["An toàn", "#safety"],
  ["Liên hệ", "#contact"],
];

const LandingNavbar = () => (
  <header className="sticky top-0 z-40 border-b border-teal-900/10 bg-[#f5fbfa]/90 backdrop-blur-xl">
    <div className="mx-auto flex h-20 w-[min(1180px,92%)] items-center justify-between">
      <a href="#" className="flex items-center gap-3 text-2xl font-black text-teal-800">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-teal-700 text-xl font-black text-white shadow-lg shadow-teal-700/25">
          +
        </span>
        CareGo
      </a>

      <nav className="hidden items-center gap-8 text-sm font-bold text-slate-600 md:flex">
        {navItems.map(([label, href]) => (
          <a key={href} href={href} className="transition hover:text-teal-800">
            {label}
          </a>
        ))}
      </nav>

      <div className="flex items-center gap-3">
        <LandingButton to="/login" variant="secondary" className="hidden sm:inline-flex">
          Đăng nhập
        </LandingButton>
        <LandingButton to="/register">Đặt lịch</LandingButton>
      </div>
    </div>
  </header>
);

export default LandingNavbar;
