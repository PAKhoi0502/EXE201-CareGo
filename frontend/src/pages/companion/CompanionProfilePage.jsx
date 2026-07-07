import { useCallback, useEffect, useRef, useState } from "react";
import { api, uploadImage } from "../../api/client.js";
import { useAuth } from "../../context/useAuth.js";
import { Button, Card, Input, PageHeader, Select, StatusBadge, Textarea } from "../../components/Ui.jsx";
import { dateTime } from "../../utils/format.js";
import { getCompanionApplicantType } from "../../utils/companionApplication.js";

const workingShiftOptions = [
  { value: "morning", label: "Buá»•i sÃ¡ng 07:00 - 13:00" },
  { value: "afternoon", label: "Buá»•i chiá»u 13:00 - 19:00" },
  { value: "full_day", label: "Cáº£ ngÃ y 07:00 - 19:00" },
];

const weekdayOptions = [
  { value: 1, label: "Thá»© 2" },
  { value: 2, label: "Thá»© 3" },
  { value: 3, label: "Thá»© 4" },
  { value: 4, label: "Thá»© 5" },
  { value: 5, label: "Thá»© 6" },
  { value: 6, label: "Thá»© 7" },
  { value: 0, label: "Chá»§ nháº­t" },
];

const getWorkingShiftLabel = (value) =>
  workingShiftOptions.find((item) => item.value === value)?.label || workingShiftOptions[2].label;

const getWorkingDaysLabel = (values = []) => {
  const labels = weekdayOptions.filter((item) => values.includes(item.value)).map((item) => item.label);
  return labels.length ? labels.join(", ") : "ChÆ°a cáº­p nháº­t";
};

const getInitials = (name = "CG") =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "CG";

const splitTextList = (value) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const normalizeWorkingDays = (values = []) =>
  weekdayOptions.map((item) => item.value).filter((value) => values.includes(value));

