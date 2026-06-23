import { useRef, useState } from "react";
import { uploadImage } from "../../api/client.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { Button, Card, Input, PageHeader, StatusBadge, Textarea } from "../../components/Ui.jsx";
import { dateTime } from "../../utils/format.js";

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
  university: profile?.university || "",
  major: profile?.major || "",
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
  const { user, updateCompanionProfile, updateProfile } = useAuth();
  const profile = user?.companionProfile;
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(() => toForm(user, profile));
  const [submitError, setSubmitError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const avatarInputRef = useRef(null);

  const displayName = profile?.fullName || user?.name || "Người đồng hành";
  const phone = profile?.phone || user?.phone || "";

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
        university: form.university,
        major: form.major,
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

        <Card className="border-emerald-100 bg-white/95 p-6 shadow-xl shadow-emerald-900/10">
          <div className="mb-5 rounded-[22px] border border-emerald-100 bg-gradient-to-br from-emerald-50 to-sky-50 p-4">
            <h2 className="text-xl font-black text-[#12312f]">Thông tin nghề nghiệp</h2>
            <p className="mt-1 text-sm text-slate-500">Thông tin này hiển thị với khách hàng khi chọn người đồng hành.</p>
          </div>

          {editing ? (
            <form className="grid gap-4" onSubmit={saveProfile}>
              <div className="grid gap-4 sm:grid-cols-2">
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
                <Input
                  label="Trường đại học"
                  value={form.university}
                  onChange={(event) => updateField("university", event.target.value)}
                />
                <Input
                  label="Ngành học"
                  value={form.major}
                  onChange={(event) => updateField("major", event.target.value)}
                />
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
              <InfoBlock label="Trường" value={profile?.university} />
              <InfoBlock label="Chuyên ngành" value={profile?.major} />
              <TagList label="Kỹ năng" items={profile?.skills || []} emptyText="Chưa có kỹ năng" />
              <TagList label="Khu vực hoạt động" items={profile?.serviceAreas || []} emptyText="Chưa cập nhật" />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default CompanionProfilePage;
