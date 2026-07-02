import { Link } from "react-router";
import { api } from "../../api/client.js";
import { useAsync } from "../../hooks/useAsync.js";
import CareGoLogo from "../CareGoLogo.jsx";
import LandingButton from "./LandingButton.jsx";
import { safetyItems, services, steps } from "./landingData.js";

const serviceIconPaths = {
  hospital: (
    <>
      <path d="M5 21V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v14" />
      <path d="M3 21h18" />
      <path d="M10 11h4" />
      <path d="M12 9v4" />
      <path d="M8 21v-4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v4" />
      <path d="M8 5V3h8v2" />
    </>
  ),
  home: (
    <>
      <path d="M4 11.5 12 5l8 6.5" />
      <path d="M6.5 10.5V20h11V10.5" />
      <path d="M10 20v-5h4v5" />
      <path d="M9 12h1" />
      <path d="M14 12h1" />
    </>
  ),
  walk: (
    <>
      <path d="M13 4a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z" />
      <path d="m10 8-2.5 4 3.5 2 1.5 6" />
      <path d="m11 14 3.5-2 2.5 3" />
      <path d="M8 12 5 20" />
      <path d="M13 8l2 2" />
    </>
  ),
};

const ServiceIcon = ({ type }) => (
  <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" aria-hidden="true">
    <g stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      {serviceIconPaths[type] || serviceIconPaths.hospital}
    </g>
  </svg>
);

export const SectionHeader = ({ title, children }) => (
  <div className="mx-auto mb-11 max-w-3xl text-center">
    <h2 className="text-3xl font-black text-[#12312f] sm:text-4xl lg:text-5xl">{title}</h2>
    <p className="mt-4 text-base leading-7 text-slate-500">{children}</p>
  </div>
);

