import { useState } from "react";
import { api } from "../../api/client.js";
import { Button, Card, Input, PageHeader, Select, StatusBadge } from "../../components/Ui.jsx";
import { useAsync } from "../../hooks/useAsync.js";

const emptyForm = {
  name: "",
  fullName: "",
  email: "",
  password: "",
  phone: "",
  university: "",
  major: "",
  skillsText: "",
  serviceAreasText: "",
  pricePerHour: 80000,
};

const AdminCompanionsPage = () => {
  const { data, reload, error } = useAsync(() => api.get("/companions/admin/all"), []);
  const [form, setForm] = useState(emptyForm);
  const [submitError, setSubmitError] = useState("");
  const companions = data?.companions || [];

  const create = async (event) => {
    event.preventDefault();
    setSubmitError("");
    try {
      await api.post("/companions", {
        ...form,
        skills: form.skillsText.split(",").map((item) => item.trim()).filter(Boolean),
        serviceAreas: form.serviceAreasText.split(",").map((item) => item.trim()).filter(Boolean),
        pricePerHour: Number(form.pricePerHour),
      });
      setForm(emptyForm);
      reload();
    } catch (err) {
      setSubmitError(err.message);
    }
  };

  const updateStatus = async (id, vettingStatus) => {
    await api.patch(`/companions/${id}/status`, { vettingStatus });
    reload();
  };

  return (
    <>
      <PageHeader title="Nguoi dong hanh" subtitle="Tao tai khoan va duyet ho so companion." />
      {error ? <p className="mb-4 text-sm text-rose-600">{error}</p> : null}
      <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <h2 className="mb-4 font-bold text-slate-950">Tao nhanh companion</h2>
          <form className="grid gap-4" onSubmit={create}>
            <Input label="Ten hien thi" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input label="Ho ten" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            <Input label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input label="Mat khau" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <Input label="So dien thoai" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Input label="Truong" value={form.university} onChange={(e) => setForm({ ...form, university: e.target.value })} />
            <Input label="Nganh" value={form.major} onChange={(e) => setForm({ ...form, major: e.target.value })} />
            <Input label="Ky nang" value={form.skillsText} onChange={(e) => setForm({ ...form, skillsText: e.target.value })} />
            <Input label="Khu vuc" value={form.serviceAreasText} onChange={(e) => setForm({ ...form, serviceAreasText: e.target.value })} />
            <Input label="Gia theo gio" type="number" value={form.pricePerHour} onChange={(e) => setForm({ ...form, pricePerHour: e.target.value })} />
            {submitError ? <p className="text-sm text-rose-600">{submitError}</p> : null}
            <Button>Tao va duyet</Button>
          </form>
        </Card>
        <div className="grid gap-4">
          {companions.map((item) => (
            <Card key={item._id}>
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-bold text-slate-950">{item.fullName}</h2>
                    <StatusBadge status={item.vettingStatus} />
                  </div>
                  <p className="text-sm text-slate-500">{item.userId?.email} - {item.university} - {item.major}</p>
                </div>
                <Select
                  label="Trang thai"
                  value={item.vettingStatus}
                  onChange={(e) => updateStatus(item._id, e.target.value)}
                  className="xl:w-48"
                >
                  <option value="pending">pending</option>
                  <option value="approved">approved</option>
                  <option value="rejected">rejected</option>
                  <option value="suspended">suspended</option>
                </Select>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
};

export default AdminCompanionsPage;
