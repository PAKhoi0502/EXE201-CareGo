import { useCallback, useEffect, useRef, useState } from "react";
import { api, uploadImage } from "../../api/client.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { Button, Card, Input, PageHeader, Select, StatusBadge, Textarea } from "../../components/Ui.jsx";
import { dateTime } from "../../utils/format.js";
import { getCompanionApplicantType } from "../../utils/companionApplication.js";

const workingShiftOptions = [
  { value: "morning", label: "Buổi sáng 07:00 - 13:00" },
  { value: "afternoon", label: "Buổi chiều 13:00 - 19:00" },
  { value: "full_day", label: "Cả ngày 07:00 - 19:00" },
];

const getWorkingShiftLabel = (value) =>
  workingShiftOptions.find((item) => item.value === value)?.label || workingShiftOptions[2].label;

const getInitials = (name = "CG") =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "CG";

const splitTextList = (value) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const toForm = (user, profile) => ({
  fullName: profile?.fullName || user?.name || "",
  phone: profile?.phone || user?.phone || "",
  workingShift: profile?.workingShift || "full_day",
  university: profile?.university || "",
  major: profile?.major || "",
  graduationYear: profile?.graduationYear || "",
  yearsOfExperience: profile?.yearsOfExperience || "",
  qualificationDescription: profile?.qualificationDescription || "",
  skillsText: profile?.skills?.join(", ") || "",
  serviceAreasText: profile?.serviceAreas?.join(", ") || "",
});

const InfoBlock = ({ label, value, className = "" }) => (
  <div className={`rounded-[18px] border border-slate-100 bg-slate-50 p-4 ${className}`}>
    <p className="text-xs font-black uppercase text-slate-400">{label}</p>
    <p className="mt-2 font-bold text-slate-900">{value || "Chưa cập nhật"}</p>
  </div>
);

const TagList = ({ label, items = [], emptyText }) => (
  <div className="rounded-[18px] border border-slate-100 bg-slate-50 p-4 sm:col-span-2">
    <p className="text-xs font-black uppercase text-slate-400">{label}</p>
    <div className="mt-2 flex flex-wrap gap-2">
      {(items.length ? items : [emptyText]).map((item) => (
        <span key={item} className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">
          {item}
        </span>
      ))}
    </div>
  </div>
);

