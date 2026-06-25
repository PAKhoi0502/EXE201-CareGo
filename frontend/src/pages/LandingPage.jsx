import { useEffect } from "react";
import { useLocation } from "react-router";
import HeroPhonePreview from "../components/landing/HeroPhonePreview.jsx";
import LandingButton from "../components/landing/LandingButton.jsx";
import LandingNavbar from "../components/landing/LandingNavbar.jsx";
import SupportFloatingButton from "../components/support/SupportFloatingButton.jsx";
import {
  BlogPreviewSection,
  CompanionJoinSection,
  CtaSection,
  LandingFooter,
  SafetySection,
  ServicesSection,
  StepsSection,
} from "../components/landing/LandingSections.jsx";
import { trustItems } from "../components/landing/landingData.js";
import { useAuth } from "../context/AuthContext.jsx";
import { hasCustomerAccess } from "../utils/authNavigation.js";

const LandingPage = () => {
  const location = useLocation();
  const { user } = useAuth();
  const canUseCustomerWorkspace = hasCustomerAccess(user);
  const bookingPath = canUseCustomerWorkspace ? "/customer/bookings/new" : "/register";
  const servicePath = canUseCustomerWorkspace ? "/customer/services" : null;

  useEffect(() => {
    if (!location.hash) return;

    const section = document.querySelector(location.hash);
    if (!section) return;

    window.setTimeout(() => {
      section.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }, [location.hash]);

  return (
    <div className="min-h-screen bg-[#f5fbfa] text-[#12312f]">
      <LandingNavbar />

      <main>
        <section className="bg-[linear-gradient(180deg,#f5fbfa_0%,#effdfa_100%)] py-14 lg:py-20">
          <div className="mx-auto grid w-[min(1180px,92%)] gap-12 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-extrabold text-emerald-700">
                Dịch vụ chăm sóc người cao tuổi theo giờ
              </div>
              <h1 className="max-w-3xl text-5xl font-black leading-tight text-[#12312f] sm:text-6xl lg:text-7xl">
                An tâm chăm sóc ba mẹ cùng <span className="text-teal-800">CareGo</span>
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-500">
                CareGo kết nối con cái bận rộn với người đồng hành đã được xác thực, hỗ trợ ba mẹ đi khám bệnh,
                nhắc thuốc, đi dạo, trò chuyện và cập nhật tình hình theo thời gian thực.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <LandingButton to={bookingPath}>Đặt lịch chăm sóc</LandingButton>
                {servicePath ? (
                  <LandingButton to={servicePath} variant="secondary">
                    Xem dịch vụ
                  </LandingButton>
                ) : (
                  <LandingButton href="#services" variant="secondary">
                    Xem dịch vụ
                  </LandingButton>
                )}
                {!user ? (
                  <LandingButton to="/companion-register" variant="secondary">
                    Đăng ký người đồng hành
                  </LandingButton>
                ) : null}
              </div>

              <div className="mt-9 grid gap-4 sm:grid-cols-3">
                {trustItems.map((item) => (
                  <div key={item.value} className="rounded-3xl border border-teal-100 bg-white/80 p-5 shadow-xl shadow-teal-900/5">
                    <strong className="block text-2xl font-black text-teal-800">{item.value}</strong>
                    <small className="mt-1 block leading-5 text-slate-500">{item.label}</small>
                  </div>
                ))}
              </div>
            </div>

            <HeroPhonePreview />
          </div>
        </section>

        <ServicesSection />
        <StepsSection />
        <CompanionJoinSection />
        <SafetySection />
        <BlogPreviewSection />
        <CtaSection />
      </main>

      <LandingFooter />
      <SupportFloatingButton />
    </div>
  );
};

export default LandingPage;
