import { useState } from "react";
import { api } from "../../api/client.js";
import { Button, Card, EmptyState, Input, PageHeader, Textarea } from "../../components/Ui.jsx";
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

const CustomerEldersPage = () => {
  const { data, loading, error, reload } = useAsync(() => api.get("/elders/my"), []);
  const [form, setForm] = useState(emptyForm);
  const [submitError, setSubmitError] = useState("");
  const elders = data?.elders || [];
  const initials = (name = "CG") =>
    name
      .split(" ")
      .filter(Boolean)
      .slice(-2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();

  const submit = async (event) => {
    event.preventDefault();
    setSubmitError("");
    try {
      await api.post("/elders", {
        fullName: form.fullName,
        age: Number(form.age),
        address: form.address,
        medicalNotes: form.medicalNotes,
        chronicConditions: form.chronicConditionsText.split(",").map((item) => item.trim()).filter(Boolean),
        emergencyContact: {
          name: form.emergencyName,
          phone: form.emergencyPhone,
          relationship: form.emergencyRelationship,
        },
      });
      setForm(emptyForm);
      reload();
    } catch (err) {
      setSubmitError(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Hồ sơ người thân" subtitle="Quản lý thông tin chăm sóc của cha mẹ/người cao tuổi." />
      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="border-teal-100 bg-white/95 p-6 shadow-xl shadow-teal-900/10">
          <div className="mb-5 rounded-[24px] border border-teal-100 bg-gradient-to-br from-teal-50 to-sky-50 p-4">
            <h2 className="text-xl font-black text-[#12312f]">Thêm hồ sơ người thân</h2>
            <p className="mt-1 text-sm text-slate-500">Lưu thông tin sức khỏe để đặt lịch nhanh hơn.</p>
          </div>
          <form className="grid gap-4" onSubmit={submit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Họ tên" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
              <Input label="Tuổi" type="number" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} />
            </div>
            <Input label="Địa chỉ" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            <Textarea label="Ghi chú y tế" value={form.medicalNotes} onChange={(e) => setForm({ ...form, medicalNotes: e.target.value })} />
            <Input
              label="Bệnh nền, cách nhau bằng dấu phẩy"
              value={form.chronicConditionsText}
              onChange={(e) => setForm({ ...form, chronicConditionsText: e.target.value })}
            />
            <div className="rounded-[22px] border border-teal-100 bg-[#f7fffe] p-4">
              <h3 className="text-sm font-black text-slate-900">Liên hệ khẩn cấp</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <Input label="Họ tên" value={form.emergencyName} onChange={(e) => setForm({ ...form, emergencyName: e.target.value })} />
                <Input label="Số điện thoại" value={form.emergencyPhone} onChange={(e) => setForm({ ...form, emergencyPhone: e.target.value })} />
                <Input label="Quan hệ" value={form.emergencyRelationship} onChange={(e) => setForm({ ...form, emergencyRelationship: e.target.value })} />
              </div>
            </div>
            {submitError ? <p className="text-sm text-rose-600">{submitError}</p> : null}
            <Button className="w-fit">Thêm hồ sơ</Button>
          </form>
        </Card>
        <div className="grid gap-4">
          {loading ? <p>Đang tải...</p> : null}
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          {!loading && elders.length === 0 ? <EmptyState title="Chưa có hồ sơ người thân" /> : null}
          {elders.map((elder) => (
            <Card key={elder._id} className="border-teal-100 bg-white/95 p-5 shadow-xl shadow-teal-900/10">
              <div className="flex items-start gap-4">
                <div className="grid h-12 w-12 place-items-center rounded-[16px] bg-gradient-to-br from-teal-100 to-sky-100 text-base font-black text-teal-700">
                  {initials(elder.fullName)}
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-black text-slate-950">{elder.fullName}</h2>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                      {elder.age} tuổi
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{elder.address}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 text-sm">
                <div className="rounded-[18px] border border-slate-100 bg-slate-50 p-3">
                  <p className="font-semibold text-slate-700">Ghi chú y tế</p>
                  <p className="mt-1 text-slate-600">{elder.medicalNotes || "Chưa có ghi chú y tế"}</p>
                </div>

                {elder.chronicConditions?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {elder.chronicConditions.map((item) => (
                      <span key={item} className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">
                        {item}
                      </span>
                    ))}
                  </div>
                ) : null}

                {elder.emergencyContact ? (
                  <div className="rounded-[18px] border border-teal-100 bg-[#f7fffe] p-3">
                    <p className="font-semibold text-slate-700">Liên hệ khẩn cấp</p>
                    <p className="mt-1 text-slate-600">
                      {elder.emergencyContact.name || "Đang cập nhật"} • {elder.emergencyContact.phone || "---"} • {elder.emergencyContact.relationship || "---"}
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
