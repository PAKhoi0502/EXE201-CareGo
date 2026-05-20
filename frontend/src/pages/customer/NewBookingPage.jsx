import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { api } from "../../api/client.js";
import { Button, Card, Input, PageHeader, Select, Textarea } from "../../components/Ui.jsx";
import { useAsync } from "../../hooks/useAsync.js";
import { money } from "../../utils/format.js";

const NewBookingPage = () => {
  const navigate = useNavigate();
  const { data: elderData } = useAsync(() => api.get("/elders/my"), []);
  const { data: serviceData } = useAsync(() => api.get("/services"), []);
  const { data: companionData } = useAsync(() => api.get("/companions"), []);
  const [form, setForm] = useState({
    elderProfileId: "",
    serviceId: "",
    companionId: "",
    startTime: "",
    durationHours: 2,
    address: "",
    note: "",
  });
  const [error, setError] = useState("");

  const services = serviceData?.services || [];
  const elders = elderData?.elders || [];
  const companions = companionData?.companions || [];
  const selectedService = useMemo(
    () => services.find((item) => item._id === form.serviceId),
    [services, form.serviceId],
  );
  const total = (selectedService?.pricePerHour || 0) * Number(form.durationHours || 0);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    try {
      const data = await api.post("/bookings", {
        ...form,
        durationHours: Number(form.durationHours),
      });
      navigate(`/customer/bookings/${data.booking._id}`);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <>
      <PageHeader title="Dat lich moi" subtitle="Chon nguoi than, dich vu va nguoi dong hanh phu hop." />
      <Card>
        <form className="grid gap-4" onSubmit={submit}>
          <div className="grid gap-4 md:grid-cols-2">
            <Select label="Nguoi than" value={form.elderProfileId} onChange={(e) => setForm({ ...form, elderProfileId: e.target.value })}>
              <option value="">Chon ho so</option>
              {elders.map((elder) => <option key={elder._id} value={elder._id}>{elder.fullName}</option>)}
            </Select>
            <Select label="Dich vu" value={form.serviceId} onChange={(e) => setForm({ ...form, serviceId: e.target.value })}>
              <option value="">Chon dich vu</option>
              {services.map((service) => <option key={service._id} value={service._id}>{service.name} - {money(service.pricePerHour)}/h</option>)}
            </Select>
            <Select label="Nguoi dong hanh" value={form.companionId} onChange={(e) => setForm({ ...form, companionId: e.target.value })}>
              <option value="">Chon nguoi dong hanh</option>
              {companions.map((item) => <option key={item._id} value={item.userId?._id}>{item.fullName} - {item.major}</option>)}
            </Select>
            <Input label="Thoi gian bat dau" type="datetime-local" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
            <Input label="So gio" type="number" min="1" value={form.durationHours} onChange={(e) => setForm({ ...form, durationHours: e.target.value })} />
            <Input label="Dia chi thuc hien" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <Textarea label="Ghi chu cho nguoi dong hanh" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          <div className="rounded-md bg-slate-50 p-4 text-sm">
            <span className="text-slate-500">Tam tinh: </span>
            <b className="text-teal-700">{money(total)}</b>
          </div>
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          <Button className="w-full md:w-fit">Tao booking</Button>
        </form>
      </Card>
    </>
  );
};

export default NewBookingPage;
