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
    <>
      <PageHeader title="Ho so nguoi than" subtitle="Quan ly thong tin cham soc cua cha me/nguoi cao tuoi." />
      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <h2 className="mb-4 font-bold text-slate-950">Them ho so</h2>
          <form className="grid gap-4" onSubmit={submit}>
            <Input label="Ho ten" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            <Input label="Tuoi" type="number" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} />
            <Input label="Dia chi" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            <Textarea label="Ghi chu y te" value={form.medicalNotes} onChange={(e) => setForm({ ...form, medicalNotes: e.target.value })} />
            <Input label="Benh nen, cach nhau bang dau phay" value={form.chronicConditionsText} onChange={(e) => setForm({ ...form, chronicConditionsText: e.target.value })} />
            <div className="grid gap-3 sm:grid-cols-3">
              <Input label="Lien he khan cap" value={form.emergencyName} onChange={(e) => setForm({ ...form, emergencyName: e.target.value })} />
              <Input label="So dien thoai" value={form.emergencyPhone} onChange={(e) => setForm({ ...form, emergencyPhone: e.target.value })} />
              <Input label="Quan he" value={form.emergencyRelationship} onChange={(e) => setForm({ ...form, emergencyRelationship: e.target.value })} />
            </div>
            {submitError ? <p className="text-sm text-rose-600">{submitError}</p> : null}
            <Button>Them ho so</Button>
          </form>
        </Card>
        <div className="grid gap-4">
          {loading ? <p>Dang tai...</p> : null}
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          {!loading && elders.length === 0 ? <EmptyState title="Chua co ho so nguoi than" /> : null}
          {elders.map((elder) => (
            <Card key={elder._id}>
              <h2 className="font-bold text-slate-950">{elder.fullName}</h2>
              <p className="mt-1 text-sm text-slate-500">{elder.age} tuoi - {elder.address}</p>
              <p className="mt-3 text-sm text-slate-600">{elder.medicalNotes || "Chua co ghi chu y te"}</p>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
};

export default CustomerEldersPage;