export const ServicesSection = () => (
  <section id="services" className="py-20">
    <div className="mx-auto w-[min(1180px,92%)]">
      <SectionHeader title="Dịch vụ nổi bật">
        CareGo tập trung vào các nhu cầu chăm sóc quen thuộc của gia đình: đi khám, hỗ trợ tại nhà và đồng hành ngoài trời.
      </SectionHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        {services.map((service) => (
          <article
            key={service.title}
            className="rounded-[30px] border border-teal-100 bg-white p-7 shadow-xl shadow-teal-900/5 transition hover:-translate-y-1"
          >
            <div className="mb-5 grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-teal-100 to-sky-100 text-teal-800 shadow-inner shadow-white">
              <ServiceIcon type={service.icon} />
            </div>
            <h3 className="text-xl font-black text-[#12312f]">{service.title}</h3>
            <p className="mt-3 leading-7 text-slate-500">{service.description}</p>
            <ul className="mt-5 grid gap-3 text-sm font-bold text-slate-600">
              {service.points.map((point) => (
                <li key={point} className="flex gap-2">
                  <span className="text-teal-700">✓</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </div>
  </section>
);

export const StepsSection = () => (
  <section id="steps" className="border-y border-teal-100 bg-white py-20">
    <div className="mx-auto w-[min(1180px,92%)]">
      <SectionHeader title="Quy trình đặt lịch đơn giản">
        Luồng thao tác được thiết kế ngắn gọn để người dùng lớn tuổi hoặc con cái đều dễ sử dụng.
      </SectionHeader>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {steps.map(([title, body], index) => (
          <div key={title} className="rounded-[26px] border border-teal-100 bg-[#f7fffe] p-6">
            <div className="mb-5 grid h-11 w-11 place-items-center rounded-2xl bg-teal-700 font-black text-white">
              {index + 1}
            </div>
            <h3 className="text-lg font-black text-[#12312f]">{title}</h3>
            <p className="mt-3 text-sm leading-6 text-slate-500">{body}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export const CompanionJoinSection = () => (
  <section id="companion-join" className="scroll-mt-24 bg-gradient-to-b from-white via-teal-50/80 to-white py-18">
    <div className="mx-auto w-[min(1180px,92%)]">
      <div className="grid overflow-hidden rounded-[38px] border border-teal-100 bg-white shadow-2xl shadow-teal-900/10 lg:grid-cols-[1.03fr_0.97fr]">
        <div className="relative p-8 lg:p-12">
          <div className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-teal-100/70 blur-3xl" />
          <span className="relative inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-black uppercase tracking-wide text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Dành cho sinh viên Y Dược, Điều dưỡng, Tâm lý
          </span>
          <h2 className="relative mt-5 max-w-2xl text-3xl font-black leading-tight text-[#12312f] sm:text-4xl lg:text-5xl">
            Trở thành người đồng hành CareGo
          </h2>
          <p className="relative mt-4 max-w-2xl text-base leading-7 text-slate-500">
            Đăng ký hồ sơ, xác thực email và chờ admin kiểm duyệt để bắt đầu nhận ca chăm sóc theo giờ.
            Mỗi ca đều có quy trình rõ ràng, GPS theo dõi và báo cáo minh bạch cho gia đình.
          </p>

          <div className="relative mt-7 grid gap-3 sm:grid-cols-3">
            {[
              ["Linh hoạt", "Chọn ca phù hợp lịch học"],
              ["Minh bạch", "Theo dõi thu nhập rõ ràng"],
              ["An toàn", "Có quy trình từng bước"],
            ].map(([title, body]) => (
              <div key={title} className="rounded-3xl border border-teal-100 bg-[#f7fffe] p-4">
                <strong className="block text-sm text-[#12312f]">{title}</strong>
                <small className="mt-1 block leading-5 text-slate-500">{body}</small>
              </div>
            ))}
          </div>

          <div className="relative mt-8 flex flex-wrap gap-3">
            <LandingButton to="/companion-register">Đăng ký người đồng hành</LandingButton>
            <LandingButton href="#safety" variant="secondary">Xem quy tắc an toàn</LandingButton>
          </div>
        </div>

        <div className="relative min-h-[420px] overflow-hidden bg-gradient-to-br from-teal-700 via-teal-600 to-cyan-500 p-8">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute -bottom-24 left-10 h-72 w-72 rounded-full bg-cyan-200/25 blur-3xl" />

          <div className="relative mx-auto flex h-full max-w-md flex-col justify-center">
            <div className="rounded-[32px] border border-white/25 bg-white/95 p-5 text-[#12312f] shadow-2xl shadow-teal-950/25">
              <div className="flex items-center gap-4">
                <div className="grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-teal-100 to-sky-100 text-2xl font-black text-teal-800">
                  CG
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-teal-700">Hồ sơ ứng tuyển</p>
                  <h3 className="mt-1 text-xl font-black">Người đồng hành mới</h3>
                  <p className="mt-1 text-sm font-semibold text-slate-500">Chờ admin kiểm duyệt</p>
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                {[
                  ["01", "Xác thực email", "Hoàn tất OTP để bảo vệ tài khoản"],
                  ["02", "Chụp CCCD và selfie", "Bổ sung giấy tờ xác minh danh tính"],
                  ["03", "Nhận ca sau duyệt", "Bắt đầu nhận lịch chăm sóc phù hợp"],
                ].map(([step, title, body]) => (
                  <div key={step} className="flex gap-3 rounded-2xl border border-teal-100 bg-teal-50/70 p-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-white text-xs font-black text-teal-700 shadow-sm">
                      {step}
                    </span>
                    <div>
                      <strong className="block text-sm">{title}</strong>
                      <small className="mt-1 block leading-5 text-slate-500">{body}</small>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-2xl bg-[#12312f] p-4 text-white">
                <p className="text-xs font-bold text-white/65">Thu nhập dự kiến</p>
                <div className="mt-1 flex items-end justify-between gap-3">
                  <strong className="text-2xl font-black">Theo ca chăm sóc</strong>
                  <span className="rounded-full bg-emerald-400/20 px-3 py-1 text-xs font-black text-emerald-100">
                    Linh hoạt
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
);

export const SafetySection = () => (
  <section id="safety" className="py-20">
    <div className="mx-auto grid w-[min(1180px,92%)] gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
      <div className="rounded-[34px] bg-teal-700 p-8 text-white shadow-2xl shadow-teal-800/20 lg:p-10">
        <h2 className="text-3xl font-black sm:text-4xl">An toàn là ưu tiên số 1</h2>
        <p className="mt-4 leading-7 text-white/85">
          Vì CareGo liên quan trực tiếp đến người cao tuổi và sức khỏe, trang giới thiệu cần nhấn mạnh sự tin cậy,
          minh bạch và kiểm soát rủi ro.
        </p>
        <LandingButton href="#contact" variant="light" className="mt-7">Xem thông tin liên hệ</LandingButton>
      </div>

      <div className="grid gap-4">
        {safetyItems.map(([title, body]) => (
          <div key={title} className="flex gap-4 rounded-3xl border border-teal-100 bg-white p-5 shadow-xl shadow-teal-900/5">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-teal-100 font-black text-teal-800">
              ✓
            </div>
            <div>
              <h3 className="font-black text-[#12312f]">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">{body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export const BlogPreviewSection = () => {
  const { data } = useAsync(() => api.get("/blogs/featured?limit=3"), []);
  const previewPosts = (data?.posts || []).slice(0, 3);

  return (
    <section id="blog" className="scroll-mt-24 border-y border-teal-100 bg-white py-20">
    <div className="mx-auto w-[min(1180px,92%)]">
      <div className="mb-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-black uppercase tracking-wide text-emerald-700">
            Góc chăm sóc CareGo
          </span>
          <h2 className="mt-4 max-w-2xl text-3xl font-black text-[#12312f] sm:text-4xl">
            Kiến thức chăm sóc giúp gia đình an tâm hơn
          </h2>
          <p className="mt-3 max-w-2xl leading-7 text-slate-500">
            Những bài viết ngắn về đi khám, chăm sóc người cao tuổi, quy tắc an toàn và vai trò của người đồng hành.
          </p>
        </div>
        <LandingButton to="/blog" variant="secondary" className="shrink-0">
          Xem tất cả bài viết
        </LandingButton>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {previewPosts.map((post) => (
          <Link
            key={post.slug}
            to={`/blog/${post.slug}`}
            className="group overflow-hidden rounded-[30px] border border-teal-100 bg-[#f7fffe] p-5 shadow-xl shadow-teal-900/5 transition hover:-translate-y-1 hover:bg-white"
          >
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-teal-100 to-sky-100 text-teal-800">
              <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" aria-hidden="true">
                <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9">
                  <path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Z" />
                  <path d="M8 8h7M8 12h8M8 16h5" />
                </g>
              </svg>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-400">
              <span className="text-teal-700">{post.category}</span>
              <span>•</span>
              <span>{post.readTime}</span>
            </div>
            <h3 className="mt-3 text-xl font-black leading-snug text-[#12312f] group-hover:text-teal-800">
              {post.title}
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-500">{post.excerpt}</p>
            <span className="mt-5 inline-flex text-sm font-black text-teal-700">Đọc thêm</span>
          </Link>
        ))}
      </div>
    </div>
    </section>
  );
};

export const CtaSection = () => (
  <section className="pb-12 pt-6">
    <div className="mx-auto w-[min(1180px,92%)]">
      <div className="flex flex-col gap-7 rounded-[38px] bg-teal-700 p-8 text-white shadow-2xl shadow-teal-800/20 lg:flex-row lg:items-center lg:justify-between lg:p-12">
        <div>
          <h2 className="text-3xl font-black sm:text-4xl">Bắt đầu chăm sóc ba mẹ dễ dàng hơn</h2>
          <p className="mt-3 max-w-2xl leading-7 text-white/85">
            Đặt lịch người đồng hành phù hợp, theo dõi quá trình hỗ trợ và nhận báo cáo sau mỗi ca làm.
          </p>
        </div>
        <LandingButton to="/register" variant="light" className="shrink-0">Đặt lịch ngay</LandingButton>
      </div>
    </div>
  </section>
);

export const LandingFooter = () => (
  <footer id="contact" className="scroll-mt-24 border-t border-teal-100 bg-white">
    <div className="mx-auto grid w-[min(1180px,92%)] gap-8 py-10 md:grid-cols-[1.2fr_0.8fr_0.8fr]">
      <div>
        <CareGoLogo />
        <p className="mt-4 max-w-md text-sm leading-6 text-slate-500">
          Nền tảng chăm sóc người cao tuổi theo giờ, giúp gia đình an tâm hơn trong giờ hành chính.
        </p>
      </div>

      <div>
        <h3 className="font-black text-slate-900">Liên hệ</h3>
        <div className="mt-4 grid gap-2 text-sm text-slate-500">
          <p>Hotline: <span className="font-bold text-slate-700">033 610 8492</span></p>
          <p>Email: <span className="font-bold text-slate-700">carego.project@gmail.com</span></p>
          <p>Thời gian: 08:00 - 20:00</p>
          <p>Khu vực thử nghiệm: đô thị lớn, chung cư, bệnh viện.</p>
        </div>
      </div>

      <div>
        <h3 className="font-black text-slate-900">Điều hướng</h3>
        <div className="mt-4 grid gap-2 text-sm font-semibold text-slate-500">
          <a href="#services" className="hover:text-teal-800">Dịch vụ</a>
          <a href="#steps" className="hover:text-teal-800">Quy trình</a>
          <a href="#companion-join" className="hover:text-teal-800">Người đồng hành</a>
          <a href="#safety" className="hover:text-teal-800">An toàn</a>
          <Link to="/blog" className="hover:text-teal-800">Blog</Link>
        </div>
      </div>
    </div>

    <div className="border-t border-teal-100 px-4 py-5 text-center text-sm text-slate-500">
      © 2026 CareGo. Cần chăm sóc là có ngay.
    </div>
  </footer>
);
