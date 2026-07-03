import { useState } from "react";
import { api } from "../../api/client.js";
import { useAsync } from "../../hooks/useAsync.js";
import ConsentChecklist from "../../components/legal/ConsentChecklist.jsx";

const emptyForm = {
  fullName: "",
  age: "",
  gender: "other",
  address: "",
  medicalNotes: "",
  chronicConditionsText: "",
  emergencyName: "",
  emergencyPhone: "",
  emergencyRelationship: "",
  legalAcceptances: [],
};

const genderLabels = {
  male: "Nam",
  female: "Nữ",
  other: "Khác",
};

const toForm = (elder) => ({
  fullName: elder.fullName || "",
  age: elder.age || "",
  gender: elder.gender || "other",
  address: elder.address || "",
  medicalNotes: elder.medicalNotes || "",
  chronicConditionsText: elder.chronicConditions?.join(", ") || "",
  emergencyName: elder.emergencyContact?.name || "",
  emergencyPhone: elder.emergencyContact?.phone || "",
  emergencyRelationship: elder.emergencyContact?.relationship || "",
  legalAcceptances: [],
});

const toPayload = (form) => ({
  fullName: form.fullName.trim(),
  age: Number(form.age),
  gender: form.gender,
  address: form.address.trim(),
  medicalNotes: form.medicalNotes.trim(),
  chronicConditions: form.chronicConditionsText
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean),
  emergencyContact: {
    name: form.emergencyName.trim(),
    phone: form.emergencyPhone.trim(),
    relationship: form.emergencyRelationship.trim(),
  },
});

const Field = ({ label, hint, children, className = "" }) => (
  <label className={`grid gap-2 ${className}`}>
    <span className="text-sm font-black text-slate-700">{label}</span>
    {children}
    {hint ? <span className="text-xs leading-5 text-slate-400">{hint}</span> : null}
  </label>
);

const inputClass =
  "min-h-12 w-full rounded-2xl border border-teal-100 bg-[#fbfffe] px-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-teal-400 focus:ring-4 focus:ring-teal-100";

const SectionTitle = ({ number, title, description }) => (
  <div className="mb-5 flex gap-3">
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-teal-700 text-xs font-black text-white">
      {number}
    </span>
    <div>
      <h3 className="font-black text-[#12312f]">{title}</h3>
      <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
    </div>
  </div>
);

