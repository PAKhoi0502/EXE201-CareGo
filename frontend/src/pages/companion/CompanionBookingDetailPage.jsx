import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router";
import { api } from "../../api/client.js";
import { Button, Card, Input, PageHeader, Select, StatusBadge, Textarea } from "../../components/Ui.jsx";
import ImageUpload from "../../components/ImageUpload.jsx";
import LiveLocationMap from "../../components/LiveLocationMap.jsx";
import { useAsync } from "../../hooks/useAsync.js";
import { locationSocket } from "../../socket/locationSocket.js";
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
  const [sharing, setSharing] = useState(false);
  const [liveLocations, setLiveLocations] = useState([]);
  const watchIdRef = useRef(null);

  const booking = data?.booking;
  const shiftLog = data?.shiftLog;
  const serviceLocation = booking?.addressLocation?.lat ? booking.addressLocation : null;
  const directionUrl = serviceLocation
    ? `https://www.google.com/maps/dir/?api=1&destination=${serviceLocation.lat},${serviceLocation.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(booking?.address || "")}`;
  const checklist = useMemo(() => shiftLog?.checklist || [], [shiftLog]);
  const hasCheckInPhoto = Boolean(shiftLog?.checkInPhotoUrl);
  const allLocations = useMemo(
    () => [...(shiftLog?.locations || []), ...liveLocations],
    [shiftLog?.locations, liveLocations],
  );
  const latestLocation = allLocations[allLocations.length - 1];

  useEffect(() => {
    locationSocket.connect();
    locationSocket.emit("booking:join", { bookingId: id });

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      locationSocket.emit("booking:leave", { bookingId: id });
    };
  }, [id]);

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

  const startSharing = () => {
    setSubmitError("");

    if (!navigator.geolocation) {
      setSubmitError("Trinh duyet khong ho tro GPS");
      return;
    }

    setSharing(true);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const nextLocation = {
          bookingId: id,
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          note: "Realtime GPS",
          recordedAt: new Date().toISOString(),
        };

        setLiveLocations((current) => [...current, nextLocation]);
        locationSocket.emit("location:send", nextLocation);
      },
      (gpsError) => {
        setSubmitError(gpsError.message);
        setSharing(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000,
      },
    );
  };

  const stopSharing = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setSharing(false);
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

  useEffect(() => {
    if (!shiftLog) {
      return;
    }

    setShift({
      checkInPhotoUrl: shiftLog.checkInPhotoUrl || "",
      checkOutPhotoUrl: shiftLog.checkOutPhotoUrl || "",
      bloodPressure: shiftLog.healthMetrics?.bloodPressure || "",
      heartRate: shiftLog.healthMetrics?.heartRate || "",
      mood: shiftLog.healthMetrics?.mood || "",
      companionNote: shiftLog.companionNote || "",
    });
  }, [shiftLog]);

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
          {serviceLocation ? (
            <p className="mt-2 text-sm font-semibold text-teal-700">
              Diem den da ghim: {Number(serviceLocation.lat).toFixed(6)}, {Number(serviceLocation.lng).toFixed(6)}
            </p>
          ) : null}
          <p className="mt-4 text-sm text-slate-600">{booking.note || "Khong co ghi chu tu gia dinh"}</p>
          <div className="mt-5">
            <a href={directionUrl} target="_blank" rel="noreferrer">
              <Button type="button" variant="secondary">Mo chi duong</Button>
            </a>
          </div>
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
          <h2 className="font-bold text-slate-950">Diem den cua khach hang</h2>
          <p className="mt-1 text-sm text-slate-500">
            Vi tri nay lay tu dia chi khach hang da tim kiem hoac bam ghim khi dat lich.
          </p>
          {serviceLocation ? (
            <>
              <p className="mt-3 text-sm font-semibold text-teal-700">
                Da ghim: {Number(serviceLocation.lat).toFixed(6)}, {Number(serviceLocation.lng).toFixed(6)}
              </p>
              <div className="mt-4">
                <LiveLocationMap location={serviceLocation} locations={[]} />
              </div>
            </>
          ) : (
            <div className="mt-4 rounded-md bg-amber-50 p-4 text-sm text-amber-800">
              Booking nay chua co toa do ghim. Hay mo chi duong bang dia chi text, hoac tao booking moi va bam
              "Tim tren ban do" truoc khi dat lich.
            </div>
          )}
        </Card>

        <Card>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-bold text-slate-950">GPS realtime</h2>
              <p className="mt-1 text-sm text-slate-500">
                {sharing ? "Dang chia se vi tri voi gia dinh." : "Bam bat dau de khach hang thay vi tri tren ban do."}
              </p>
            </div>
            {sharing ? (
              <Button variant="danger" onClick={stopSharing}>Dung chia se</Button>
            ) : (
              <Button onClick={startSharing}>Bat dau chia se</Button>
            )}
          </div>
          <div className="mt-4">
            <LiveLocationMap location={latestLocation || serviceLocation} locations={allLocations} />
          </div>
        </Card>

        <Card>
          <h2 className="font-bold text-slate-950">Cap nhat GPS thu cong</h2>
          <form className="mt-4 grid gap-3 md:grid-cols-3" onSubmit={addLocation}>
            <Input label="Lat" value={location.lat} onChange={(e) => setLocation({ ...location, lat: e.target.value })} />
            <Input label="Lng" value={location.lng} onChange={(e) => setLocation({ ...location, lng: e.target.value })} />
            <Input label="Ghi chu" value={location.note} onChange={(e) => setLocation({ ...location, note: e.target.value })} />
            <Button className="md:col-span-3">Them vi tri</Button>
          </form>
        </Card>

        <Card>
          <h2 className="font-bold text-slate-950">Quy trinh check-in</h2>
          <p className="mt-1 text-sm text-slate-500">
            Luu anh check-in truoc, sau do thuc hien checklist theo dung thu tu.
          </p>
          <div className="mt-4 grid gap-4">
            <ImageUpload
              label="Anh check-in"
              folder="carego/check-in"
              value={shift.checkInPhotoUrl}
              onUploaded={(url) => setShift({ ...shift, checkInPhotoUrl: url })}
            />
            <Button onClick={() => updateShift()} disabled={!shift.checkInPhotoUrl}>
              Luu anh check-in
            </Button>
          </div>
          {hasCheckInPhoto ? (
            <p className="mt-3 rounded-md bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
              Da check-in. Co the bat dau checklist.
            </p>
          ) : (
            <p className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
              Checklist se bi khoa cho den khi co anh check-in.
            </p>
          )}
        </Card>

        <Card>
          <h2 className="font-bold text-slate-950">Checklist theo thu tu</h2>
          <div className="mt-4 grid gap-3">
            {checklist.map((item, index) => {
              const previousDone = index === 0 || checklist[index - 1]?.done;
              const disabled = !hasCheckInPhoto || !previousDone;

              return (
                <div
                  key={item.label}
                  className={`flex items-center justify-between gap-4 rounded-md border p-4 text-sm ${
                    item.done ? "border-teal-200 bg-teal-50" : "border-slate-200 bg-white"
                  } ${disabled ? "opacity-60" : ""}`}
                >
                  <div>
                    <p className="font-semibold text-slate-900">
                      Buoc {index + 1}: {item.label}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {disabled ? "Hoan thanh buoc truoc de mo buoc nay" : item.done ? "Da hoan thanh" : "Gat de xac nhan"}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      const next = checklist.map((current, currentIndex) =>
                        currentIndex === index ? { ...current, done: !current.done } : current,
                      );
                      updateShift(next);
                    }}
                    className={`relative h-7 w-12 rounded-full transition ${
                      item.done ? "bg-teal-700" : "bg-slate-300"
                    } disabled:cursor-not-allowed`}
                  >
                    <span
                      className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${
                        item.done ? "left-6" : "left-1"
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <h2 className="font-bold text-slate-950">Bao cao sau ca</h2>
          <div className="mt-4 grid gap-4">
            <ImageUpload
              label="Anh check-out"
              folder="carego/check-out"
              value={shift.checkOutPhotoUrl}
              onUploaded={(url) => setShift({ ...shift, checkOutPhotoUrl: url })}
            />
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
