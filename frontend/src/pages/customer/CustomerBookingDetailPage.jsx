import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";
import { api } from "../../api/client.js";
import { Button, Card, Input, PageHeader, StatusBadge, Textarea } from "../../components/Ui.jsx";
import LiveLocationMap from "../../components/LiveLocationMap.jsx";
import { useAsync } from "../../hooks/useAsync.js";
import { locationSocket } from "../../socket/locationSocket.js";
import { dateTime, money } from "../../utils/format.js";

const CustomerBookingDetailPage = () => {
  const { id } = useParams();
  const { data, loading, error, reload } = useAsync(() => api.get(`/bookings/${id}`), [id]);
  const [review, setReview] = useState({ rating: 5, comment: "" });
  const [submitError, setSubmitError] = useState("");
  const [liveLocations, setLiveLocations] = useState([]);

  const booking = data?.booking;
  const shiftLog = data?.shiftLog;
  const allLocations = useMemo(
    () => [...(shiftLog?.locations || []), ...liveLocations],
    [shiftLog?.locations, liveLocations],
  );
  const latestLocation = allLocations[allLocations.length - 1];

  useEffect(() => {
    locationSocket.connect();
    locationSocket.emit("booking:join", { bookingId: id });

    const handleLocation = (location) => {
      if (location.bookingId === id) {
        setLiveLocations((current) => [...current, location]);
      }
    };

    locationSocket.on("location:update", handleLocation);

    return () => {
      locationSocket.emit("booking:leave", { bookingId: id });
      locationSocket.off("location:update", handleLocation);
    };
  }, [id]);

  const pay = async () => {
    setSubmitError("");
    try {
      await api.post(`/bookings/${id}/pay`, { method: "prototype" });
      reload();
    } catch (err) {
      setSubmitError(err.message);
    }
  };

  const submitReview = async (event) => {
    event.preventDefault();
    setSubmitError("");
    try {
      await api.post(`/bookings/${id}/review`, {
        rating: Number(review.rating),
        comment: review.comment,
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
      <PageHeader title="Chi tiet ca cham soc" subtitle={`${booking.serviceId?.name} - ${dateTime(booking.startTime)}`} />
      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-slate-950">{booking.elderProfileId?.fullName}</h2>
              <p className="text-sm text-slate-500">{booking.address}</p>
            </div>
            <StatusBadge status={booking.status} />
          </div>
          <div className="mt-5 grid gap-3 text-sm md:grid-cols-2">
            <p><b>Nguoi dong hanh:</b> {booking.companionId?.name}</p>
            <p><b>So gio:</b> {booking.durationHours}</p>
            <p><b>Tong tien:</b> {money(booking.totalAmount)}</p>
            <p><b>Phi nen tang:</b> {money(booking.platformFee)}</p>
          </div>
          <p className="mt-4 text-sm text-slate-600">{booking.note}</p>
          {booking.status !== "paid" ? (
            <Button className="mt-5" onClick={pay}>Thanh toan prototype</Button>
          ) : null}
          {submitError ? <p className="mt-3 text-sm text-rose-600">{submitError}</p> : null}
        </Card>

        <Card>
          <h2 className="font-bold text-slate-950">Nhat ky ca lam</h2>
          <div className="mt-4 space-y-3 text-sm">
            <p><b>Anh check-in:</b> {shiftLog?.checkInPhotoUrl || "Chua co"}</p>
            <p><b>Anh check-out:</b> {shiftLog?.checkOutPhotoUrl || "Chua co"}</p>
            <p><b>Huyet ap:</b> {shiftLog?.healthMetrics?.bloodPressure || "Chua co"}</p>
            <p><b>Nhip tim:</b> {shiftLog?.healthMetrics?.heartRate || "Chua co"}</p>
            <p><b>Tam trang:</b> {shiftLog?.healthMetrics?.mood || "Chua co"}</p>
            <p><b>Ghi chu:</b> {shiftLog?.companionNote || "Chua co"}</p>
          </div>
        </Card>

        <Card>
          <h2 className="font-bold text-slate-950">Checklist</h2>
          <div className="mt-4 grid gap-2">
            {shiftLog?.checklist?.map((item) => (
              <div key={item.label} className="flex items-center justify-between rounded-md bg-slate-50 p-3 text-sm">
                <span>{item.label}</span>
                <span className={item.done ? "text-teal-700" : "text-slate-400"}>{item.done ? "Da xong" : "Chua"}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="font-bold text-slate-950">GPS realtime</h2>
          <p className="mt-1 text-sm text-slate-500">
            {latestLocation
              ? `Vi tri moi nhat: ${Number(latestLocation.lat).toFixed(6)}, ${Number(latestLocation.lng).toFixed(6)}`
              : "Chua co vi tri."}
          </p>
          <div className="mt-4">
            <LiveLocationMap location={latestLocation} locations={allLocations} />
          </div>
          <div className="mt-4 max-h-64 space-y-2 overflow-auto text-sm">
            {allLocations.length ? allLocations.map((location) => (
              <div key={`${location.lat}-${location.lng}-${location.recordedAt}`} className="rounded-md bg-slate-50 p-3">
                {location.lat}, {location.lng} - {dateTime(location.recordedAt)}
              </div>
            )) : <p className="text-slate-500">Chua co vi tri.</p>}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <h2 className="font-bold text-slate-950">Danh gia nguoi dong hanh</h2>
          {data?.review ? (
            <p className="mt-3 text-sm text-slate-600">Ban da danh gia {data.review.rating}/5: {data.review.comment}</p>
          ) : (
            <form className="mt-4 grid gap-4" onSubmit={submitReview}>
              <Input label="So sao" type="number" min="1" max="5" value={review.rating} onChange={(e) => setReview({ ...review, rating: e.target.value })} />
              <Textarea label="Nhan xet" value={review.comment} onChange={(e) => setReview({ ...review, comment: e.target.value })} />
              <Button className="w-fit">Gui danh gia</Button>
            </form>
          )}
        </Card>
      </div>
    </>
  );
};

export default CustomerBookingDetailPage;