const CompanionProfilePage = () => {
  const {
    user,
    updateCompanionProfile,
    updateProfile,
    requestCompanionPhoneOtp,
    verifyCompanionPhoneOtp,
  } = useAuth();
  const profile = user?.companionProfile;
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(() => toForm(user, profile));
  const [submitError, setSubmitError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const [phoneOtp, setPhoneOtp] = useState("");
  const [phoneOtpMock, setPhoneOtpMock] = useState("");
  const [phoneOtpError, setPhoneOtpError] = useState("");
  const [phoneOtpLoading, setPhoneOtpLoading] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [reviewSummary, setReviewSummary] = useState({ ratingAverage: 0, ratingCount: 0 });
  const [reviewPagination, setReviewPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState("");
  const avatarInputRef = useRef(null);

  const displayName = profile?.fullName || user?.name || "Người đồng hành";
  const phone = profile?.phone || user?.phone || "";
  const phoneVerified = Boolean(profile?.phoneVerifiedAt);
  const applicantType = getCompanionApplicantType(profile?.applicantType);

  const loadReviewPage = useCallback(async (page = 1, append = false) => {
    setReviewsLoading(true);
    setReviewsError("");
    try {
      const data = await api.get(`/companions/me/reviews?page=${page}&limit=10`);
      setReviews((current) => append ? [...current, ...(data.reviews || [])] : data.reviews || []);
      setReviewSummary(data.summary || { ratingAverage: 0, ratingCount: 0 });
      setReviewPagination(data.pagination || { page: 1, totalPages: 1, total: 0 });
    } catch (error) {
      setReviewsError(error.message);
    } finally {
      setReviewsLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => loadReviewPage());
  }, [loadReviewPage]);

  const startEdit = () => {
    setForm(toForm(user, profile));
    setSubmitError("");
    setSuccessMessage("");
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setSubmitError("");
  };

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    setSubmitError("");
    setSuccessMessage("");

    if (!form.fullName.trim()) {
      setSubmitError("Vui lòng nhập họ tên đầy đủ.");
      return;
    }

    setSaving(true);
    try {
      await updateCompanionProfile({
        fullName: form.fullName,
        phone: form.phone,
        workingShift: form.workingShift,
        university: form.university,
        major: form.major,
        graduationYear: form.graduationYear,
        yearsOfExperience: form.yearsOfExperience,
        qualificationDescription: form.qualificationDescription,
        skills: splitTextList(form.skillsText),
        serviceAreas: splitTextList(form.serviceAreasText),
      });
      setEditing(false);
      setSuccessMessage("Đã cập nhật hồ sơ người đồng hành.");
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const updateAvatar = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setAvatarUploading(true);
    setAvatarError("");
    setSuccessMessage("");

    try {
      const data = await uploadImage({ file, folder: "carego/avatars" });
      await updateProfile({ avatarUrl: data.url });
      setSuccessMessage("Đã cập nhật ảnh đại diện.");
    } catch (err) {
      setAvatarError(err.message);
    } finally {
      setAvatarUploading(false);
      event.target.value = "";
    }
  };

  const requestPhoneOtp = async () => {
    const nextPhone = (editing ? form.phone : phone).trim();
    setPhoneOtpError("");
    setSuccessMessage("");
    setPhoneOtpMock("");

    if (!nextPhone) {
      setPhoneOtpError("Vui lòng nhập số điện thoại trước khi xác minh.");
      return;
    }

    setPhoneOtpLoading(true);
    try {
      const data = await requestCompanionPhoneOtp(nextPhone);
      setPhoneOtpMock(data.mockOtp || "");
      setSuccessMessage("Đã tạo OTP mock để xác minh số điện thoại.");
    } catch (err) {
      setPhoneOtpError(err.message);
    } finally {
      setPhoneOtpLoading(false);
    }
  };

  const verifyPhoneOtp = async () => {
    setPhoneOtpError("");
    setSuccessMessage("");

    if (!phoneOtp.trim()) {
      setPhoneOtpError("Vui lòng nhập mã OTP.");
      return;
    }

    setPhoneOtpLoading(true);
    try {
      await verifyCompanionPhoneOtp(phoneOtp.trim());
      setPhoneOtp("");
      setPhoneOtpMock("");
      setSuccessMessage("Đã xác minh số điện thoại.");
    } catch (err) {
      setPhoneOtpError(err.message);
    } finally {
      setPhoneOtpLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hồ sơ người đồng hành"
        subtitle="Quản lý thông tin nghề nghiệp và theo dõi trạng thái hồ sơ của bạn."
        action={
          editing ? (
            <Button variant="secondary" type="button" onClick={cancelEdit} disabled={saving}>
              Hủy chỉnh sửa
            </Button>
          ) : (
            <Button type="button" onClick={startEdit}>
              Chỉnh sửa hồ sơ
            </Button>
          )
        }
      />

      {successMessage ? (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <Card className="overflow-hidden border-emerald-100 bg-white/95 p-0 shadow-xl shadow-emerald-900/10">
          <div className="relative overflow-hidden bg-gradient-to-br from-emerald-700 via-teal-600 to-cyan-500 p-6 text-white">
            <div className="absolute -right-8 top-6 h-24 w-24 rounded-full bg-white/10" />
            <div className="absolute -left-10 bottom-0 h-28 w-28 rounded-full bg-white/10" />
            <div className="relative flex items-center gap-4">
              <button
                type="button"
                className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-[26px] bg-white text-2xl font-black text-emerald-700 shadow-lg shadow-emerald-950/10 ring-4 ring-white/80 transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-75"
                onClick={() => avatarInputRef.current?.click()}
                disabled={avatarUploading}
                title="Đổi ảnh đại diện"
              >
                {user?.avatar?.url ? (
                  <img
                    src={user.avatar.url}
                    alt={user.avatar.alt || displayName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="grid h-full w-full place-items-center">{getInitials(displayName)}</span>
                )}
                <span className="absolute inset-x-0 bottom-0 bg-slate-950/60 px-1 py-1 text-center text-[10px] font-bold text-white opacity-0 transition group-hover:opacity-100">
                  {avatarUploading ? "Đang tải..." : "Đổi ảnh"}
                </span>
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={updateAvatar}
              />
              <div>
                <p className="text-sm font-semibold text-white/80">Người đồng hành CareGo</p>
                <h2 className="mt-1 text-2xl font-black">{displayName}</h2>
                <p className="mt-1 text-sm text-white/75">{user?.email}</p>
              </div>
            </div>
          </div>

          {avatarError ? (
            <div className="mx-6 mt-4 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">
              {avatarError}
            </div>
          ) : null}

          <div className="grid gap-3 p-6 text-sm">
            <div className="rounded-[18px] border border-emerald-100 bg-[#f8fffd] p-4">
              <p className="text-xs font-black uppercase text-slate-400">Trạng thái hồ sơ</p>
              <div className="mt-2">
                <StatusBadge status={profile?.vettingStatus || "pending"} />
              </div>
            </div>
            <div className="rounded-[18px] border border-emerald-100 bg-[#f8fffd] p-4">
              <p className="text-xs font-black uppercase text-slate-400">Số điện thoại</p>
              <p className="mt-1 font-bold text-slate-900">{phone || "Chưa cập nhật"}</p>
            </div>
            <div className="rounded-[18px] border border-emerald-100 bg-[#f8fffd] p-4">
              <p className="text-xs font-black uppercase text-slate-400">Ngày tạo tài khoản</p>
              <p className="mt-1 font-bold text-slate-900">
                {user?.createdAt ? dateTime(user.createdAt) : "Đang cập nhật"}
              </p>
            </div>
          </div>
        </Card>

        {!phoneVerified ? (
          <Card className="border-emerald-100 bg-white/95 p-6 shadow-xl shadow-emerald-900/10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-[#12312f]">Xác minh số điện thoại</h2>
                <p className="mt-1 text-sm text-slate-500">Companion cần xác minh số điện thoại trước khi nhận booking mới.</p>
              </div>
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">
                Chưa xác minh
              </span>
            </div>
            <div className="mt-4 grid gap-3">
              <Button type="button" variant="secondary" className="min-h-10 px-4 text-sm" onClick={requestPhoneOtp} disabled={phoneOtpLoading}>
                {phoneOtpLoading ? "Đang xử lý..." : "Gửi OTP mock"}
              </Button>
              {phoneOtpMock ? (
                <p className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-700">
                  OTP mock: {phoneOtpMock}
                </p>
              ) : null}
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <Input
                  label="Mã OTP"
                  value={phoneOtp}
                  onChange={(event) => setPhoneOtp(event.target.value)}
                  placeholder="Nhập OTP"
                  className="min-h-10 rounded-xl"
                />
                <Button type="button" className="min-h-10 px-4 text-sm" onClick={verifyPhoneOtp} disabled={phoneOtpLoading}>
                  Xác minh
                </Button>
              </div>
              {phoneOtpError ? <p className="text-sm font-semibold text-rose-600">{phoneOtpError}</p> : null}
            </div>
          </Card>
        ) : null}

        <Card className="border-emerald-100 bg-white/95 p-6 shadow-xl shadow-emerald-900/10">
          <div className="mb-5 rounded-[22px] border border-emerald-100 bg-gradient-to-br from-emerald-50 to-sky-50 p-4">
            <h2 className="text-xl font-black text-[#12312f]">Thông tin nghề nghiệp</h2>
            <p className="mt-1 text-sm text-slate-500">Thông tin này hiển thị với khách hàng khi chọn người đồng hành.</p>
          </div>

          {editing ? (
            <form className="grid gap-4" onSubmit={saveProfile}>
              <div className="grid gap-4 sm:grid-cols-2">
                <InfoBlock label="Nhóm ứng viên" value={applicantType.label} className="sm:col-span-2" />
                <Input
                  label="Họ tên đầy đủ"
                  value={form.fullName}
                  onChange={(event) => updateField("fullName", event.target.value)}
                  required
                />
                <Input
                  label="Số điện thoại"
                  value={form.phone}
                  onChange={(event) => updateField("phone", event.target.value)}
                />
                <div>
                  <Select
                    label="Ca làm việc"
                    value={form.workingShift}
                    onChange={(event) => updateField("workingShift", event.target.value)}
                  >
                    {workingShiftOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                  <p className="mt-2 text-xs font-semibold text-slate-500">
                    Không thể đổi sang ca mới nếu còn booking đã nhận hoặc đang thực hiện nằm ngoài ca đó.
                  </p>
                </div>
                {applicantType.requiresEducation ? (
                  <>
                    <Input
                      label="Cơ sở đào tạo"
                      value={form.university}
                      onChange={(event) => updateField("university", event.target.value)}
                    />
                    <Input
                      label="Ngành hoặc chuyên môn"
                      value={form.major}
                      onChange={(event) => updateField("major", event.target.value)}
                    />
                  </>
                ) : null}
                {applicantType.value === "graduate" ? (
                  <Input
                    label="Năm tốt nghiệp"
                    type="number"
                    min="1950"
                    max={new Date().getFullYear()}
                    value={form.graduationYear}
                    onChange={(event) => updateField("graduationYear", event.target.value)}
                  />
                ) : null}
                {applicantType.requiresExperience ? (
                  <Input
                    label="Số năm kinh nghiệm"
                    type="number"
                    min="0"
                    max="60"
                    step="0.5"
                    value={form.yearsOfExperience}
                    onChange={(event) => updateField("yearsOfExperience", event.target.value)}
                  />
                ) : null}
                {applicantType.requiresDescription ? (
                  <div className="sm:col-span-2">
                    <Textarea
                      label="Kinh nghiệm hoặc lý do phù hợp"
                      value={form.qualificationDescription}
                      onChange={(event) => updateField("qualificationDescription", event.target.value)}
                      maxLength="1000"
                    />
                  </div>
                ) : null}
                <div className="sm:col-span-2">
                  <Textarea
                    label="Kỹ năng, cách nhau bằng dấu phẩy"
                    value={form.skillsText}
                    onChange={(event) => updateField("skillsText", event.target.value)}
                    placeholder="Ví dụ: sơ cứu, đo huyết áp, đi khám"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Textarea
                    label="Khu vực hoạt động, cách nhau bằng dấu phẩy"
                    value={form.serviceAreasText}
                    onChange={(event) => updateField("serviceAreasText", event.target.value)}
                    placeholder="Ví dụ: Quận 1, Quận 7, Thủ Đức"
                  />
                </div>
              </div>

              {submitError ? <p className="text-sm font-semibold text-rose-600">{submitError}</p> : null}

              <div className="flex flex-wrap gap-3">
                <Button type="submit" disabled={saving}>
                  {saving ? "Đang lưu..." : "Lưu thay đổi"}
                </Button>
                <Button type="button" variant="secondary" onClick={cancelEdit} disabled={saving}>
                  Hủy
                </Button>
              </div>
            </form>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <InfoBlock label="Họ tên đầy đủ" value={displayName} />
              <InfoBlock label="Số điện thoại" value={phone} />
              <InfoBlock label="Xác minh điện thoại" value={phoneVerified ? "Đã xác minh" : "Chưa xác minh"} />
              <InfoBlock label="Ca làm việc" value={getWorkingShiftLabel(profile?.workingShift)} />
              <InfoBlock label="Nhóm ứng viên" value={applicantType.label} />
              {applicantType.requiresEducation ? (
                <>
                  <InfoBlock label="Cơ sở đào tạo" value={profile?.university} />
                  <InfoBlock label="Ngành hoặc chuyên môn" value={profile?.major} />
                </>
              ) : null}
              {applicantType.value === "graduate" ? <InfoBlock label="Năm tốt nghiệp" value={profile?.graduationYear} /> : null}
              {applicantType.requiresExperience ? <InfoBlock label="Kinh nghiệm" value={`${profile?.yearsOfExperience || 0} năm`} /> : null}
              {applicantType.requiresDescription ? <InfoBlock label="Kinh nghiệm hoặc lý do phù hợp" value={profile?.qualificationDescription} className="sm:col-span-2" /> : null}
              <TagList label="Kỹ năng" items={profile?.skills || []} emptyText="Chưa có kỹ năng" />
              <TagList label="Khu vực hoạt động" items={profile?.serviceAreas || []} emptyText="Chưa cập nhật" />
            </div>
          )}
        </Card>
      </div>

      <Card className="border-amber-100 bg-white/95 p-6 shadow-xl shadow-amber-900/10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-amber-600">Phản hồi sau dịch vụ</p>
            <h2 className="mt-1 text-2xl font-black text-[#12312f]">Đánh giá từ khách hàng</h2>
            <p className="mt-2 text-sm text-slate-500">Theo dõi nhận xét khách hàng đã gửi sau những booking được thanh toán.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:min-w-72">
            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-center">
              <p className="text-2xl font-black text-amber-700">{Number(reviewSummary.ratingAverage || 0).toFixed(1)} / 5</p>
              <p className="mt-1 text-xs font-bold text-amber-700/70">Điểm trung bình</p>
            </div>
            <div className="rounded-2xl border border-teal-100 bg-teal-50 p-4 text-center">
              <p className="text-2xl font-black text-teal-700">{reviewSummary.ratingCount || 0}</p>
              <p className="mt-1 text-xs font-bold text-teal-700/70">Lượt đánh giá</p>
            </div>
          </div>
        </div>

        {reviewsError ? (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-semibold text-rose-600">
            <span>{reviewsError}</span>
            <Button type="button" variant="secondary" onClick={() => loadReviewPage()} disabled={reviewsLoading}>
              Thử lại
            </Button>
          </div>
        ) : null}

        {!reviewsError && reviewsLoading && reviews.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-amber-200 p-6 text-center text-sm font-bold text-slate-400">
            Đang tải đánh giá...
          </div>
        ) : null}

        {!reviewsError && !reviewsLoading && reviews.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
            <p className="font-black text-slate-700">Chưa có đánh giá</p>
            <p className="mt-1 text-sm text-slate-500">Đánh giá sẽ xuất hiện sau khi khách hàng thanh toán và gửi phản hồi.</p>
          </div>
        ) : null}

        {reviews.length > 0 ? (
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {reviews.map((review) => (
              <article key={review._id} className="rounded-[22px] border border-slate-100 bg-[#fbfffe] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-teal-100 to-sky-100 text-sm font-black text-teal-700">
                      {getInitials(review.customerId?.name || "Khách hàng")}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-black text-slate-900">{review.customerId?.name || "Khách hàng"}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-400">
                        {review.createdAt ? dateTime(review.createdAt) : "Chưa có thời gian"}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-700">
                    {review.rating} / 5
                  </span>
                </div>

                {review.bookingId?.serviceId?.name ? (
                  <p className="mt-4 text-xs font-black uppercase tracking-wide text-teal-700">
                    {review.bookingId.serviceId.name}
                  </p>
                ) : null}

                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {review.comment || "Khách hàng không để lại nhận xét."}
                </p>

                {review.tags?.length ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {review.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600 ring-1 ring-slate-100">
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : null}

        {reviewPagination.page < reviewPagination.totalPages ? (
          <div className="mt-5 flex justify-center">
            <Button
              type="button"
              variant="secondary"
              onClick={() => loadReviewPage(reviewPagination.page + 1, true)}
              disabled={reviewsLoading}
            >
              {reviewsLoading ? "Đang tải..." : `Xem thêm (${reviews.length}/${reviewPagination.total})`}
            </Button>
          </div>
        ) : null}
      </Card>
    </div>
  );
};

export default CompanionProfilePage;
