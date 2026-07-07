import { useEffect } from "react";
import { Navigate, useNavigate } from "react-router";
import CareGoLogo from "../../components/CareGoLogo.jsx";
import { Button, Card, StatusBadge } from "../../components/Ui.jsx";
import { useAuth } from "../../context/useAuth.js";
import { getUserHomePath, isApprovedCompanion } from "../../utils/authNavigation.js";
import { getCompanionApplicantTypeLabel } from "../../utils/companionApplication.js";

const statusCopy = {
  pending: {
    title: "Há»“ sÆ¡ Ä‘ang chá» duyá»‡t",
    description: "Admin Ä‘ang kiá»ƒm tra há»“ sÆ¡ ngÆ°á»i Ä‘á»“ng hÃ nh cá»§a báº¡n. Khi Ä‘Æ°á»£c duyá»‡t, há»‡ thá»‘ng sáº½ gá»­i tÃ i khoáº£n companion vÃ  máº­t kháº©u táº¡m thá»i vá» email cÃ¡ nhÃ¢n cá»§a báº¡n.",
  },
  approved: {
    title: "Há»“ sÆ¡ Ä‘Ã£ Ä‘Æ°á»£c duyá»‡t",
    description: "TÃ i khoáº£n companion Ä‘Ã£ Ä‘Æ°á»£c cáº¥p. Vui lÃ²ng kiá»ƒm tra email cÃ¡ nhÃ¢n Ä‘á»ƒ láº¥y tÃªn Ä‘Äƒng nháº­p vÃ  máº­t kháº©u táº¡m thá»i, sau Ä‘Ã³ Ä‘á»•i máº­t kháº©u á»Ÿ láº§n Ä‘Äƒng nháº­p Ä‘áº§u tiÃªn.",
  },
  rejected: {
    title: "Há»“ sÆ¡ chÆ°a Ä‘Æ°á»£c duyá»‡t",
    description: "Báº¡n cÃ³ thá»ƒ chá»‰nh sá»­a thÃ´ng tin vÃ  táº£i láº¡i giáº¥y tá» Ä‘á»ƒ gá»­i duyá»‡t láº¡i. Há»“ sÆ¡ khÃ´ng cÃ²n bá»‹ kẹt á»Ÿ tráº¡ng thÃ¡i tá»« chá»‘i nhÆ° trÆ°á»›c.",
  },
  suspended: {
    title: "TÃ i khoáº£n companion Ä‘ang táº¡m khÃ³a",
    description: "TÃ i khoáº£n companion cá»§a báº¡n Ä‘ang bá»‹ táº¡m khÃ³a nÃªn chÆ°a thá»ƒ nháº­n lá»‹ch hoáº·c thao tÃ¡c trong khu vá»±c companion.",
  },
};

const CompanionStatusPage = () => {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const application = user?.role === "customer" ? user?.companionApplication : user?.companionProfile;
  const vettingStatus = application?.vettingStatus || "pending";
  const copy = statusCopy[vettingStatus] || statusCopy.pending;
  const companionLoginEmail = application?.userId?.email || (user?.role === "companion" ? user?.email : "");

  useEffect(() => {
    if (!loading && isApprovedCompanion(user)) {
      navigate("/companion/bookings", { replace: true });
    }
  }, [loading, navigate, user]);

  if (loading) {
    return <div className="p-6 text-sm text-slate-500">Äang táº£i...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.mustChangePassword) {
    return <Navigate to="/initial-password" replace />;
  }

  if (user.role !== "companion" && user.role !== "customer") {
    return <Navigate to={getUserHomePath(user)} replace />;
  }

  if (!application) {
    return <Navigate to={getUserHomePath(user)} replace />;
  }

  const handleHeaderAction = async () => {
    if (user.role === "customer") {
      navigate("/", { replace: true });
      return;
    }

    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#f5fbfa] text-slate-900">
      <header className="border-b border-teal-900/10 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-20 w-[min(920px,92%)] items-center justify-between">
          <CareGoLogo subtitle="NgÆ°á»i Ä‘á»“ng hÃ nh" />
          <Button type="button" variant="secondary" onClick={handleHeaderAction}>
            {user.role === "customer" ? "Vá» trang chá»§" : "ÄÄƒng xuáº¥t"}
          </Button>
        </div>
      </header>

      <main className="mx-auto grid min-h-[calc(100vh-80px)] w-[min(920px,92%)] place-items-center py-10">
        <Card className="w-full border-amber-100 bg-white p-8 shadow-xl shadow-teal-900/10">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <StatusBadge status={vettingStatus} />
              <h1 className="mt-4 text-3xl font-black text-[#12312f]">{copy.title}</h1>
              <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-600">{copy.description}</p>
            </div>
            {companionLoginEmail ? (
              <div className="rounded-2xl border border-teal-100 bg-teal-50 px-4 py-3 text-sm font-bold text-teal-800">
                {companionLoginEmail}
              </div>
            ) : null}
          </div>

          {user.role === "customer" ? (
            <div className="mt-6 rounded-2xl border border-teal-100 bg-teal-50 p-4 text-sm font-semibold leading-6 text-teal-800">
              {companionLoginEmail
                ? `TÃ i khoáº£n companion Ä‘Ã£ cáº¥p: ${companionLoginEmail}. Máº­t kháº©u táº¡m thá»i Ä‘Ã£ Ä‘Æ°á»£c gá»­i vá» email cÃ¡ nhÃ¢n ${user.email}.`
                : `Email cÃ¡ nhÃ¢n nháº­n tÃ i khoáº£n sau khi duyá»‡t: ${user.email}.`}
            </div>
          ) : null}

          {vettingStatus === "rejected" ? (
            <div className="mt-6 rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-semibold leading-6 text-rose-700">
              <p className="font-black">LÃ½ do tá»« chá»‘i</p>
              <p className="mt-2">{application?.rejectionReason || "ChÆ°a cÃ³ lÃ½ do cá»¥ thá»ƒ."}</p>
              {user.role === "customer" ? (
                <Button type="button" className="mt-4" onClick={() => navigate("/companion-register")}>
                  Chá»‰nh sá»­a vÃ  gá»­i láº¡i há»“ sÆ¡
                </Button>
              ) : null}
            </div>
          ) : null}

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-black uppercase text-slate-400">TÃªn há»“ sÆ¡</p>
              <p className="mt-2 font-bold text-slate-900">{application?.fullName || user.name || "ChÆ°a cáº­p nháº­t"}</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-black uppercase text-slate-400">Sá»‘ Ä‘iá»‡n thoáº¡i</p>
              <p className="mt-2 font-bold text-slate-900">{application?.phone || user.phone || "ChÆ°a cáº­p nháº­t"}</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 sm:col-span-2">
              <p className="text-xs font-black uppercase text-slate-400">NhÃ³m á»©ng viÃªn</p>
              <p className="mt-2 font-bold text-slate-900">{getCompanionApplicantTypeLabel(application?.applicantType)}</p>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
};

export default CompanionStatusPage;
