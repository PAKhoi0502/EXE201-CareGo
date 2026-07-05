import { useEffect, useMemo, useState } from "react";
import { api } from "../../api/client.js";
import AdminDetailModal, { DetailGrid, DetailItem, DetailTags } from "../../components/AdminDetailModal.jsx";
import ImageUpload from "../../components/ImageUpload.jsx";
import { Button, Input, Select, StatusBadge, Textarea } from "../../components/Ui.jsx";
import { useAsync } from "../../hooks/useAsync.js";
import { dateTime } from "../../utils/format.js";
import { companionApplicantTypes, getCompanionApplicantType, getCompanionApplicantTypeLabel } from "../../utils/companionApplication.js";

const emptyForm = {
  name: "",
  fullName: "",
  email: "",
  password: "",
  phone: "",
  dateOfBirth: "",
  workingShift: "full_day",
  applicantType: "student",
  university: "",
  major: "",
  graduationYear: "",
  yearsOfExperience: "",
  qualificationDescription: "",
  skillsText: "",
  serviceAreasText: "",
  citizenIdFrontUrl: "",
  citizenIdBackUrl: "",
  studentCardUrl: "",
  degreeCertificateUrl: "",
  professionalCertificateUrl: "",
  experienceProofUrl: "",
  backgroundCheckUrl: "",
};

const initials = (name = "CG") =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const getReviewerName = (companion) => {
  const reviewer = companion?.reviewedBy || {};
  return reviewer.name || reviewer.email || "-";
};

const getCompanionUserId = (companion) =>
  companion?.userId?._id || (typeof companion?.userId === "string" ? companion.userId : "");

const getCompanionAccountEmail = (companion) =>
  companion?.userId?.email || (typeof companion?.userId === "string" ? companion.userId : "");

const getApplicantEmail = (companion) => companion?.applicantCustomerId?.email || "";

const getWorkingShiftLabel = (value) => {
  if (value === "morning") return "Sáng 07:00 - 13:00";
  if (value === "afternoon") return "Chiều 13:00 - 19:00";
  return "Cả ngày 07:00 - 19:00";
};

const PhoneVerifiedBadge = ({ verified }) => (
  <span
    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
      verified ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-700 ring-amber-200"
    }`}
  >
    {verified ? "Phone đã xác minh" : "Phone chưa xác minh"}
  </span>
);

const GpsBadge = ({ status }) => (
  <span
    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${status?.isGpsOn ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-slate-100 text-slate-600 ring-slate-200"
      }`}
  >
    GPS {status?.isGpsOn ? "đang bật" : "đang tắt"}
  </span>
);

const AccountLockBadge = ({ user }) => {
  if (!user) {
    return (
      <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
        Chưa cấp tài khoản
      </span>
    );
  }

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${user.isActive ? "bg-blue-50 text-blue-700 ring-blue-200" : "bg-rose-50 text-rose-700 ring-rose-200"
        }`}
    >
      {user.isActive ? "Tài khoản mở" : "Tài khoản bị khóa"}
    </span>
  );
};

const OnlineBadge = ({ status }) => (
  <span
    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${status?.isOnline ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-slate-100 text-slate-600 ring-slate-200"
      }`}
  >
    {status?.isOnline ? "Online" : "Offline"}
  </span>
);

const RealtimeStatusCard = ({ gpsStatus, onlineStatus }) => (
  <div className="min-w-44 rounded-2xl border border-slate-100 bg-slate-50 p-3">
    <div className="flex flex-wrap gap-1.5">
      <OnlineBadge status={onlineStatus} />
      <GpsBadge status={gpsStatus} />
    </div>
    <p className="mt-2 text-[11px] font-semibold text-slate-500">
      {gpsStatus?.lastSeenAt ? `GPS cập nhật: ${dateTime(gpsStatus.lastSeenAt)}` : "Chưa có tín hiệu GPS"}
    </p>
    {gpsStatus?.isGpsOn && gpsStatus?.lat && gpsStatus?.lng ? (
      <p className="mt-1 text-[11px] text-slate-400">
        {Number(gpsStatus.lat).toFixed(5)}, {Number(gpsStatus.lng).toFixed(5)}
      </p>
    ) : null}
  </div>
);

