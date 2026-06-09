import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import { useAuth } from "../../context/AuthContext.jsx";

export default function SupportFloatingButton() {
  const { user } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const supportPath = user?.role === "companion" ? "/companion/support" : "/customer/support";

  useEffect(() => {
    if (!open) return undefined;

    const closeOnOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    const closeOnEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  if (!user || user.role === "admin" || location.pathname.endsWith("/support")) {
    return null;
  }

  return (
    <div ref={containerRef} className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3 sm:bottom-7 sm:right-7">
      {open ? (
        <section className="w-[min(340px,calc(100vw-40px))] overflow-hidden rounded-[26px] border border-teal-100 bg-white shadow-2xl shadow-teal-950/20">
          <div className="bg-gradient-to-br from-teal-700 to-cyan-500 p-5 text-white">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-teal-100">CareGo Support</p>
                <h2 className="mt-1 text-xl font-black">Bạn cần hỗ trợ?</h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Đóng hỗ trợ"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/15 text-lg font-bold transition hover:bg-white/25"
              >
                ×
              </button>
            </div>
            <p className="mt-3 text-sm font-semibold leading-6 text-white/80">
              Gửi vấn đề về booking, tài khoản, thanh toán hoặc an toàn cho CareGo Admin.
            </p>
          </div>

          <div className="p-4">
            <div className="flex gap-3 rounded-2xl border border-teal-100 bg-teal-50/70 p-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-teal-700 shadow-sm">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
                  <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 12a8 8 0 0 1 16 0v5a2 2 0 0 1-2 2h-3m-6 0H6a2 2 0 0 1-2-2v-5" />
                    <path d="M4 12h3v5H4m16-5h-3v5h3M9 21h6" />
                  </g>
                </svg>
              </span>
              <div>
                <p className="text-sm font-black text-[#12312f]">Chat trực tiếp với Admin</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Theo dõi phản hồi và lịch sử hỗ trợ tại một nơi.
                </p>
              </div>
            </div>

            <Link
              to={supportPath}
              onClick={() => setOpen(false)}
              className="mt-4 flex min-h-12 items-center justify-center rounded-2xl bg-teal-700 px-5 text-sm font-black text-white transition hover:bg-teal-800"
            >
              Mở trung tâm hỗ trợ
            </Link>
          </div>
        </section>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label="Mở hỗ trợ CareGo"
        aria-expanded={open}
        className="group flex h-14 items-center gap-3 rounded-full bg-teal-700 px-4 text-white shadow-2xl shadow-teal-900/30 transition hover:-translate-y-1 hover:bg-teal-800 sm:h-16 sm:px-5"
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0" fill="none" aria-hidden="true">
          <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12a8 8 0 0 1 16 0v5a2 2 0 0 1-2 2h-3m-6 0H6a2 2 0 0 1-2-2v-5" />
            <path d="M4 12h3v5H4m16-5h-3v5h3M9 21h6" />
          </g>
        </svg>
        <span className="hidden text-left sm:block">
          <span className="block text-sm font-black">Hỗ trợ</span>
          <span className="block text-[10px] font-semibold text-white/70">Chat với Admin</span>
        </span>
      </button>
    </div>
  );
}
