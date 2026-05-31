import { useState } from "react";
import { api } from "../../api/client.js";
import {
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  Textarea,
} from "../../components/Ui.jsx";
import { useAsync } from "../../hooks/useAsync.js";

const emptyForm = {
  fullName: "",
  age: "",
  address: "",
  medicalNotes: "",
  chronicConditionsText: "",
  emergencyName: "",
  emergencyPhone: "",
  emergencyRelationship: "",
};

const toForm = (elder) => ({
  fullName: elder.fullName || "",
  age: elder.age || "",
  address: elder.address || "",
  medicalNotes: elder.medicalNotes || "",
  chronicConditionsText: elder.chronicConditions?.join(", ") || "",
  emergencyName: elder.emergencyContact?.name || "",
  emergencyPhone: elder.emergencyContact?.phone || "",
  emergencyRelationship: elder.emergencyContact?.relationship || "",
});

const toPayload = (form) => ({
  fullName: form.fullName,
  age: Number(form.age),
  address: form.address,
  medicalNotes: form.medicalNotes,
  chronicConditions: form.chronicConditionsText
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean),
  emergencyContact: {
    name: form.emergencyName,
    phone: form.emergencyPhone,
    relationship: form.emergencyRelationship,
  },
});

const CustomerEldersPage = () => {
  const { data, loading, error, reload } = useAsync(() => api.get("/elders/my"), []);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const elders = data?.elders || [];

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
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async (event) => {
    event.preventDefault();
    setSubmitError("");
    setSubmitting(true);

    try {
      const payload = toPayload(form);

      if (editingId) {
        await api.put(`/elders/${editingId}`, payload);
      } else {
        await api.post("/elders", payload);
      }

      resetForm();
      await reload();
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hồ sơ người thân"
        subtitle="Quản lý thông tin chăm sóc của cha mẹ/người cao tuổi."
      />

      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="border-teal-100 bg-white/95 p-6 shadow-xl shadow-teal-900/10">
          <div className="mb-5 rounded-[24px] border border-teal-100 bg-gradient-to-br from-teal-50 to-sky-50 p-4">
            <h2 className="text-xl font-black text-[#12312f]">
              {editingId ? "Sửa hồ sơ người thân" : "Thêm hồ sơ người thân"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {editingId
                ? "Cập nhật thông tin sức khỏe, địa chỉ và liên hệ khẩn cấp."
                : "Lưu thông tin sức khỏe để đặt lịch nhanh hơn."}
            </p>
          </div>

          <form className="grid gap-4" onSubmit={submit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Họ tên"
                value={form.fullName}
                onChange={(event) =>
                  setForm({ ...form, fullName: event.target.value })
                }
                required
              />
              <Input
                label="Tuổi"
                type="number"
                value={form.age}
                onChange={(event) =>
                  setForm({ ...form, age: event.target.value })
                }
                required
              />
            </div>

            <Input
              label="Địa chỉ"
              value={form.address}
              onChange={(event) =>
                setForm({ ...form, address: event.target.value })
              }
              required
            />

            <Textarea
              label="Ghi chú y tế"
              value={form.medicalNotes}
              onChange={(event) =>
                setForm({ ...form, medicalNotes: event.target.value })
              }
            />

            <Input
              label="Bệnh nền, cách nhau bằng dấu phẩy"
              value={form.chronicConditionsText}
              onChange={(event) =>
                setForm({ ...form, chronicConditionsText: event.target.value })
              }
            />

            <div className="rounded-[22px] border border-teal-100 bg-[#f7fffe] p-4">
              <h3 className="text-sm font-black text-slate-900">
                Liên hệ khẩn cấp
              </h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <Input
                  label="Họ tên"
                  value={form.emergencyName}
                  onChange={(event) =>
                    setForm({ ...form, emergencyName: event.target.value })
                  }
                />
                <Input
                  label="Số điện thoại"
                  value={form.emergencyPhone}
                  onChange={(event) =>
                    setForm({ ...form, emergencyPhone: event.target.value })
                  }
                />
                <Input
                  label="Quan hệ"
                  value={form.emergencyRelationship}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      emergencyRelationship: event.target.value,
                    })
                  }
                />
              </div>
            </div>

            {submitError ? (
              <p className="text-sm font-semibold text-rose-600">{submitError}</p>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <Button className="w-fit" disabled={submitting}>
                {submitting
                  ? "Đang lưu..."
                  : editingId
                    ? "Lưu thay đổi"
                    : "Thêm hồ sơ"}
              </Button>

              {editingId ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="w-fit"
                  onClick={resetForm}
                >
                  Hủy sửa
                </Button>
              ) : null}
            </div>
          </form>
        </Card>

        <div className="grid gap-4">
          {loading ? <p>Đang tải...</p> : null}
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          {!loading && elders.length === 0 ? (
            <EmptyState title="Chưa có hồ sơ người thân" />
          ) : null}

          {elders.map((elder) => (
            <Card
              key={elder._id}
              className={`border-teal-100 bg-white/95 p-5 shadow-xl shadow-teal-900/10 ${
                editingId === elder._id ? "ring-2 ring-teal-300" : ""
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="grid h-12 w-12 place-items-center rounded-[16px] bg-gradient-to-br from-teal-100 to-sky-100 text-base font-black text-teal-700">
                  {initials(elder.fullName)}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-black text-slate-950">
                      {elder.fullName}
                    </h2>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                      {elder.age} tuổi
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{elder.address}</p>
                </div>

                <button
                  type="button"
                  onClick={() => startEdit(elder)}
                  className="rounded-full border border-teal-100 bg-teal-50 px-4 py-2 text-xs font-black text-teal-700 transition hover:border-teal-300 hover:bg-teal-100"
                >
                  Sửa
                </button>
              </div>

              <div className="mt-4 grid gap-3 text-sm">
                <div className="rounded-[18px] border border-slate-100 bg-slate-50 p-3">
                  <p className="font-semibold text-slate-700">Ghi chú y tế</p>
                  <p className="mt-1 text-slate-600">
                    {elder.medicalNotes || "Chưa có ghi chú y tế"}
                  </p>
                </div>

                {elder.chronicConditions?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {elder.chronicConditions.map((item) => (
                      <span
                        key={item}
                        className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                ) : null}

                {elder.emergencyContact ? (
                  <div className="rounded-[18px] border border-teal-100 bg-[#f7fffe] p-3">
                    <p className="font-semibold text-slate-700">
                      Liên hệ khẩn cấp
                    </p>
                    <p className="mt-1 text-slate-600">
                      {elder.emergencyContact.name || "Đang cập nhật"} ·{" "}
                      {elder.emergencyContact.phone || "---"} ·{" "}
                      {elder.emergencyContact.relationship || "---"}
                    </p>
                  </div>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CustomerEldersPage;