const DocumentImage = ({ label, src }) => (
  <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
    {src ? (
      <a href={src} target="_blank" rel="noreferrer" className="mt-2 block overflow-hidden rounded-xl border border-teal-100 bg-white">
        <img src={src} alt={label} className="h-40 w-full object-cover" />
      </a>
    ) : (
      <p className="mt-2 text-sm font-semibold text-slate-500">Chưa bổ sung</p>
    )}
  </div>
);

const AdminCompanionsPage = () => {
  const { data, reload, error } = useAsync(() => api.get("/companions/admin/all"), []);
  const [form, setForm] = useState(emptyForm);
  const [submitError, setSubmitError] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [areaFilter, setAreaFilter] = useState("all");
  const [selectedCompanion, setSelectedCompanion] = useState(null);
  const [gpsStatuses, setGpsStatuses] = useState({});
  const [onlineStatuses, setOnlineStatuses] = useState({});
  const companions = useMemo(() => data?.companions || [], [data?.companions]);
  const formApplicantType = getCompanionApplicantType(form.applicantType);
  const selectedApplicantType = getCompanionApplicantType(selectedCompanion?.applicantType);
  const getGpsStatus = (companion) => gpsStatuses[getCompanionUserId(companion)] || null;
  const getOnlineStatus = (companion) => onlineStatuses[getCompanionUserId(companion)] || null;

  useEffect(() => {
    const loadRealtimeStatuses = async () => {
      try {
        const [gpsResponse, onlineResponse] = await Promise.all([
          api.get("/admin/gps-statuses"),
          api.get("/admin/online-statuses"),
        ]);
        setGpsStatuses(gpsResponse.gpsStatuses || {});
        setOnlineStatuses(onlineResponse.onlineStatuses || {});
      } catch {
        setGpsStatuses({});
        setOnlineStatuses({});
      }
    };

    loadRealtimeStatuses();
    const timer = setInterval(loadRealtimeStatuses, 10000);
    return () => clearInterval(timer);
  }, []);

  const areas = useMemo(() => {
    const values = companions.flatMap((item) => item.serviceAreas || []).filter(Boolean);
    return ["all", ...new Set(values)];
  }, [companions]);

  const filteredCompanions = companions.filter((item) => {
    const text =
      `${item.fullName} ${getCompanionAccountEmail(item)} ${getApplicantEmail(item)} ${item.phone} ${getCompanionApplicantTypeLabel(item.applicantType)} ${item.university} ${item.major} ${item.qualificationDescription} ${(item.skills || []).join(" ")}`.toLowerCase();
    const matchesQuery = text.includes(query.toLowerCase());
    const matchesStatus = statusFilter === "all" || item.vettingStatus === statusFilter;
    const matchesArea = areaFilter === "all" || item.serviceAreas?.includes(areaFilter);
    return matchesQuery && matchesStatus && matchesArea;
  });

  const pendingCount = companions.filter((item) => item.vettingStatus === "pending").length;
  const approvedCount = companions.filter((item) => item.vettingStatus === "approved").length;
  const suspendedCount = companions.filter((item) => item.vettingStatus === "suspended").length;
  const onlineCount = companions.filter((item) => getOnlineStatus(item)?.isOnline).length;
  const gpsOnCount = companions.filter((item) => getGpsStatus(item)?.isGpsOn).length;

  const closeCreateModal = () => {
    setIsCreateModalOpen(false);
    setSubmitError("");
  };

  const create = async (event) => {
    event.preventDefault();
    setSubmitError("");
    try {
      await api.post("/companions", {
        ...form,
        skills: form.skillsText.split(",").map((item) => item.trim()).filter(Boolean),
        serviceAreas: form.serviceAreasText.split(",").map((item) => item.trim()).filter(Boolean),
        documents: {
          citizenIdFrontUrl: form.citizenIdFrontUrl,
          citizenIdBackUrl: form.citizenIdBackUrl,
          [formApplicantType.documentField]: form[formApplicantType.documentField],
        },
      });
      setForm(emptyForm);
      closeCreateModal();
      reload();
    } catch (err) {
      setSubmitError(err.message);
    }
  };

  const updateStatus = async (id, vettingStatus) => {
    const payload = { vettingStatus };
    if (vettingStatus === "rejected") {
      const rejectionReason = window.prompt("Nhập lý do từ chối hồ sơ người đồng hành:");
      if (!rejectionReason?.trim()) return;
      payload.rejectionReason = rejectionReason.trim();
    }

    setSubmitError("");
    try {
      const response = await api.patch(`/companions/${id}/status`, payload);
      await reload();
      if (response?.companion) {
        setSelectedCompanion((current) =>
          current?._id === id ? { ...current, ...response.companion } : current,
        );
      }
    } catch (err) {
      setSubmitError(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Quản lý người đồng hành</h1>
          <p className="mt-1 text-sm text-slate-500">
            Tuyển dụng, xác minh giấy tờ và theo dõi năng lực của từng nhóm người đồng hành.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row xl:w-auto">
          <Button className="whitespace-nowrap" onClick={() => setIsCreateModalOpen(true)}>
            Tạo companion
          </Button>
          <div className="relative w-full xl:w-96">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm tên, email, nhóm ứng viên, kỹ năng..."
              className="min-h-11 w-full rounded-xl border border-transparent bg-slate-100 px-4 pl-10 text-sm outline-none transition focus:border-teal-300 focus:bg-white focus:ring-2 focus:ring-teal-100"
            />
            <span className="absolute left-3 top-2.5 text-slate-400">⌕</span>
          </div>
        </div>
      </div>

      {error ? <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
      {submitError ? <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{submitError}</p> : null}

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="block text-xs font-medium text-slate-400">Tổng companion</span>
          <p className="mt-2 text-2xl font-bold text-slate-900">{companions.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="block text-xs font-medium text-slate-400">Đã onboard</span>
          <p className="mt-2 text-2xl font-bold text-teal-700">{approvedCount}</p>
        </div>
        <div className="rounded-xl border-l-4 border-amber-500 bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <span className="block text-xs font-medium text-amber-600">Chờ duyệt hồ sơ</span>
          <p className="mt-2 text-2xl font-bold text-slate-900">{pendingCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="block text-xs font-medium text-slate-400">Tạm khóa</span>
          <p className="mt-2 text-2xl font-bold text-rose-600">{suspendedCount}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-white p-5 shadow-sm">
          <span className="block text-xs font-medium text-emerald-600">GPS đang bật / Online</span>
          <p className="mt-2 text-2xl font-bold text-emerald-700">{gpsOnCount} / {onlineCount}</p>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 bg-slate-50/70 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-bold text-slate-900">Danh sách người đồng hành</h2>
            <p className="mt-1 text-xs text-slate-400">
              Quản lý vetting, khu vực hoạt động, kỹ năng và trạng thái tài khoản.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select label="Khu vuc" value={areaFilter} onChange={(event) => setAreaFilter(event.target.value)} className="sm:w-44">
              {areas.map((area) => (
                <option key={area} value={area}>
                  {area === "all" ? "Tat ca khu vuc" : area}
                </option>
              ))}
            </Select>
            <Select
              label="Trang thai"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="sm:w-44"
            >
              <option value="all">Tất cả</option>
              <option value="approved">Đã duyệt</option>
              <option value="pending">Chờ duyệt</option>
              <option value="rejected">Từ chối</option>
              <option value="suspended">Tạm khóa</option>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50 text-xs font-semibold uppercase text-slate-400">
                <th className="p-4">Companion</th>
                <th className="p-4">Online / GPS</th>
                <th className="p-4">Hồ sơ năng lực</th>
                <th className="p-4">Kỹ năng / Khu vực</th>
                <th className="p-4">Hiệu suất</th>
                <th className="p-4">Trạng thái</th>
                <th className="p-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredCompanions.map((item) => (
                <tr key={item._id} className={item.vettingStatus === "pending" ? "bg-amber-50/30" : "hover:bg-slate-50/80"}>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-100 text-xs font-bold text-teal-800 ring-1 ring-teal-200">
                        {initials(item.fullName)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">{item.fullName}</p>
                        <p className="text-[11px] text-slate-400">
                          {getCompanionAccountEmail(item) || "Chưa cấp tài khoản companion"}
                        </p>
                        {getApplicantEmail(item) ? (
                          <p className="text-[11px] text-slate-400">Email cá nhân: {getApplicantEmail(item)}</p>
                        ) : null}
                        <p className="text-[11px] text-slate-400">{item.phone || "Chua co SDT"}</p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          <AccountLockBadge user={item.userId} />
                          <PhoneVerifiedBadge verified={Boolean(item.phoneVerifiedAt)} />
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <RealtimeStatusCard gpsStatus={getGpsStatus(item)} onlineStatus={getOnlineStatus(item)} />
                  </td>
                  <td className="p-4">
                    <p className="font-semibold text-slate-700">{getCompanionApplicantTypeLabel(item.applicantType)}</p>
                    <p className="mt-1 text-slate-500">{item.university || item.qualificationDescription || "Chưa cập nhật thông tin năng lực"}</p>
                    <p className="mt-1 text-slate-400">{item.major || (item.yearsOfExperience ? `${item.yearsOfExperience} năm kinh nghiệm` : "")}</p>
                    <p className="mt-1 font-semibold text-teal-700">{getWorkingShiftLabel(item.workingShift)}</p>
                    <div className="mt-2 space-y-1">
                      <p className="font-semibold text-emerald-600">L1: Danh tính và giấy tờ năng lực</p>
                      <p className={item.vettingStatus === "approved" ? "font-semibold text-emerald-600" : "font-semibold text-amber-600"}>
                        L2-L3: {item.vettingStatus === "approved" ? "Hoàn tất" : "Đang kiểm duyệt"}
                      </p>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex max-w-64 flex-wrap gap-1">
                      {(item.skills?.length ? item.skills : ["Chua co ky nang"]).slice(0, 4).map((skill) => (
                        <span key={skill} className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                          {skill}
                        </span>
                      ))}
                    </div>
                    <div className="mt-2 flex max-w-64 flex-wrap gap-1">
                      {(item.serviceAreas?.length ? item.serviceAreas : ["Chưa có khu vực"]).slice(0, 3).map((area) => (
                        <span key={area} className="rounded bg-teal-50 px-2 py-0.5 text-[10px] font-medium text-teal-700">
                          {area}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="p-4">
                    <p className="font-bold text-slate-700">{item.completedBookings || 0} ca</p>
                    <p className="mt-1 font-semibold text-amber-500">
                      Star {Number(item.ratingAverage || 0).toFixed(1)} ({item.ratingCount || 0})
                    </p>
                  </td>
                  <td className="p-4">
                    <StatusBadge status={item.vettingStatus} />
                  </td>
                  <td className="space-x-1 whitespace-nowrap p-4 text-right">
                    <Button variant="muted" className="min-h-8 px-2.5 text-xs" onClick={() => setSelectedCompanion(item)}>
                      Chi tiết
                    </Button>
                    {item.vettingStatus === "approved" || item.vettingStatus === "suspended" ? (
                      <Button
                        variant={item.vettingStatus === "suspended" ? "secondary" : "danger"}
                        className="min-h-8 px-2.5 text-xs"
                        onClick={() => updateStatus(item._id, item.vettingStatus === "suspended" ? "approved" : "suspended")}
                      >
                        {item.vettingStatus === "suspended" ? "Mở khóa" : "Tạm khóa"}
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
              {!filteredCompanions.length ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-sm text-slate-400">
                    Không tìm thấy người đồng hành phù hợp.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {isCreateModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white p-5">
              <div>
                <h2 className="font-bold text-slate-900">Tạo nhanh companion</h2>
                <p className="mt-1 text-xs text-slate-400">
                  Hồ sơ chỉ được duyệt khi có đủ CCCD và giấy tờ phù hợp với nhóm ứng viên.
                </p>
              </div>
              <button
                className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200"
                onClick={closeCreateModal}
                type="button"
              >
                Đóng
              </button>
            </div>

            <form className="grid gap-4 p-5" onSubmit={create}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Tên hiển thị" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                <Input label="Họ tên" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
              </div>
              <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Mật khẩu" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                <Input label="Số điện thoại" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <Input label="Ngày sinh" type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} />
              <Select label="Ca làm việc" value={form.workingShift} onChange={(e) => setForm({ ...form, workingShift: e.target.value })}>
                <option value="morning">Buổi sáng 07:00 - 13:00</option>
                <option value="afternoon">Buổi chiều 13:00 - 19:00</option>
                <option value="full_day">Cả ngày 07:00 - 19:00</option>
              </Select>
              <Select label="Nhóm ứng viên" value={form.applicantType} onChange={(e) => setForm({ ...form, applicantType: e.target.value })}>
                {companionApplicantTypes.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </Select>
              {formApplicantType.requiresEducation ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input label="Cơ sở đào tạo" value={form.university} onChange={(e) => setForm({ ...form, university: e.target.value })} />
                  <Input label="Ngành hoặc chuyên môn" value={form.major} onChange={(e) => setForm({ ...form, major: e.target.value })} />
                </div>
              ) : null}
              {form.applicantType === "graduate" ? (
                <Input label="Năm tốt nghiệp" type="number" min="1950" max={new Date().getFullYear()} value={form.graduationYear} onChange={(e) => setForm({ ...form, graduationYear: e.target.value })} />
              ) : null}
              {formApplicantType.requiresExperience ? (
                <Input label="Số năm kinh nghiệm" type="number" min="0" max="60" step="0.5" value={form.yearsOfExperience} onChange={(e) => setForm({ ...form, yearsOfExperience: e.target.value })} />
              ) : null}
              {formApplicantType.requiresDescription ? (
                <Textarea label="Kinh nghiệm hoặc lý do phù hợp" value={form.qualificationDescription} onChange={(e) => setForm({ ...form, qualificationDescription: e.target.value })} maxLength="1000" />
              ) : null}
              <Input label="Kỹ năng, cách nhau bằng dấu phẩy" value={form.skillsText} onChange={(e) => setForm({ ...form, skillsText: e.target.value })} />
              <Input label="Khu vực hoạt động" value={form.serviceAreasText} onChange={(e) => setForm({ ...form, serviceAreasText: e.target.value })} />
              <div className="grid gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
                <ImageUpload label="CCCD mặt trước" folder="carego/companion-documents" value={form.citizenIdFrontUrl} onUploaded={(images) => setForm((current) => ({ ...current, citizenIdFrontUrl: images.at(-1) || "" }))} compact />
                <ImageUpload label="CCCD mặt sau" folder="carego/companion-documents" value={form.citizenIdBackUrl} onUploaded={(images) => setForm((current) => ({ ...current, citizenIdBackUrl: images.at(-1) || "" }))} compact />
                <ImageUpload label={formApplicantType.documentLabel} folder="carego/companion-documents" value={form[formApplicantType.documentField]} onUploaded={(images) => setForm((current) => ({ ...current, [formApplicantType.documentField]: images.at(-1) || "" }))} compact />
              </div>
              {submitError ? <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{submitError}</p> : null}
              <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                <Button type="button" variant="secondary" onClick={closeCreateModal}>
                  Hủy
                </Button>
                <Button>Tạo companion</Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {selectedCompanion ? (
        <AdminDetailModal
          title={selectedCompanion.fullName}
          subtitle={`Companion ID: ${selectedCompanion._id}`}
          status={selectedCompanion.vettingStatus}
          onClose={() => setSelectedCompanion(null)}
        >
          <div className="space-y-5">
            <DetailGrid>
              <DetailItem label="Tai khoan companion" value={getCompanionAccountEmail(selectedCompanion) || "Chua cap tai khoan"} />
              <DetailItem label="Email ca nhan" value={getApplicantEmail(selectedCompanion) || selectedCompanion.userId?.email || "-"} />
              <DetailItem label="So dien thoai" value={selectedCompanion.phone} />
              <DetailItem label="Xac minh phone">
                <PhoneVerifiedBadge verified={Boolean(selectedCompanion.phoneVerifiedAt)} />
              </DetailItem>
              <DetailItem label="Ca lam viec" value={getWorkingShiftLabel(selectedCompanion.workingShift)} />
              <DetailItem label="Nhóm ứng viên" value={selectedApplicantType.label} />
              <DetailItem label="Ngày sinh" value={selectedCompanion.dateOfBirth ? new Date(selectedCompanion.dateOfBirth).toLocaleDateString("vi-VN") : "-"} />
              <DetailItem label="Cơ sở đào tạo" value={selectedCompanion.university || "Không áp dụng"} />
              <DetailItem label="Ngành hoặc chuyên môn" value={selectedCompanion.major || "Không áp dụng"} />
              <DetailItem label="Năm tốt nghiệp" value={selectedCompanion.graduationYear || "Không áp dụng"} />
              <DetailItem label="Kinh nghiệm" value={`${selectedCompanion.yearsOfExperience || 0} năm`} />
              <DetailItem label="Gioi tinh" value={selectedCompanion.gender} />
              <DetailItem label="Ngay tao ho so" value={dateTime(selectedCompanion.createdAt)} />
              <DetailItem label="Nguoi xu ly" value={getReviewerName(selectedCompanion)} />
              <DetailItem label="Xu ly luc" value={dateTime(selectedCompanion.reviewedAt)} />
              <DetailItem label="So ca hoan thanh" value={`${selectedCompanion.completedBookings || 0} ca`} />
              <DetailItem label="Trang thai tai khoan">
                <AccountLockBadge user={selectedCompanion.userId} />
              </DetailItem>
              <DetailItem label="Online / Offline">
                <OnlineBadge status={getOnlineStatus(selectedCompanion)} />
              </DetailItem>
              <DetailItem label="Trang thai GPS">
                <div className="space-y-2">
                  <GpsBadge status={getGpsStatus(selectedCompanion)} />
                  <p className="text-xs text-slate-500">
                    {getGpsStatus(selectedCompanion)?.lastSeenAt
                      ? `Cập nhật cuối: ${dateTime(getGpsStatus(selectedCompanion).lastSeenAt)}`
                      : "Chưa có tín hiệu GPS"}
                  </p>
                  {getGpsStatus(selectedCompanion)?.isGpsOn && getGpsStatus(selectedCompanion)?.lat ? (
                    <p className="text-xs text-slate-500">
                      Tọa độ: {Number(getGpsStatus(selectedCompanion).lat).toFixed(6)}, {Number(getGpsStatus(selectedCompanion).lng).toFixed(6)}
                    </p>
                  ) : null}
                </div>
              </DetailItem>
              <DetailItem
                label="Danh gia"
                value={`${Number(selectedCompanion.ratingAverage || 0).toFixed(1)} / 5 (${selectedCompanion.ratingCount || 0} danh gia)`}
              />
            </DetailGrid>

            {selectedCompanion.vettingStatus === "rejected" ? (
              <section className="rounded-xl border border-rose-100 bg-rose-50 p-4">
                <h3 className="font-bold text-rose-700">Ly do tu choi</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm font-semibold text-rose-700">
                  {selectedCompanion.rejectionReason || "Chua co ly do tu choi."}
                </p>
              </section>
            ) : null}

            <section className="rounded-xl border border-slate-100 p-4">
              <h3 className="font-bold text-slate-900">Ky nang va khu vuc hoat dong</h3>
              <div className="mt-3 space-y-3">
                {selectedCompanion.qualificationDescription ? (
                  <p className="rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-600">{selectedCompanion.qualificationDescription}</p>
                ) : null}
                <DetailTags items={selectedCompanion.skills || []} tone="blue" empty="Chua co ky nang" />
                <DetailTags items={selectedCompanion.serviceAreas || []} tone="teal" empty="Chua co khu vuc" />
              </div>
            </section>

            <section className="rounded-xl border border-slate-100 p-4">
              <h3 className="font-bold text-slate-900">Giấy tờ kiểm duyệt</h3>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <DetailItem
                  label="CCCD"
                  value={
                    selectedCompanion.documents?.citizenIdFrontUrl && selectedCompanion.documents?.citizenIdBackUrl
                      ? "Da chup du mat truoc / mat sau"
                      : selectedCompanion.documents?.citizenId || "Chua bo sung"
                  }
                />
                <DetailItem
                  label={selectedApplicantType.documentLabel}
                  value={selectedCompanion.documents?.[selectedApplicantType.documentField] ? "Đã có file" : "Chưa bổ sung"}
                />
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <DocumentImage label="CCCD mat truoc" src={selectedCompanion.documents?.citizenIdFrontUrl} />
                <DocumentImage label="CCCD mat sau" src={selectedCompanion.documents?.citizenIdBackUrl} />
                <DocumentImage label={selectedApplicantType.documentLabel} src={selectedCompanion.documents?.[selectedApplicantType.documentField]} />
              </div>
            </section>

            {selectedCompanion.vettingStatus === "pending" ? (
              <section className="rounded-xl border border-amber-100 bg-amber-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900">Quyết định kiểm duyệt</h3>
                    <div className="mt-2">
                      <StatusBadge status={selectedCompanion.vettingStatus} />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" className="min-h-9 px-3 text-xs" onClick={() => updateStatus(selectedCompanion._id, "approved")}>
                      Duyệt hồ sơ
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="min-h-9 px-3 text-xs"
                      onClick={() => updateStatus(selectedCompanion._id, "rejected")}
                    >
                      Từ chối
                    </Button>
                  </div>
                </div>
              </section>
            ) : null}
          </div>
        </AdminDetailModal>
      ) : null}
    </div>
  );
};

export default AdminCompanionsPage;
