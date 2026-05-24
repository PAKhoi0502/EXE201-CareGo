import { Link } from "react-router";
import { Button, Card, PageHeader, StatusBadge } from "../../components/Ui.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

const CompanionHomePage = () => {
  const { user } = useAuth();
  const profile = user?.companionProfile;

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-teal-100 bg-white/95 p-6 shadow-xl shadow-teal-900/10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-700">
              Trang người đồng hành
            </div>
            <h1 className="text-3xl font-black text-slate-950 sm:text-4xl">
              Xin chào, {profile?.fullName || user?.name}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Quản lý ca chăm sóc, cập nhật báo cáo và đồng hành cùng gia đình một cách chuyên nghiệp.
            </p>
          </div>
          <Link to="/companion/bookings">
            <Button className="min-w-40">Xem ca làm</Button>
          </Link>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Card className="border-teal-100 bg-white/95 shadow-xl shadow-teal-900/5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-bold text-slate-950">Trạng thái kiểm duyệt</h2>
              <StatusBadge status={profile?.vettingStatus || "pending"} />
            </div>
            <p className="mt-3 text-sm text-slate-600">
              Chỉ khi hồ sơ được admin duyệt, bạn mới có thể nhận và cập nhật ca làm.
            </p>
          </Card>
          <Card className="border-teal-100 bg-white/95 shadow-xl shadow-teal-900/5">
            <h2 className="font-bold text-slate-950">Hồ sơ cá nhân</h2>
            <p className="mt-2 text-sm text-slate-500">{profile?.university || "Chưa cập nhật trường"}</p>
            <p className="text-sm text-slate-500">{profile?.major || "Chưa cập nhật ngành"}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(profile?.skills?.length ? profile.skills : ["Chưa có kỹ năng"]).map((skill) => (
                <span key={skill} className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700">
                  {skill}
                </span>
              ))}
            </div>
          </Card>
          <Card className="border-teal-100 bg-white/95 shadow-xl shadow-teal-900/5">
            <h2 className="font-bold text-slate-950">Hướng dẫn nhanh</h2>
            <p className="mt-2 text-sm text-slate-600">
              Hãy kiểm tra ca mới, bật GPS khi nhận ca và cập nhật checklist đúng trình tự.
            </p>
            <div className="mt-3 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              Ưu tiên phản hồi trong 15 phút
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
};

export default CompanionHomePage;
