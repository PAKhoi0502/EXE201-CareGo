import { Link } from "react-router";
import { useAuth } from "../../context/AuthContext.jsx";
import { Button, Card, PageHeader, StatusBadge } from "../../components/Ui.jsx";
import { dateTime } from "../../utils/format.js";

const getInitials = (name = "CG") =>
    name
        .split(" ")
        .filter(Boolean)
        .slice(-2)
        .map((part) => part[0])
        .join("")
        .toUpperCase() || "CG";

const CompanionProfilePage = () => {
    const { user } = useAuth();
    const profile = user?.companionProfile;

    return (
        <div className="space-y-6">
            <PageHeader
                title="Hồ sơ người đồng hành"
                subtitle="Quản lý thông tin nghề nghiệp và theo dõi trạng thái hồ sơ của bạn."
            />

            <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
                <Card className="overflow-hidden border-emerald-100 bg-white/95 p-0 shadow-xl shadow-emerald-900/10">
                    <div className="relative overflow-hidden bg-gradient-to-br from-emerald-700 via-teal-600 to-cyan-500 p-6 text-white">
                        <div className="absolute -right-8 top-6 h-24 w-24 rounded-full bg-white/10" />
                        <div className="absolute -left-10 bottom-0 h-28 w-28 rounded-full bg-white/10" />
                        <div className="relative flex items-center gap-4">
                            <div className="grid h-20 w-20 place-items-center rounded-[26px] bg-white text-2xl font-black text-emerald-700 shadow-lg shadow-emerald-950/10">
                                {getInitials(profile?.fullName || user?.name)}
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-white/80">Người đồng hành CareGo</p>
                                <h2 className="mt-1 text-2xl font-black">{profile?.fullName || user?.name || "Người đồng hành"}</h2>
                                <p className="mt-1 text-sm text-white/75">{user?.email}</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-3 p-6 text-sm">
                        <div className="rounded-[18px] border border-emerald-100 bg-[#f8fffd] p-4">
                            <p className="text-xs font-black uppercase text-slate-400">Trạng thái hồ sơ</p>
                            <div className="mt-2">
                                <StatusBadge status={profile?.vettingStatus || "pending"} />
                            </div>
                        </div>
                        <div className="rounded-[18px] border border-emerald-100 bg-[#f8fffd] p-4">
                            <p className="text-xs font-black uppercase text-slate-400">Số điện thoại</p>
                            <p className="mt-1 font-bold text-slate-900">{profile?.phone || user?.phone || "Chưa cập nhật"}</p>
                        </div>
                        <div className="rounded-[18px] border border-emerald-100 bg-[#f8fffd] p-4">
                            <p className="text-xs font-black uppercase text-slate-400">Ngày tạo tài khoản</p>
                            <p className="mt-1 font-bold text-slate-900">
                                {user?.createdAt ? dateTime(user.createdAt) : "Đang cập nhật"}
                            </p>
                        </div>
                    </div>
                </Card>

                <Card className="border-emerald-100 bg-white/95 p-6 shadow-xl shadow-emerald-900/10">
                    <div className="mb-5 rounded-[22px] border border-emerald-100 bg-gradient-to-br from-emerald-50 to-sky-50 p-4">
                        <h2 className="text-xl font-black text-[#12312f]">Thông tin nghề nghiệp</h2>
                        <p className="mt-1 text-sm text-slate-500">Thông tin này hiển thị với khách hàng khi chọn người đồng hành.</p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="rounded-[18px] border border-slate-100 bg-slate-50 p-4">
                            <p className="text-xs font-black uppercase text-slate-400">Trường</p>
                            <p className="mt-2 font-bold text-slate-900">{profile?.university || "Chưa cập nhật"}</p>
                        </div>
                        <div className="rounded-[18px] border border-slate-100 bg-slate-50 p-4">
                            <p className="text-xs font-black uppercase text-slate-400">Chuyên ngành</p>
                            <p className="mt-2 font-bold text-slate-900">{profile?.major || "Chưa cập nhật"}</p>
                        </div>
                        <div className="rounded-[18px] border border-slate-100 bg-slate-50 p-4 sm:col-span-2">
                            <p className="text-xs font-black uppercase text-slate-400">Kỹ năng</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                                {(profile?.skills?.length ? profile.skills : ["Chưa có kỹ năng"]).map((skill) => (
                                    <span key={skill} className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">
                                        {skill}
                                    </span>
                                ))}
                            </div>
                        </div>
                        <div className="rounded-[18px] border border-slate-100 bg-slate-50 p-4 sm:col-span-2">
                            <p className="text-xs font-black uppercase text-slate-400">Khu vực hoạt động</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                                {(profile?.serviceAreas?.length ? profile.serviceAreas : ["Chưa cập nhật"]).map((area) => (
                                    <span key={area} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                                        {area}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default CompanionProfilePage;