const toForm = (user, profile) => ({
  fullName: profile?.fullName || user?.name || "",
  phone: profile?.phone || user?.phone || "",
  workingShift: profile?.workingShift || "full_day",
  workingDays: normalizeWorkingDays(profile?.workingDays || [0, 1, 2, 3, 4, 5, 6]),
  unavailableDates: profile?.unavailableDates || [],
  newUnavailableDate: "",
  acceptingBookings: profile?.acceptingBookings !== false,
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
    <p className="mt-2 font-bold text-slate-900">{value || "ChÆ°a cáº­p nháº­t"}</p>
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
  const applicantType = getCompanionApplicantType(profile?.applicantType);
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

  useEffect(() => {
    const nextForm = toForm(user, profile);
    const timer = window.setTimeout(() => {
      setForm(nextForm);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [user, profile]);

  const displayName = profile?.fullName || user?.name || "NgÆ°á»i Ä‘á»“ng hÃ nh";
  const phone = profile?.phone || user?.phone || "";
  const phoneVerified = Boolean(profile?.phoneVerifiedAt);

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

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const toggleWorkingDay = (value) => {
    setForm((current) => {
      const workingDays = current.workingDays.includes(value)
        ? current.workingDays.filter((item) => item !== value)
        : [...current.workingDays, value];
      return { ...current, workingDays: normalizeWorkingDays(workingDays) };
    });
  };

  const addUnavailableDate = () => {
    const nextDate = String(form.newUnavailableDate || "").trim();
    if (!nextDate) return;
    setForm((current) => ({
      ...current,
      unavailableDates: Array.from(new Set([...current.unavailableDates, nextDate])).sort(),
      newUnavailableDate: "",
    }));
  };

  const removeUnavailableDate = (date) => {
    setForm((current) => ({
      ...current,
      unavailableDates: current.unavailableDates.filter((item) => item !== date),
    }));
  };

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

  const saveProfile = async (event) => {
    event.preventDefault();
    setSubmitError("");
    setSuccessMessage("");

    if (!form.fullName.trim()) {
      setSubmitError("Vui lÃ²ng nháº­p há» tÃªn Ä‘áº§y Ä‘á»§.");
      return;
    }

    if (!form.workingDays.length) {
      setSubmitError("Vui lÃ²ng chá»n Ã­t nháº¥t má»™t ngÃ y lÃ m viá»‡c.");
      return;
    }

    setSaving(true);
    try {
      await updateCompanionProfile({
        fullName: form.fullName,
        phone: form.phone,
        workingShift: form.workingShift,
        workingDays: form.workingDays,
        unavailableDates: form.unavailableDates,
        acceptingBookings: form.acceptingBookings,
        university: form.university,
        major: form.major,
        graduationYear: form.graduationYear,
        yearsOfExperience: form.yearsOfExperience,
        qualificationDescription: form.qualificationDescription,
        skills: splitTextList(form.skillsText),
        serviceAreas: splitTextList(form.serviceAreasText),
      });
      setEditing(false);
      setSuccessMessage("ÄÃ£ cáº­p nháº­t há»“ sÆ¡ ngÆ°á»i Ä‘á»“ng hÃ nh.");
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
      setSuccessMessage("ÄÃ£ cáº­p nháº­t áº£nh Ä‘áº¡i diá»‡n.");
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
      setPhoneOtpError("Vui lÃ²ng nháº­p sá»‘ Ä‘iá»‡n thoáº¡i trÆ°á»›c khi xÃ¡c minh.");
      return;
    }

    setPhoneOtpLoading(true);
    try {
      const data = await requestCompanionPhoneOtp(nextPhone);
      setPhoneOtpMock(data.mockOtp || "");
      setSuccessMessage("ÄÃ£ táº¡o OTP mock Ä‘á»ƒ xÃ¡c minh sá»‘ Ä‘iá»‡n thoáº¡i.");
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
      setPhoneOtpError("Vui lÃ²ng nháº­p mÃ£ OTP.");
      return;
    }

    setPhoneOtpLoading(true);
    try {
      await verifyCompanionPhoneOtp(phoneOtp.trim());
      setPhoneOtp("");
      setPhoneOtpMock("");
      setSuccessMessage("ÄÃ£ xÃ¡c minh sá»‘ Ä‘iá»‡n thoáº¡i.");
    } catch (err) {
      setPhoneOtpError(err.message);
    } finally {
      setPhoneOtpLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Há»“ sÆ¡ ngÆ°á»i Ä‘á»“ng hÃ nh"
        subtitle="Quáº£n lÃ½ thÃ´ng tin nghá» nghiá»‡p, lá»‹ch kháº£ dá»¥ng vÃ  tráº¡ng thÃ¡i há»“ sÆ¡ cá»§a báº¡n."
        action={editing ? (
          <Button variant="secondary" type="button" onClick={cancelEdit} disabled={saving}>Há»§y chá»‰nh sá»­a</Button>
        ) : (
          <Button type="button" onClick={startEdit}>Chá»‰nh sá»­a há»“ sÆ¡</Button>
        )}
      />

      {successMessage ? <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{successMessage}</div> : null}

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <Card className="overflow-hidden border-emerald-100 bg-white/95 p-0 shadow-xl shadow-emerald-900/10">
          <div className="relative overflow-hidden bg-gradient-to-br from-emerald-700 via-teal-600 to-cyan-500 p-6 text-white">
            <div className="relative flex items-center gap-4">
              <button type="button" className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-[26px] bg-white text-2xl font-black text-emerald-700 shadow-lg shadow-emerald-950/10 ring-4 ring-white/80 transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-75" onClick={() => avatarInputRef.current?.click()} disabled={avatarUploading}>
                {user?.avatar?.url ? (
                  <img src={user.avatar.url} alt={user.avatar.alt || displayName} className="h-full w-full object-cover" />
                ) : (
                  <span className="grid h-full w-full place-items-center">{getInitials(displayName)}</span>
                )}
              </button>
              <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={updateAvatar} />
              <div>
                <p className="text-sm font-semibold text-white/80">NgÆ°á»i Ä‘á»“ng hÃ nh CareGo</p>
                <h2 className="mt-1 text-2xl font-black">{displayName}</h2>
                <p className="mt-1 text-sm text-white/75">{user?.email}</p>
              </div>
            </div>
          </div>

          {avatarError ? <div className="mx-6 mt-4 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">{avatarError}</div> : null}

          <div className="grid gap-3 p-6 text-sm">
            <div className="rounded-[18px] border border-emerald-100 bg-[#f8fffd] p-4">
              <p className="text-xs font-black uppercase text-slate-400">Tráº¡ng thÃ¡i há»“ sÆ¡</p>
              <div className="mt-2"><StatusBadge status={profile?.vettingStatus || "pending"} /></div>
            </div>
            <div className="rounded-[18px] border border-emerald-100 bg-[#f8fffd] p-4">
              <p className="text-xs font-black uppercase text-slate-400">Sá»‘ Ä‘iá»‡n thoáº¡i</p>
              <p className="mt-1 font-bold text-slate-900">{phone || "ChÆ°a cáº­p nháº­t"}</p>
            </div>
            <div className="rounded-[18px] border border-emerald-100 bg-[#f8fffd] p-4">
              <p className="text-xs font-black uppercase text-slate-400">NgÃ y táº¡o tÃ i khoáº£n</p>
              <p className="mt-1 font-bold text-slate-900">{user?.createdAt ? dateTime(user.createdAt) : "Äang cáº­p nháº­t"}</p>
            </div>
          </div>
        </Card>

        {!phoneVerified ? (
          <Card className="border-emerald-100 bg-white/95 p-6 shadow-xl shadow-emerald-900/10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-[#12312f]">XÃ¡c minh sá»‘ Ä‘iá»‡n thoáº¡i</h2>
                <p className="mt-1 text-sm text-slate-500">Companion cáº§n xÃ¡c minh sá»‘ Ä‘iá»‡n thoáº¡i trÆ°á»›c khi nháº­n booking má»›i.</p>
              </div>
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">ChÆ°a xÃ¡c minh</span>
            </div>
            <div className="mt-4 grid gap-3">
              <Button type="button" variant="secondary" className="min-h-10 px-4 text-sm" onClick={requestPhoneOtp} disabled={phoneOtpLoading}>
                {phoneOtpLoading ? "Äang xá»­ lÃ½..." : "Gá»­i OTP mock"}
              </Button>
              {phoneOtpMock ? <p className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-700">OTP mock: {phoneOtpMock}</p> : null}
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <Input label="MÃ£ OTP" value={phoneOtp} onChange={(event) => setPhoneOtp(event.target.value)} placeholder="Nháº­p OTP" className="min-h-10 rounded-xl" />
                <Button type="button" className="min-h-10 px-4 text-sm" onClick={verifyPhoneOtp} disabled={phoneOtpLoading}>XÃ¡c minh</Button>
              </div>
              {phoneOtpError ? <p className="text-sm font-semibold text-rose-600">{phoneOtpError}</p> : null}
            </div>
          </Card>
        ) : null}

        <Card className="border-emerald-100 bg-white/95 p-6 shadow-xl shadow-emerald-900/10">
          <div className="mb-5 rounded-[22px] border border-emerald-100 bg-gradient-to-br from-emerald-50 to-sky-50 p-4">
            <h2 className="text-xl font-black text-[#12312f]">ThÃ´ng tin nghá» nghiá»‡p</h2>
            <p className="mt-1 text-sm text-slate-500">ThÃ´ng tin nÃ y hiá»ƒn thá»‹ vá»›i khÃ¡ch hÃ ng khi chá»n ngÆ°á»i Ä‘á»“ng hÃ nh.</p>
          </div>

          {editing ? (
            <form className="grid gap-4" onSubmit={saveProfile}>
              <div className="grid gap-4 sm:grid-cols-2">
                <InfoBlock label="NhÃ³m á»©ng viÃªn" value={applicantType.label} className="sm:col-span-2" />
                <Input label="Há» tÃªn Ä‘áº§y Ä‘á»§" value={form.fullName} onChange={(event) => updateField("fullName", event.target.value)} required />
                <Input label="Sá»‘ Ä‘iá»‡n thoáº¡i" value={form.phone} onChange={(event) => updateField("phone", event.target.value)} />

                <div>
                  <Select label="Ca lÃ m viá»‡c" value={form.workingShift} onChange={(event) => updateField("workingShift", event.target.value)}>
                    {workingShiftOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </Select>
                  <p className="mt-2 text-xs font-semibold text-slate-500">KhÃ´ng thá»ƒ Ä‘á»•i ca má»›i náº¿u cÃ²n booking Ä‘Ã£ nháº­n náº±m ngoÃ i khung giá» Ä‘Ã³.</p>
                </div>

                <div className="rounded-[18px] border border-slate-100 bg-slate-50 p-4 sm:col-span-2">
                  <p className="text-xs font-black uppercase text-slate-400">NgÃ y lÃ m viá»‡c trong tuáº§n</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {weekdayOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => toggleWorkingDay(option.value)}
                        className={`rounded-full px-3 py-2 text-xs font-black ${form.workingDays.includes(option.value) ? "bg-teal-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-[18px] border border-slate-100 bg-slate-50 p-4 sm:col-span-2">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <Input label="NgÃ y nghá»‰ cá»¥ thá»ƒ" type="date" value={form.newUnavailableDate} onChange={(event) => updateField("newUnavailableDate", event.target.value)} />
                    <Button type="button" variant="secondary" onClick={addUnavailableDate}>ThÃªm ngÃ y nghá»‰</Button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(form.unavailableDates.length ? form.unavailableDates : ["ChÆ°a cÃ³ ngÃ y nghá»‰"]).map((item) => (
                      <span key={item} className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                        {item}
                        {form.unavailableDates.includes(item) ? (
                          <button type="button" onClick={() => removeUnavailableDate(item)} className="text-rose-600">x</button>
                        ) : null}
                      </span>
                    ))}
                  </div>
                </div>

                <label className="rounded-[18px] border border-slate-100 bg-slate-50 p-4 sm:col-span-2">
                  <div className="flex items-start gap-3">
                    <input type="checkbox" checked={form.acceptingBookings} onChange={(event) => updateField("acceptingBookings", event.target.checked)} className="mt-1 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-200" />
                    <div>
                      <p className="text-sm font-black text-slate-900">Táº¡m ngá»«ng / má»Ÿ nháº­n Ä‘Æ¡n</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">Tắt mục nÃ y sáº½ áº©n báº¡n khá»i danh sÃ¡ch booking má»›i, nhÆ°ng khÃ´ng há»§y cÃ¡c booking Ä‘Ã£ nháº­n.</p>
                    </div>
                  </div>
                </label>

                {applicantType.requiresEducation ? (
                  <>
                    <Input label="CÆ¡ sá»Ÿ Ä‘Ã o táº¡o" value={form.university} onChange={(event) => updateField("university", event.target.value)} />
                    <Input label="NgÃ nh hoáº·c chuyÃªn mÃ´n" value={form.major} onChange={(event) => updateField("major", event.target.value)} />
                  </>
                ) : null}

                {applicantType.value === "graduate" ? <Input label="NÄƒm tá»‘t nghiá»‡p" type="number" min="1950" max={new Date().getFullYear()} value={form.graduationYear} onChange={(event) => updateField("graduationYear", event.target.value)} /> : null}
                {applicantType.requiresExperience ? <Input label="Sá»‘ nÄƒm kinh nghiá»‡m" type="number" min="0" max="60" step="0.5" value={form.yearsOfExperience} onChange={(event) => updateField("yearsOfExperience", event.target.value)} /> : null}
                {applicantType.requiresDescription ? <div className="sm:col-span-2"><Textarea label="Kinh nghiá»‡m hoáº·c lÃ½ do phÃ¹ há»£p" value={form.qualificationDescription} onChange={(event) => updateField("qualificationDescription", event.target.value)} maxLength="1000" /></div> : null}
                <div className="sm:col-span-2"><Textarea label="Ká»¹ nÄƒng, cÃ¡ch nhau báº±ng dáº¥u pháº©y" value={form.skillsText} onChange={(event) => updateField("skillsText", event.target.value)} placeholder="VÃ­ dá»¥: sÆ¡ cá»©u, Ä‘o huyáº¿t Ã¡p, Ä‘i khÃ¡m" /></div>
                <div className="sm:col-span-2"><Textarea label="Khu vá»±c hoáº¡t Ä‘á»™ng, cÃ¡ch nhau báº±ng dáº¥u pháº©y" value={form.serviceAreasText} onChange={(event) => updateField("serviceAreasText", event.target.value)} placeholder="VÃ­ dá»¥: Quáº­n 1, Quáº­n 7, Thá»§ Äá»©c" /></div>
              </div>

              {submitError ? <p className="text-sm font-semibold text-rose-600">{submitError}</p> : null}

              <div className="flex flex-wrap gap-3">
                <Button type="submit" disabled={saving}>{saving ? "Äang lÆ°u..." : "LÆ°u thay Ä‘á»•i"}</Button>
                <Button type="button" variant="secondary" onClick={cancelEdit} disabled={saving}>Há»§y</Button>
              </div>
            </form>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <InfoBlock label="Há» tÃªn Ä‘áº§y Ä‘á»§" value={displayName} />
              <InfoBlock label="Sá»‘ Ä‘iá»‡n thoáº¡i" value={phone} />
              <InfoBlock label="XÃ¡c minh Ä‘iá»‡n thoáº¡i" value={phoneVerified ? "ÄÃ£ xÃ¡c minh" : "ChÆ°a xÃ¡c minh"} />
              <InfoBlock label="Ca lÃ m viá»‡c" value={getWorkingShiftLabel(profile?.workingShift)} />
              <InfoBlock label="NgÃ y lÃ m viá»‡c" value={getWorkingDaysLabel(profile?.workingDays || [])} />
              <InfoBlock label="Nháº­n booking má»›i" value={profile?.acceptingBookings === false ? "Táº¡m ngá»«ng" : "Äang nháº­n"} />
              <InfoBlock label="NgÃ y nghá»‰ cá»¥ thá»ƒ" value={(profile?.unavailableDates || []).join(", ") || "KhÃ´ng cÃ³"} className="sm:col-span-2" />
              <InfoBlock label="NhÃ³m á»©ng viÃªn" value={applicantType.label} />
              {applicantType.requiresEducation ? (
                <>
                  <InfoBlock label="CÆ¡ sá»Ÿ Ä‘Ã o táº¡o" value={profile?.university} />
                  <InfoBlock label="NgÃ nh hoáº·c chuyÃªn mÃ´n" value={profile?.major} />
                </>
              ) : null}
              {applicantType.value === "graduate" ? <InfoBlock label="NÄƒm tá»‘t nghiá»‡p" value={profile?.graduationYear} /> : null}
              {applicantType.requiresExperience ? <InfoBlock label="Kinh nghiá»‡m" value={`${profile?.yearsOfExperience || 0} nÄƒm`} /> : null}
              {applicantType.requiresDescription ? <InfoBlock label="Kinh nghiá»‡m hoáº·c lÃ½ do phÃ¹ há»£p" value={profile?.qualificationDescription} className="sm:col-span-2" /> : null}
              <TagList label="Ká»¹ nÄƒng" items={profile?.skills || []} emptyText="ChÆ°a cÃ³ ká»¹ nÄƒng" />
              <TagList label="Khu vá»±c hoáº¡t Ä‘á»™ng" items={profile?.serviceAreas || []} emptyText="ChÆ°a cáº­p nháº­t" />
            </div>
          )}
        </Card>
      </div>

      <Card className="border-amber-100 bg-white/95 p-6 shadow-xl shadow-amber-900/10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-amber-600">Pháº£n há»“i sau dá»‹ch vá»¥</p>
            <h2 className="mt-1 text-2xl font-black text-[#12312f]">ÄÃ¡nh giÃ¡ tá»« khÃ¡ch hÃ ng</h2>
            <p className="mt-2 text-sm text-slate-500">Theo dÃµi nháº­n xÃ©t khÃ¡ch hÃ ng Ä‘Ã£ gá»­i sau nhá»¯ng booking Ä‘Æ°á»£c thanh toÃ¡n.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:min-w-72">
            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-center">
              <p className="text-2xl font-black text-amber-700">{Number(reviewSummary.ratingAverage || 0).toFixed(1)} / 5</p>
              <p className="mt-1 text-xs font-bold text-amber-700/70">Äiá»ƒm trung bÃ¬nh</p>
            </div>
            <div className="rounded-2xl border border-teal-100 bg-teal-50 p-4 text-center">
              <p className="text-2xl font-black text-teal-700">{reviewSummary.ratingCount || 0}</p>
              <p className="mt-1 text-xs font-bold text-teal-700/70">LÆ°á»£t Ä‘Ã¡nh giÃ¡</p>
            </div>
          </div>
        </div>

        {reviewsError ? <div className="mt-5 rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-semibold text-rose-600">{reviewsError}</div> : null}
        {!reviewsError && reviewsLoading && reviews.length === 0 ? <div className="mt-5 rounded-2xl border border-dashed border-amber-200 p-6 text-center text-sm font-bold text-slate-400">Äang táº£i Ä‘Ã¡nh giÃ¡...</div> : null}
        {!reviewsError && !reviewsLoading && reviews.length === 0 ? <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center"><p className="font-black text-slate-700">ChÆ°a cÃ³ Ä‘Ã¡nh giÃ¡</p><p className="mt-1 text-sm text-slate-500">ÄÃ¡nh giÃ¡ sáº½ xuáº¥t hiá»‡n sau khi khÃ¡ch hÃ ng thanh toÃ¡n vÃ  gá»­i pháº£n há»“i.</p></div> : null}

        {reviews.length > 0 ? (
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {reviews.map((review) => (
              <article key={review._id} className="rounded-[22px] border border-slate-100 bg-[#fbfffe] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-teal-100 to-sky-100 text-sm font-black text-teal-700">
                      {getInitials(review.customerId?.name || "KhÃ¡ch hÃ ng")}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-black text-slate-900">{review.customerId?.name || "KhÃ¡ch hÃ ng"}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-400">{review.createdAt ? dateTime(review.createdAt) : "ChÆ°a cÃ³ thá»i gian"}</p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-700">{review.rating} / 5</span>
                </div>

                {review.bookingId?.serviceId?.name ? <p className="mt-4 text-xs font-black uppercase tracking-wide text-teal-700">{review.bookingId.serviceId.name}</p> : null}
                <p className="mt-3 text-sm leading-6 text-slate-600">{review.comment || "KhÃ¡ch hÃ ng khÃ´ng Ä‘á»ƒ láº¡i nháº­n xÃ©t."}</p>
              </article>
            ))}
          </div>
        ) : null}

        {reviewPagination.page < reviewPagination.totalPages ? (
          <div className="mt-5 flex justify-center">
            <Button type="button" variant="secondary" onClick={() => loadReviewPage(reviewPagination.page + 1, true)} disabled={reviewsLoading}>
              {reviewsLoading ? "Äang táº£i..." : `Xem thÃªm (${reviews.length}/${reviewPagination.total})`}
            </Button>
          </div>
        ) : null}
      </Card>
    </div>
  );
};

export default CompanionProfilePage;
