import { useMemo, useState } from "react";
import { useParams } from "react-router";
import { api } from "../../api/client.js";
import { Button, Card, Input, PageHeader, Select, StatusBadge, Textarea } from "../../components/Ui.jsx";
import { useAsync } from "../../hooks/useAsync.js";
import { dateTime } from "../../utils/format.js";

const CompanionBookingDetailPage = () => {
  const { id } = useParams();
  const { data, loading, error, reload } = useAsync(() => api.get(`/bookings/${id}`), [id]);
  const [status, setStatus] = useState("accepted");
  const [location, setLocation] = useState({ lat: "", lng: "", note: "" });
  const [shift, setShift] = useState({
    checkInPhotoUrl: "",
    checkOutPhotoUrl: "",
    bloodPressure: "",
    heartRate: "",
    mood: "",
    companionNote: "",
  });
  const [submitError, setSubmitError] = useState("");

  const booking = data?.booking;
  const shiftLog = data?.shiftLog;
  const checklist = useMemo(() => shiftLog?.checklist || [], [shiftLog]);

  const updateStatus = async () => {
    setSubmitError("");
    try {
      await api.patch(`/bookings/${id}/status`, { status });
      reload();
    } catch (err) {
      setSubmitError(err.message);
    }
  };

  const addLocation = async (event) => {
    event.preventDefault();
    setSubmitError("");
    try {
      await api.post(`/bookings/${id}/location`, {
        lat: Number(location.lat),
        lng: Number(location.lng),
        note: location.note,
      });
      setLocation({ lat: "", lng: "", note: "" });
      reload();
    } catch (err) {
      setSubmitError(err.message);
    }
  };

  const updateShift = async (nextChecklist = checklist) => {
    setSubmitError("");
    try {
      await api.patch(`/bookings/${id}/shift-log`, {
        checkInPhotoUrl: shift.checkInPhotoUrl,
        checkOutPhotoUrl: shift.checkOutPhotoUrl,
        checklist: nextChecklist,
        healthMetrics: {
          bloodPressure: shift.bloodPressure,
          heartRate: Number(shift.heartRate || 0),
          mood: shift.mood,
        },
        companionNote: shift.companionNote,
      });
      reload();
    } catch (err) {
      setSubmitError(err.message);
    }
  };

  if (loading) return <p>Dang tai...</p>;
  if (error) return <p className="text-sm text-rose-600">{error}</p>;
  if (!booking) return null;

  return (
    <>
      <PageHeader title="Cap nhat ca lam" subtitle={`${booking.serviceId?.name} - ${dateTime(booking.startTime)}`} />
      {submitError ? <p className="mb-4 rounded-md bg-rose-50 p-3 text-sm text-rose-700">{submitError}</p> : null}
      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-950">{booking.elderProfileId?.fullName}</h2>
            <StatusBadge status={booking.status} />
          </div>
          <p className="mt-2 text-sm text-slate-500">{booking.address}</p>
          <p className="mt-4 text-sm text-slate-600">{booking.note || "Khong co ghi chu tu gia dinh"}</p>
          <div className="mt-5 grid gap-3">
            <Select label="Cap nhat trang thai" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="accepted">Nhan ca</option>
              <option value="in_progress">Bat dau ca</option>
              <option value="completed">Hoan thanh</option>
            </Select>
            <Button onClick={updateStatus}>Luu trang thai</Button>
          </div>
        </Card>

        <Card>
          <h2 className="font-bold text-slate-950">Cap nhat GPS</h2>
          <form className="mt-4 grid gap-3 md:grid-cols-3" onSubmit={addLocation}>
            <Input label="Lat" value={location.lat} onChange={(e) => setLocation({ ...location, lat: e.target.value })} />
            <Input label="Lng" value={location.lng} onChange={(e) => setLocation({ ...location, lng: e.target.value })} />
            <Input label="Ghi chu" value={location.note} onChange={(e) => setLocation({ ...location, note: e.target.value })} />
            <Button className="md:col-span-3">Them vi tri</Button>
          </form>
        </Card>

        <Card>
          <h2 className="font-bold text-slate-950">Checklist</h2>
          <div className="mt-4 grid gap-2">
            {checklist.map((item, index) => (
              <label key={item.label} className="flex items-center gap-3 rounded-md bg-slate-50 p-3 text-sm">
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={(event) => {
                    const next = checklist.map((current, currentIndex) =>
                      currentIndex === index ? { ...current, done: event.target.checked } : current,
                    );
                    updateShift(next);
                  }}
                />
                <span>{item.label}</span>
              </label>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="font-bold text-slate-950">Bao cao ca lam</h2>
          <div className="mt-4 grid gap-4">
            <Input label="Anh check-in URL" value={shift.checkInPhotoUrl} onChange={(e) => setShift({ ...shift, checkInPhotoUrl: e.target.value })} />
            <Input label="Anh check-out URL" value={shift.checkOutPhotoUrl} onChange={(e) => setShift({ ...shift, checkOutPhotoUrl: e.target.value })} />
            <div className="grid gap-3 md:grid-cols-3">
              <Input label="Huyet ap" value={shift.bloodPressure} onChange={(e) => setShift({ ...shift, bloodPressure: e.target.value })} />
              <Input label="Nhip tim" type="number" value={shift.heartRate} onChange={(e) => setShift({ ...shift, heartRate: e.target.value })} />
              <Input label="Tam trang" value={shift.mood} onChange={(e) => setShift({ ...shift, mood: e.target.value })} />
            </div>
            <Textarea label="Ghi chu" value={shift.companionNote} onChange={(e) => setShift({ ...shift, companionNote: e.target.value })} />
            <Button onClick={() => updateShift()}>Luu bao cao</Button>
          </div>
        </Card>
      </div>
    </>
  );
};

export default CompanionBookingDetailPage;