const CustomerEldersPage = () => {
  const { data, loading, error, reload } = useAsync(() => api.get("/elders/my"), []);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const elders = data?.elders || [];

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const initials = (name = "CG") =>
    name
      .split(" ")
      .filter(Boolean)
      .slice(-2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId("");
    setSubmitError("");
  };

  const startEdit = (elder) => {
    setEditingId(elder._id);
    setForm(toForm(elder));
    setSubmitError("");
    setDeleteError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async (event) => {
    event.preventDefault();
    setSubmitError("");
    setDeleteError("");
    if (!editingId && (!form.legalAcceptances.length || form.legalAcceptances.some((item) => !item.accepted))) {
      setSubmitError("Vui lòng xác nhận quyền cung cấp dữ liệu người thân và chính sách dữ liệu cá nhân.");
      return;
    }
    setSubmitting(true);

    try {
      const payload = toPayload(form);
      if (editingId) {
        await api.put(`/elders/${editingId}`, payload);
      } else {
        await api.post("/elders", { ...payload, legalAcceptances: form.legalAcceptances });
      }
      resetForm();
      await reload();
    } catch (submitException) {
      setSubmitError(submitException.message);
    } finally {
      setSubmitting(false);
    }
  };

  const removeElder = async (elder) => {
    const confirmed = window.confirm(`Xóa hồ sơ người thân "${elder.fullName}"? Hành động này không thể hoàn tác.`);
    if (!confirmed) {
      return;
    }

    setDeleteError("");
    setDeletingId(elder._id);

    try {
      await api.delete(`/elders/${elder._id}`);
      if (editingId === elder._id) {
        resetForm();
      }
      await reload();
    } catch (deleteException) {
      setDeleteError(deleteException.message);
    } finally {
      setDeletingId("");
    }
  };

  return (
    <div className="space-y-7">
      <section className="overflow-hidden rounded-[32px] border border-teal-100 bg-white shadow-xl shadow-teal-900/5">
        <div className="grid gap-6 bg-gradient-to-br from-teal-700 via-teal-600 to-cyan-500 p-7 text-white lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-teal-100">CareGo Family</p>
            <h1 className="mt-3 text-3xl font-black sm:text-4xl">Hồ sơ người thân</h1>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-white/80">
              Lưu thông tin người thân một lần để đặt lịch nhanh hơn và giúp người đồng hành chuẩn bị phù hợp trước mỗi ca.
            </p>
          </div>
          <div className="rounded-3xl border border-white/20 bg-white/15 px-6 py-4 backdrop-blur-sm">
            <p className="text-xs font-bold text-white/70">Đang quản lý</p>
            <p className="mt-1 text-3xl font-black">{elders.length} hồ sơ</p>
          </div>
        </div>
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <form
          onSubmit={submit}
          className="overflow-hidden rounded-[32px] border border-teal-100 bg-white shadow-xl shadow-teal-900/5"
        >
          <div className="flex flex-col gap-4 border-b border-teal-100 bg-gradient-to-r from-teal-50 to-sky-50 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-teal-700">
                {editingId ? "Đang chỉnh sửa hồ sơ" : "Hồ sơ chăm sóc mới"}
              </p>
              <h2 className="mt-1 text-2xl font-black text-[#12312f]">
                {editingId ? "Cập nhật thông tin người thân" : "Thêm người thân"}
              </h2>
            </div>
            {editingId ? (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-full border border-teal-200 bg-white px-4 py-2 text-xs font-black text-teal-700 transition hover:bg-teal-50"
              >
                Hủy chỉnh sửa
              </button>
            ) : null}
          </div>

          <div className="space-y-7 p-6">
            <section>
              <SectionTitle
                number="01"
                title="Thông tin cơ bản"
                description="Thông tin dùng để nhận diện người thân và bố trí lịch chăm sóc."
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Họ và tên">
                  <input
                    value={form.fullName}
                    onChange={(event) => updateForm("fullName", event.target.value)}
                    placeholder="VD: Nguyễn Thị Lan"
                    className={inputClass}
                    required
                  />
                </Field>
                <Field label="Tuổi">
                  <input
                    type="number"
                    min="0"
                    max="130"
                    value={form.age}
                    onChange={(event) => updateForm("age", event.target.value)}
                    placeholder="VD: 68"
                    className={inputClass}
                    required
                  />
                </Field>
                <Field label="Giới tính">
                  <select
                    value={form.gender}
                    onChange={(event) => updateForm("gender", event.target.value)}
                    className={inputClass}
                  >
                    <option value="female">Nữ</option>
                    <option value="male">Nam</option>
                    <option value="other">Khác</option>
                  </select>
                </Field>
                <Field label="Địa chỉ" className="sm:col-span-2">
                  <input
                    value={form.address}
                    onChange={(event) => updateForm("address", event.target.value)}
                    placeholder="Số nhà, đường, phường/xã, quận/huyện"
                    className={inputClass}
                    required
                  />
                </Field>
              </div>
            </section>

            <div className="h-px bg-teal-100" />

            <section>
              <SectionTitle
                number="02"
                title="Thông tin sức khỏe"
                description="Chỉ nhập những thông tin cần thiết để người đồng hành hỗ trợ an toàn hơn."
              />
              <div className="grid gap-4">
                <Field
                  label="Bệnh nền hoặc tình trạng cần lưu ý"
                  hint="Có thể nhập nhiều nội dung và ngăn cách bằng dấu phẩy."
                >
                  <input
                    value={form.chronicConditionsText}
                    onChange={(event) => updateForm("chronicConditionsText", event.target.value)}
                    placeholder="VD: Tiểu đường, đau khớp gối, đi lại chậm"
                    className={inputClass}
                  />
                </Field>
                <Field label="Ghi chú chăm sóc">
                  <textarea
                    value={form.medicalNotes}
                    onChange={(event) => updateForm("medicalNotes", event.target.value)}
                    placeholder="VD: Cần hỗ trợ khi lên xuống cầu thang, không tự ý cho uống thuốc ngoài đơn..."
                    className={`${inputClass} min-h-28 resize-y py-3 leading-6`}
                  />
                </Field>
              </div>
            </section>

            <div className="h-px bg-teal-100" />

            <section>
              <SectionTitle
                number="03"
                title="Liên hệ khẩn cấp"
                description="Người CareGo có thể liên hệ khi cần xác nhận nhanh trong ca chăm sóc."
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Họ tên người liên hệ">
                  <input
                    value={form.emergencyName}
                    onChange={(event) => updateForm("emergencyName", event.target.value)}
                    placeholder="VD: Nguyễn Văn Thanh"
                    className={inputClass}
                  />
                </Field>
                <Field label="Số điện thoại">
                  <input
                    type="tel"
                    value={form.emergencyPhone}
                    onChange={(event) => updateForm("emergencyPhone", event.target.value)}
                    placeholder="VD: 0901234567"
                    className={inputClass}
                  />
                </Field>
                <Field label="Mối quan hệ" className="sm:col-span-2">
                  <input
                    value={form.emergencyRelationship}
                    onChange={(event) => updateForm("emergencyRelationship", event.target.value)}
                    placeholder="VD: Con trai, con gái, người thân"
                    className={inputClass}
                  />
                </Field>
              </div>
            </section>

            {!editingId ? (
              <ConsentChecklist
                flow="ELDER_PROFILE_CREATE"
                onChange={(legalAcceptances) => setForm((current) => ({ ...current, legalAcceptances }))}
              />
            ) : null}

            {submitError ? (
              <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600">
                {submitError}
              </div>
            ) : null}

            <button
              disabled={submitting}
              className="flex min-h-13 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-teal-700 to-emerald-500 px-6 text-sm font-black text-white shadow-lg shadow-teal-700/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Đang lưu hồ sơ..." : editingId ? "Lưu thay đổi" : "Thêm hồ sơ người thân"}
            </button>
          </div>
        </form>

        <section className="space-y-4 xl:sticky xl:top-24">
          <div>
            <h2 className="text-2xl font-black text-[#12312f]">Người thân của bạn</h2>
            <p className="mt-1 text-sm text-slate-500">Chọn sửa để cập nhật thông tin khi cần.</p>
          </div>

          {loading ? (
            <div className="rounded-[28px] border border-teal-100 bg-white p-8 text-center text-sm font-bold text-slate-400">
              Đang tải hồ sơ...
            </div>
          ) : null}
          {error ? (
            <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600">{error}</div>
          ) : null}
          {deleteError ? (
            <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600">{deleteError}</div>
          ) : null}
          {!loading && elders.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-teal-200 bg-white p-8 text-center">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-teal-50 text-xl font-black text-teal-700">+</div>
              <p className="mt-4 font-black text-slate-800">Chưa có hồ sơ người thân</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">Điền biểu mẫu bên cạnh để tạo hồ sơ đầu tiên.</p>
            </div>
          ) : null}

          {elders.map((elder) => (
            <article
              key={elder._id}
              className={`overflow-hidden rounded-[28px] border bg-white shadow-xl shadow-teal-900/5 transition ${
                editingId === elder._id ? "border-teal-400 ring-4 ring-teal-100" : "border-teal-100"
              }`}
            >
              <div className="flex items-start gap-4 bg-gradient-to-r from-teal-50 to-sky-50 p-5">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-3xl bg-white text-base font-black text-teal-700 shadow-sm">
                  {initials(elder.fullName)}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-lg font-black text-[#12312f]">{elder.fullName}</h3>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold">
                    <span className="rounded-full bg-white px-3 py-1 text-teal-700">{elder.age} tuổi</span>
                    <span className="rounded-full bg-white px-3 py-1 text-slate-500">{genderLabels[elder.gender] || "Khác"}</span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(elder)}
                    disabled={Boolean(deletingId)}
                    className="rounded-full border border-teal-200 bg-white px-4 py-2 text-xs font-black text-teal-700 transition hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Sửa
                  </button>
                  <button
                    type="button"
                    onClick={() => removeElder(elder)}
                    disabled={Boolean(deletingId)}
                    className="rounded-full border border-rose-200 bg-white px-4 py-2 text-xs font-black text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {deletingId === elder._id ? "Đang xóa..." : "Xóa"}
                  </button>
                </div>
              </div>

              <div className="grid gap-4 p-5 text-sm">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-slate-400">Địa chỉ</p>
                  <p className="mt-1 leading-6 text-slate-600">{elder.address}</p>
                </div>

                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-slate-400">Ghi chú chăm sóc</p>
                  <p className="mt-1 leading-6 text-slate-600">{elder.medicalNotes || "Chưa có ghi chú chăm sóc."}</p>
                </div>

                {elder.chronicConditions?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {elder.chronicConditions.map((item) => (
                      <span key={item} className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700">
                        {item}
                      </span>
                    ))}
                  </div>
                ) : null}

                {(elder.emergencyContact?.name || elder.emergencyContact?.phone) ? (
                  <div className="rounded-2xl border border-teal-100 bg-[#f7fffe] p-4">
                    <p className="text-xs font-black uppercase tracking-wide text-teal-700">Liên hệ khẩn cấp</p>
                    <p className="mt-2 font-bold text-slate-700">
                      {elder.emergencyContact?.name || "Chưa cập nhật"} · {elder.emergencyContact?.phone || "---"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{elder.emergencyContact?.relationship || "Chưa cập nhật mối quan hệ"}</p>
                  </div>
                ) : null}
              </div>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
};

export default CustomerEldersPage;
