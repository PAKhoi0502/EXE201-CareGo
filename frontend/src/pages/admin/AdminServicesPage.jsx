import { useState } from "react";
import { api } from "../../api/client.js";
import { Button, Card, Input, PageHeader, Textarea } from "../../components/Ui.jsx";
import { useAsync } from "../../hooks/useAsync.js";
import { money } from "../../utils/format.js";

const emptyForm = { name: "", code: "", description: "", pricePerHour: 80000, checklistText: "" };

const AdminServicesPage = () => {
  const { data, reload } = useAsync(() => api.get("/services"), []);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const services = data?.services || [];

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    try {
      await api.post("/services", {
        name: form.name,
        code: form.code,
        description: form.description,
        pricePerHour: Number(form.pricePerHour),
        defaultChecklist: form.checklistText.split(",").map((item) => item.trim()).filter(Boolean),
      });
      setForm(emptyForm);
      reload();
    } catch (err) {
      setError(err.message);
    }
  };

  const disable = async (id) => {
    await api.delete(`/services/${id}`);
    reload();
  };

  return (
    <>
      <PageHeader title="Quan ly dich vu" subtitle="Tao va tat cac goi dich vu CareGo." />
      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <h2 className="mb-4 font-bold text-slate-950">Tao dich vu</h2>
          <form className="grid gap-4" onSubmit={submit}>
            <Input label="Ten dich vu" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input label="Ma dich vu" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            <Input label="Gia theo gio" type="number" value={form.pricePerHour} onChange={(e) => setForm({ ...form, pricePerHour: e.target.value })} />
            <Textarea label="Mo ta" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <Input label="Checklist mac dinh, cach nhau bang dau phay" value={form.checklistText} onChange={(e) => setForm({ ...form, checklistText: e.target.value })} />
            {error ? <p className="text-sm text-rose-600">{error}</p> : null}
            <Button>Tao dich vu</Button>
          </form>
        </Card>
        <div className="grid gap-4">
          {services.map((service) => (
            <Card key={service._id}>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="font-bold text-slate-950">{service.name}</h2>
                  <p className="text-sm text-slate-500">{service.description}</p>
                  <p className="mt-1 text-sm font-semibold text-teal-700">{money(service.pricePerHour)}/h</p>
                </div>
                <Button variant="danger" onClick={() => disable(service._id)}>An dich vu</Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
};

export default AdminServicesPage;
