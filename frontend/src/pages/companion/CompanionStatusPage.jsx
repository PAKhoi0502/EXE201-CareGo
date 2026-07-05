import { useEffect } from "react";
import { Navigate, useNavigate } from "react-router";
import CareGoLogo from "../../components/CareGoLogo.jsx";
import { Button, Card, StatusBadge } from "../../components/Ui.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { getUserHomePath, isApprovedCompanion } from "../../utils/authNavigation.js";
import { getCompanionApplicantTypeLabel } from "../../utils/companionApplication.js";

const statusCopy = {
  pending: {
    title: "Hồ sơ đang chờ duyệt",
    description: "Admin đang kiểm tra hồ sơ người đồng hành của bạn. Khi được duyệt, hệ thống sẽ gửi tài khoản companion và mật khẩu tạm thời về email cá nhân của bạn.",
  },
  approved: {
    title: "Hồ sơ đã được duyệt",
    description: "Tài khoản companion đã được cấp. Vui lòng kiểm tra email cá nhân để lấy tên đăng nhập và mật khẩu tạm thời, sau đó đổi mật khẩu ở lần đăng nhập đầu tiên.",
  },
  rejected: {
    title: "Hồ sơ chưa được duyệt",
    description: "Hồ sơ hiện chưa đạt yêu cầu duyệt. Vui lòng liên hệ CareGo để được hướng dẫn cập nhật hoặc gửi lại thông tin.",
  },
  suspended: {
    title: "Tài khoản companion đang tạm khóa",
    description: "Tài khoản companion của bạn đang bị tạm khóa nên chưa thể nhận lịch hoặc thao tác trong khu vực companion.",
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
    return <div className="p-6 text-sm text-slate-500">Đang tải...</div>;
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
          <CareGoLogo subtitle="Người đồng hành" />
          <Button type="button" variant="secondary" onClick={handleHeaderAction}>
            {user.role === "customer" ? "Về trang chủ" : "Đăng xuất"}
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
                ? `Tài khoản companion đã cấp: ${companionLoginEmail}. Mật khẩu tạm thời đã được gửi về email cá nhân ${user.email}.`
                : `Email cá nhân nhận tài khoản sau khi duyệt: ${user.email}.`}
            </div>
          ) : null}

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-black uppercase text-slate-400">Tên hồ sơ</p>
              <p className="mt-2 font-bold text-slate-900">{application?.fullName || user.name || "Chưa cập nhật"}</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-black uppercase text-slate-400">Số điện thoại</p>
              <p className="mt-2 font-bold text-slate-900">{application?.phone || user.phone || "Chưa cập nhật"}</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 sm:col-span-2">
              <p className="text-xs font-black uppercase text-slate-400">Nhóm ứng viên</p>
              <p className="mt-2 font-bold text-slate-900">{getCompanionApplicantTypeLabel(application?.applicantType)}</p>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
};

export default CompanionStatusPage;
