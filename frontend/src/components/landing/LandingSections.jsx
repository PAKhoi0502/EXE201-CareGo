import LandingButton from "./LandingButton.jsx";
import { safetyItems, services, steps } from "./landingData.js";

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
        Trang giới thiệu nêu nhanh các dịch vụ chính để gia đình hiểu ngay CareGo hỗ trợ được gì.
      </SectionHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        {services.map((service) => (
          <article
            key={service.title}
            className="rounded-[30px] border border-teal-100 bg-white p-7 shadow-xl shadow-teal-900/5 transition hover:-translate-y-1"
          >
            <div className="mb-5 grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-teal-100 to-sky-100 text-lg font-black text-teal-800">
              {service.code}
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
        Luồng thao tác được thiết kế ngắn gọn để người lớn tuổi và con cái đều dễ sử dụng.
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

export const SafetySection = () => (
  <section id="safety" className="py-20">
    <div className="mx-auto grid w-[min(1180px,92%)] gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
      <div className="rounded-[34px] bg-teal-700 p-8 text-white shadow-2xl shadow-teal-800/20 lg:p-10">
        <h2 className="text-3xl font-black sm:text-4xl">An toàn là ưu tiên số 1</h2>
        <p className="mt-4 leading-7 text-white/85">
          Vì CareGo liên quan trực tiếp đến người cao tuổi và sức khỏe, trang giới thiệu cần nhấn mạnh sự tin cậy,
          minh bạch và kiểm soát rủi ro.
        </p>
        <LandingButton href="#contact" variant="light" className="mt-7">
          Xem thông tin liên hệ
        </LandingButton>
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

export const CompanionJoinSection = () => (
  <section id="companion-join" className="scroll-mt-24 py-10">
    <div className="mx-auto w-[min(1180px,92%)]">
      <div className="grid gap-6 rounded-[34px] border border-teal-100 bg-white p-7 shadow-xl shadow-teal-900/5 lg:grid-cols-[1fr_auto] lg:items-center lg:p-9">
        <div>
          <span className="inline-flex rounded-full bg-teal-50 px-3 py-1 text-xs font-black text-teal-800">
            Dành cho sinh viên Y Dược, Điều dưỡng, Tâm lý
          </span>
          <h2 className="mt-4 text-2xl font-black text-[#12312f] sm:text-3xl">
            Trở thành người đồng hành CareGo
          </h2>
          <p className="mt-3 max-w-3xl leading-7 text-slate-500">
            Đăng ký hồ sơ, xác thực email và chờ admin kiểm duyệt để bắt đầu nhận ca chăm sóc theo giờ.
          </p>
        </div>
        <LandingButton to="/companion-register" className="w-full lg:w-auto">
          Đăng ký người đồng hành
        </LandingButton>
      </div>
    </div>
  </section>
);

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
        <LandingButton to="/register" variant="light" className="shrink-0">
          Đặt lịch ngay
        </LandingButton>
      </div>
    </div>
  </section>
);

export const LandingFooter = () => (
  <footer id="contact" className="scroll-mt-24 border-t border-teal-100 bg-white">
    <div className="mx-auto grid w-[min(1180px,92%)] gap-8 py-10 md:grid-cols-[1.2fr_0.8fr_0.8fr]">
      <div>
        <div className="flex items-center gap-3 text-2xl font-black text-teal-800">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-teal-700 text-xl text-white">+</span>
          CareGo
        </div>
        <p className="mt-4 max-w-md text-sm leading-6 text-slate-500">
          Nền tảng chăm sóc người cao tuổi theo giờ, giúp gia đình an tâm hơn trong giờ hành chính.
        </p>
      </div>

      <div>
        <h3 className="font-black text-slate-900">Liên hệ</h3>
        <div className="mt-4 grid gap-2 text-sm text-slate-500">
          <p>
            Hotline: <span className="font-bold text-slate-700">1900 6868</span>
          </p>
          <p>
            Email: <span className="font-bold text-slate-700">support@carego.vn</span>
          </p>
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
        </div>
      </div>
    </div>

    <div className="border-t border-teal-100 px-4 py-5 text-center text-sm text-slate-500">
      © 2026 CareGo. Cần chăm sóc là có ngay.
    </div>
  </footer>
);
