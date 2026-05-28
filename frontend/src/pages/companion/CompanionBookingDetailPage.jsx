import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router";
import { api } from "../../api/client.js";
import { Button, Card, Input, StatusBadge, Textarea } from "../../components/Ui.jsx";
import ImageUpload from "../../components/ImageUpload.jsx";
import LiveLocationMap from "../../components/LiveLocationMap.jsx";
import { useAsync } from "../../hooks/useAsync.js";
import { locationSocket } from "../../socket/locationSocket.js";
import { dateTime, money } from "../../utils/format.js";

const statusCopy = {
  pending: {
    badge: "Đơn mới từ khách hàng",
    title: "Nhận đơn chăm sóc cùng CareGo",
    desc: "Kiểm tra thông tin người cao tuổi, địa điểm, lưu ý sức khỏe và GPS trước khi nhận ca.",
    state: "Chờ nhận booking",
  },
  accepted: {
    badge: "Đã nhận booking",
    title: "Theo dõi đường đi đến điểm đón",
    desc: "GPS thời gian thực đang được bật để gia đình theo dõi vị trí của bạn trên bản đồ.",
    state: "Đang di chuyển",
  },
  in_progress: {
    badge: "Đã check-in",
    title: "Cập nhật hoạt động trong ca làm",
    desc: "Cập nhật checklist, ảnh xác nhận và ghi chú quan trọng để gia đình theo dõi.",
    state: "Đang hỗ trợ",
  },
  completed: {
    badge: "Đã gửi báo cáo",
    title: "Chờ khách hàng xác nhận",
    desc: "Ca làm đã hoàn thành. Hệ thống sẽ xử lý thanh toán sau khi khách hàng xác nhận.",
    state: "Chờ xác nhận thanh toán",
  },
  paid: {
    badge: "Đã thanh toán",
    title: "Thu nhập đã được ghi nhận",
    desc: "Tiền ca làm đã được ghi nhận vào lịch sử thu nhập của người đồng hành.",
    state: "Đã thanh toán",
  },
};

const flowSteps = [
  ["Nhận booking", "accepted"],
  ["Đang di chuyển", "accepted"],
  ["Check-in", "in_progress"],
  ["Checklist", "in_progress"],
  ["Hoàn thành", "completed"],
];

const InfoMini = ({ label, value }) => (
  <div className="rounded-2xl border border-teal-100 bg-[#fbfffe] p-3">
    <span className="block text-xs font-semibold text-slate-400">{label}</span>
    <strong className="mt-1 block text-sm text-[#12312f]">{value}</strong>
  </div>
);

const DetailItem = ({ number, title, children }) => (
  <div className="flex gap-3 rounded-3xl border border-teal-100 bg-[#fbfffe] p-4">
    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-sm font-black text-teal-800">
      {number}
    </div>
    <div>
      <strong className="block text-sm text-[#12312f]">{title}</strong>
      <p className="mt-1 text-sm leading-6 text-slate-500">{children}</p>
    </div>
  </div>
);

const CompanionBookingDetailPage = () => {
  const { id } = useParams();
  const { data, setData, loading, error } = useAsync(() => api.get(`/bookings/${id}`), [id]);
  const [shift, setShift] = useState({
    checkInPhotoUrl: [],
    checkOutPhotoUrl: [],
    bloodPressure: "",
    heartRate: "",
    mood: "",
    companionNote: "",
  });
  const [submitError, setSubmitError] = useState("");
  const [gpsReady, setGpsReady] = useState(false);
  const [gpsError, setGpsError] = useState("");
  const [liveLocations, setLiveLocations] = useState([]);
  const watchIdRef = useRef(null);

  const booking = data?.booking;
  const shiftLog = data?.shiftLog;
  const companionUserId = booking?.companionId?._id || booking?.companionId;
  const serviceLocation = booking?.addressLocation?.lat ? booking.addressLocation : null;
  const checklist = useMemo(() => shiftLog?.checklist || [], [shiftLog]);
  const savedCheckInPhotoUrls = Array.isArray(shiftLog?.checkInPhotoUrl) ? shiftLog.checkInPhotoUrl : [];
  const hasSavedCheckInPhoto = savedCheckInPhotoUrls.length > 0;
  const hasCheckInPhoto = hasSavedCheckInPhoto || shift.checkInPhotoUrl.length > 0;
  const savedCheckOutPhotoUrls = Array.isArray(shiftLog?.checkOutPhotoUrl) ? shiftLog.checkOutPhotoUrl : [];
  const hasSavedCheckOutPhoto = savedCheckOutPhotoUrls.length > 0;
  const hasCheckOutPhoto = hasSavedCheckOutPhoto || shift.checkOutPhotoUrl.length > 0;
  const hasRealtimeNote = Boolean(shift.companionNote?.trim());
  const hasSavedRealtimeNote = Boolean(shiftLog?.companionNote?.trim());
  const hasChecklist = checklist.length > 0;
  const isChecklistDone = !hasChecklist || checklist.every((item) => item.done);
  const canEditRealtimeNote = booking?.status === "in_progress" && isChecklistDone;
  const allLocations = useMemo(
    () => [...(shiftLog?.locations || []), ...liveLocations],
    [shiftLog?.locations, liveLocations],
  );
  const latestLocation = allLocations[allLocations.length - 1];

  const earning = booking ? Math.max((booking.totalAmount || 0) - (booking.platformFee || 0), 0) : 0;
  const copy = statusCopy[booking?.status] || statusCopy.pending;
  const statusIndex = Math.max(0, ["pending", "accepted", "in_progress", "completed", "paid"].indexOf(booking?.status));
  const directionUrl = serviceLocation
    ? `https://www.google.com/maps/dir/?api=1&destination=${serviceLocation.lat},${serviceLocation.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(booking?.address || "")}`;

  useEffect(() => {
    locationSocket.connect();
    locationSocket.emit("booking:join", { bookingId: id });

    if (!navigator.geolocation) {
      setGpsReady(false);
      setGpsError("Trình duyệt không hỗ trợ GPS");
      return () => {
        locationSocket.emit("booking:leave", { bookingId: id });
      };
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const nextLocation = {
          bookingId: id,
          companionId: companionUserId,
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          note: "Realtime GPS",
          recordedAt: new Date().toISOString(),
        };

        setLiveLocations((current) => [...current, nextLocation]);
        locationSocket.emit("location:send", nextLocation);
        setGpsReady(true);
        setGpsError("");
      },
      (error) => {
        setGpsReady(false);
        setGpsError(error.message);
        locationSocket.emit("location:stop", { bookingId: id, companionId: companionUserId });
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000,
      },
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }

      setGpsReady(false);
      locationSocket.emit("location:stop", { bookingId: id, companionId: companionUserId });
      locationSocket.emit("booking:leave", { bookingId: id });
    };
  }, [id, companionUserId]);

  useEffect(() => {
    if (!shiftLog) return;

    setShift({
      checkInPhotoUrl: Array.isArray(shiftLog.checkInPhotoUrl) ? shiftLog.checkInPhotoUrl : [],
      checkOutPhotoUrl: Array.isArray(shiftLog.checkOutPhotoUrl) ? shiftLog.checkOutPhotoUrl : [],
      bloodPressure: shiftLog.healthMetrics?.bloodPressure || "",
      heartRate: shiftLog.healthMetrics?.heartRate || "",
      mood: shiftLog.healthMetrics?.mood || "",
      companionNote: shiftLog.companionNote || "",
    });
  }, [shiftLog]);

  const ensureGps = () => {
    if (gpsReady) return true;
    setSubmitError("Bạn cần bật GPS và cấp quyền vị trí để thao tác ca làm.");
    return false;
  };

  const keepScrollPosition = () => {
    const scrollY = window.scrollY;
    const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const activeTop = activeElement?.getBoundingClientRect().top;

    return () => {
      requestAnimationFrame(() => {
        if (activeElement && activeTop !== undefined && document.contains(activeElement)) {
          const nextTop = activeElement.getBoundingClientRect().top;
          window.scrollBy({ top: nextTop - activeTop, behavior: "auto" });
          return;
        }

        window.scrollTo({ top: scrollY, behavior: "auto" });
      });
    };
  };

  const updateStatus = async (nextStatus, { requireGps = true } = {}) => {
    if (requireGps && !ensureGps()) return false;

    const restoreScroll = keepScrollPosition();
    setSubmitError("");
    try {
      const response = await api.patch(`/bookings/${id}/status`, { status: nextStatus });
      setData((current) =>
        current
          ? {
            ...current,
            booking: {
              ...current.booking,
              status: response.booking?.status || nextStatus,
              updatedAt: response.booking?.updatedAt || current.booking?.updatedAt,
            },
          }
          : current,
      );
      restoreScroll();
      return true;
    } catch (err) {
      setSubmitError(err.message);
      restoreScroll();
      return false;
    }
  };

  const updateShift = async (nextChecklist = checklist, nextShift = shift) => {
    if (!ensureGps()) return false;

    const restoreScroll = keepScrollPosition();
    setSubmitError("");
    try {
      const response = await api.patch(`/bookings/${id}/shift-log`, {
        checkInPhotoUrl: nextShift.checkInPhotoUrl,
        checkOutPhotoUrl: nextShift.checkOutPhotoUrl,
        checklist: nextChecklist,
        healthMetrics: {
          bloodPressure: nextShift.bloodPressure,
          heartRate: Number(nextShift.heartRate || 0),
          mood: nextShift.mood,
        },
        companionNote: nextShift.companionNote,
      });
      setData((current) =>
        current
          ? {
            ...current,
            shiftLog: {
              ...(current.shiftLog || {}),
              ...(response.shiftLog || {}),
              checkInPhotoUrl: response.shiftLog?.checkInPhotoUrl ?? nextShift.checkInPhotoUrl,
              checkOutPhotoUrl: response.shiftLog?.checkOutPhotoUrl ?? nextShift.checkOutPhotoUrl,
              checklist: response.shiftLog?.checklist || nextChecklist,
              healthMetrics: response.shiftLog?.healthMetrics || {
                bloodPressure: nextShift.bloodPressure,
                heartRate: Number(nextShift.heartRate || 0),
                mood: nextShift.mood,
              },
              companionNote: response.shiftLog?.companionNote ?? nextShift.companionNote,
            },
          }
          : current,
      );
      restoreScroll();
      return true;
    } catch (err) {
      setSubmitError(err.message);
      restoreScroll();
      return false;
    }
  };

  const acceptBooking = () => updateStatus("accepted", { requireGps: false });

  const checkInShift = async () => {
    if (!hasSavedCheckInPhoto) {
      setSubmitError("Bạn cần chụp hoặc tải ảnh check-in trước khi bấm Đã đến nơi.");
      return;
    }

    const saved = await updateShift(checklist);
    if (saved) {
      await updateStatus("in_progress");
    }
  };

  const completeShift = async () => {
    if (!hasSavedCheckOutPhoto) {
      setSubmitError("Bạn cần lưu ảnh sau ca trước khi hoàn thành.");
      return;
    }

    if (!hasSavedRealtimeNote) {
      setSubmitError("Bạn cần lưu ghi chú trước khi hoàn thành ca.");
      return;
    }

    const saved = await updateShift(checklist);
    if (saved) {
      await updateStatus("completed");
    }
  };

  const toggleChecklist = (index) => {
    const previousDone = index === 0 || checklist[index - 1]?.done;
    if (booking.status !== "in_progress" || !hasSavedCheckInPhoto || !previousDone) return;

    const next = checklist.map((item, currentIndex) =>
      currentIndex === index ? { ...item, done: !item.done } : item,
    );
    updateShift(next);
  };

  if (loading) return <p>Đang tải...</p>;
  if (error) return <p className="text-sm text-rose-600">{error}</p>;
  if (!booking) return null;

  return (
    <div className="-mx-[calc((100vw-min(1180px,92vw))/2)] -my-7 min-h-screen bg-[#f5fbfa] text-[#12312f]">
      <section className="bg-[radial-gradient(circle_at_15%_8%,rgba(20,184,166,0.22),transparent_32%),radial-gradient(circle_at_90%_20%,rgba(59,130,246,0.12),transparent_30%)] py-14">
        <div className="mx-auto grid w-[min(1180px,92%)] gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <div className="mb-5 inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-700">
              {copy.badge}
            </div>
            <h1 className="max-w-3xl text-5xl font-black leading-tight sm:text-6xl">
              {copy.title.split("CareGo")[0]}
              {copy.title.includes("CareGo") ? <span className="text-teal-800">CareGo</span> : null}
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-500">{copy.desc}</p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <InfoMini label="Khoảng cách" value={latestLocation && serviceLocation ? "GPS đang tính" : "Chờ GPS"} />
              <InfoMini label="GPS thời gian thực" value={gpsReady ? "Đang bật" : "Cần cấp quyền"} />
              <InfoMini label="Thu nhập dự kiến" value={money(earning)} />
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[34px] border border-teal-100 bg-white/85 p-7 shadow-xl shadow-teal-900/10">
            <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-teal-100/70" />
            <div className="relative">
              <h2 className="text-2xl font-black">Tình trạng ca làm</h2>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                Quy trình người đồng hành gồm: nhận booking, di chuyển với GPS, check-in ảnh, checklist, báo cáo sau ca và chờ khách xác nhận.
              </p>
              <div className="mt-5 flex items-center justify-between gap-3 rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">
                <span className="text-sm font-bold">Trạng thái hiện tại</span>
                <strong>{copy.state}</strong>
              </div>
              <div className="mt-5 grid gap-2">
                {flowSteps.map(([label], index) => (
                  <div key={label} className="flex items-center gap-3">
                    <span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-black ${index <= statusIndex ? "bg-teal-700 text-white" : "bg-slate-100 text-slate-400"}`}>
                      {index + 1}
                    </span>
                    <span className={`text-sm font-bold ${index <= statusIndex ? "text-[#12312f]" : "text-slate-400"}`}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto grid w-[min(1180px,92%)] gap-6 py-8 lg:grid-cols-[1fr_370px] lg:items-start">
        <section className="grid gap-6">
          {!gpsReady ? (
            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
              Bạn cần bật GPS và cho phép trình duyệt truy cập vị trí. Nếu không bật GPS, bạn sẽ không thể nhận ca, check-in hay cập nhật checklist.
              {gpsError ? <p className="mt-1">Lỗi GPS: {gpsError}</p> : null}
            </div>
          ) : null}
          {submitError ? <p className="rounded-3xl bg-rose-50 p-4 text-sm font-semibold text-rose-700">{submitError}</p> : null}

          <Card id="newBookingSection" className="scroll-mt-24 rounded-[30px] border-teal-100 bg-white/95 p-6 shadow-xl shadow-teal-900/5">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-2xl font-black">Lịch đặt cần phản hồi</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">Kiểm tra thông tin trước khi nhận hoặc từ chối ca làm.</p>
              </div>
              <StatusBadge status={booking.status} />
            </div>

            <div className="rounded-[30px] border border-teal-100 bg-gradient-to-b from-white to-[#f0fdfa] p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex gap-4">
                  <div className="grid h-16 w-16 shrink-0 place-items-center rounded-3xl bg-gradient-to-br from-teal-100 to-sky-100 text-xl font-black text-teal-800">
                    CG
                  </div>
                  <div>
                    <h3 className="text-xl font-black">{booking.elderProfileId?.fullName || "Người thân"}</h3>
                    <p className="mt-1 text-sm text-slate-500">Người đặt: {booking.customerId?.name || "Khách hàng"}</p>
                  </div>
                </div>
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">
                  {booking.status === "pending" ? "Đơn mới" : "Đã ghi nhận"}
                </span>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-4">
                <InfoMini label="Dịch vụ" value={booking.serviceId?.name || "CareGo"} />
                <InfoMini label="Thời gian" value={dateTime(booking.startTime)} />
                <InfoMini label="Địa điểm" value={booking.address || "Chưa có địa chỉ"} />
                <InfoMini label="Thu nhập" value={money(earning)} />
              </div>

              <div className="mt-5 grid gap-3">
                <DetailItem number="1" title="Điểm đón / điểm thực hiện">
                  {booking.address || "Chưa có địa chỉ từ khách hàng."}
                </DetailItem>
                <DetailItem number="2" title="Tọa độ khách đã ghim">
                  {serviceLocation
                    ? `${Number(serviceLocation.lat).toFixed(6)}, ${Number(serviceLocation.lng).toFixed(6)}`
                    : "Đơn này chưa có tọa độ ghim trên bản đồ."}
                </DetailItem>
                <DetailItem number="3" title="Lưu ý sức khỏe">
                  {booking.note || "Không có ghi chú đặc biệt từ gia đình."}
                </DetailItem>
              </div>

              <div className="mt-5 rounded-3xl border border-teal-100 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-black text-[#12312f]">Địa chỉ khách đã chọn</h3>
                  <span className={`rounded-full px-3 py-1 text-xs font-black ${serviceLocation ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                    {serviceLocation ? "Đã ghim" : "Chưa có tọa độ"}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Đây là vị trí khách hàng đã tìm kiếm hoặc bấm ghim trên bản đồ khi đặt lịch.
                </p>
                {serviceLocation ? (
                  <div className="mt-4">
                    <LiveLocationMap location={serviceLocation} locations={[]} height="320px" />
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
                    Đơn này chưa có tọa độ trên bản đồ.
                  </div>
                )}
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <Button className="min-h-12 rounded-full font-black" onClick={acceptBooking} disabled={booking.status !== "pending"}>
                  Chấp nhận
                </Button>
                {booking.status === "pending" ? (
                  <button
                    type="button"
                    disabled
                    className="inline-flex min-h-12 cursor-not-allowed items-center justify-center rounded-full border border-slate-200 bg-slate-100 px-4 text-sm font-black text-slate-400"
                  >
                    Mở chỉ đường
                  </button>
                ) : (
                  <a href={directionUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center justify-center rounded-full border border-teal-200 bg-white px-4 text-sm font-black text-teal-800 transition hover:bg-teal-50">
                    Mở chỉ đường
                  </a>
                )}
                <Button className="min-h-12 rounded-full font-black" variant="danger" onClick={() => updateStatus("cancelled", { requireGps: false })} disabled={booking.status !== "pending"}>
                  Từ chối
                </Button>
              </div>
            </div>
          </Card>

          <Card id="checklistSection" className="scroll-mt-24 rounded-[30px] border-teal-100 bg-white/95 p-6 shadow-xl shadow-teal-900/5">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-2xl font-black">Check-in tại điểm đón</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">Chụp ảnh xác nhận trước ca, sau đó bấm Đã đến nơi để chuyển sang trong ca làm.</p>
              </div>
              <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-black text-sky-700">Ảnh trước ca</span>
            </div>

            <div className={`rounded-3xl bg-[#fbfffe] p-5 ${hasSavedCheckInPhoto ? "border border-teal-100" : "border-2 border-dashed border-teal-200"}`}>
              {booking.status === "pending" ? (
                <div className="mb-4 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
                  Bạn cần nhận đơn trước khi chụp hoặc tải ảnh check-in.
                </div>
              ) : null}
              <ImageUpload
                label="Ảnh check-in"
                folder="carego/check-in"
                value={shift.checkInPhotoUrl}
                onUploaded={(url) => setShift({ ...shift, checkInPhotoUrl: url })}
                locked={booking.status === "pending" || hasSavedCheckInPhoto}
                compact={hasSavedCheckInPhoto}
              />
            </div>

            {hasSavedCheckInPhoto ? (
              <div className="mt-5 rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
                Ảnh check-in đã được lưu. Bạn có thể bấm Đã đến nơi để bắt đầu ca làm.
              </div>
            ) : shift.checkInPhotoUrl.length > 0 ? (
              <div className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
                Ảnh đã tải tạm thời. Hãy bấm Lưu ảnh check-in để lưu vào ca làm trước.
              </div>
            ) : null}

            <div className={`mt-5 grid gap-3 ${hasSavedCheckInPhoto ? "sm:grid-cols-2" : ""}`}>
              {!hasSavedCheckInPhoto ? (
                <Button className="min-h-12 rounded-full font-black" variant="secondary" onClick={() => updateShift(checklist)} disabled={!gpsReady || shift.checkInPhotoUrl.length === 0}>
                  Lưu ảnh check-in
                </Button>
              ) : null}
              {hasSavedCheckInPhoto ? (
                <Button className="min-h-12 rounded-full font-black" onClick={checkInShift} disabled={!gpsReady || booking.status !== "accepted"}>
                  {booking.status === "accepted" ? "Đã đến nơi" : "Đã check-in"}
                </Button>
              ) : null}
              {hasSavedCheckInPhoto && savedCheckInPhotoUrls.length > 0 ? (
                <a href={savedCheckInPhotoUrls[0]} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center justify-center rounded-full border border-teal-200 bg-white px-4 text-sm font-black text-teal-800 transition hover:bg-teal-50">
                  Xem ảnh đã lưu ({savedCheckInPhotoUrls.length})
                </a>
              ) : null}
            </div>
          </Card>

          <Card id="reportSection" className="scroll-mt-24 rounded-[30px] border-teal-100 bg-white/95 p-6 shadow-xl shadow-teal-900/5">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-2xl font-black">Checklist trong ca làm</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">Checklist được gạt theo thứ tự. Gia đình sẽ thấy tiến trình cập nhật theo thời gian thực.</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">Theo thứ tự</span>
            </div>

            <div className="grid gap-3">
              {checklist.length ? checklist.map((item, index) => {
                const previousDone = index === 0 || checklist[index - 1]?.done;
                const canUseChecklist = booking.status === "in_progress";
                const disabled = !gpsReady || !hasSavedCheckInPhoto || !previousDone || !canUseChecklist;

                return (
                  <div
                    key={item.label}
                    className={`flex items-center justify-between gap-4 rounded-3xl border p-4 ${item.done ? "border-teal-200 bg-teal-50" : "border-teal-100 bg-[#fbfffe]"} ${disabled ? "opacity-60" : ""}`}
                  >
                    <div>
                      <p className="font-black text-[#12312f]">Bước {index + 1}: {item.label}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {!hasSavedCheckInPhoto
                          ? "Cần lưu ảnh check-in trước ca"
                          : !canUseChecklist
                            ? "Cần bấm Đã đến nơi trước khi chọn checklist"
                            : !previousDone
                              ? "Hoàn thành bước trước để mở bước này"
                              : item.done
                                ? "Đã hoàn thành"
                                : "Gạt để xác nhận hoàn thành"}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => toggleChecklist(index)}
                      className={`relative h-8 w-14 rounded-full transition disabled:cursor-not-allowed ${item.done ? "bg-teal-700" : "bg-slate-300"}`}
                    >
                      <span className={`absolute top-1 h-6 w-6 rounded-full bg-white transition ${item.done ? "left-7" : "left-1"}`} />
                    </button>
                  </div>
                );
              }) : (
                <p className="rounded-3xl bg-slate-50 p-4 text-sm text-slate-500">Dịch vụ này chưa có checklist mặc định.</p>
              )}
            </div>
          </Card>

          <Card id="activeShiftSection" className="scroll-mt-24 rounded-[30px] border-teal-100 bg-white/95 p-6 shadow-xl shadow-teal-900/5">
            <div className="mb-5">
              <h2 className="text-2xl font-black">Ghi chú thời gian thực trong ca</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">Cập nhật tình trạng, chỉ số và ghi chú nếu có thay đổi trong quá trình đi bệnh viện hoặc hoạt động ngoài trời.</p>
            </div>
            {booking.status === "pending" ? (
              <div className="mb-5 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
                Bạn cần nhận đơn trước khi nhập ghi chú thời gian thực.
              </div>
            ) : null}
            {booking.status !== "pending" && !isChecklistDone ? (
              <div className="mb-5 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
                Bạn cần hoàn thành toàn bộ checklist trước khi nhập ghi chú thời gian thực.
              </div>
            ) : null}
            <fieldset disabled={!canEditRealtimeNote} className="contents">
              <div className="grid gap-4 md:grid-cols-3">
                <Input label="Huyết áp" value={shift.bloodPressure} disabled={booking.status === "pending"} onChange={(event) => setShift({ ...shift, bloodPressure: event.target.value })} />
                <Input label="Nhịp tim" type="number" value={shift.heartRate} disabled={booking.status === "pending"} onChange={(event) => setShift({ ...shift, heartRate: event.target.value })} />
                <Input label="Tâm trạng" value={shift.mood} disabled={booking.status === "pending"} onChange={(event) => setShift({ ...shift, mood: event.target.value })} />
              </div>
              <Textarea
                label="Ghi chú trong ca / lời dặn bác sĩ"
                className="mt-4"
                value={shift.companionNote}
                disabled={booking.status === "pending"}
                onChange={(event) => setShift({ ...shift, companionNote: event.target.value })}
              />
              <Button className="mt-4 min-h-12 rounded-full px-6 font-black" onClick={() => updateShift(checklist)} disabled={!gpsReady || booking.status === "pending"}>
                Lưu ghi chú
              </Button>
            </fieldset>
          </Card>

          <Card className="rounded-[30px] border-teal-100 bg-white/95 p-6 shadow-xl shadow-teal-900/5">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-2xl font-black">Kết thúc ca và báo cáo sau ca</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">Tải ảnh sau ca, nhập ghi chú cuối và bấm Hoàn thành ca. Sau đó hệ thống chờ khách xác nhận.</p>
              </div>
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">Cần cập nhật</span>
            </div>

            <div className="rounded-3xl border-2 border-dashed border-teal-200 bg-[#fbfffe] p-5">
              {booking.status === "pending" ? (
                <div className="mb-4 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
                  Bạn cần nhận đơn trước khi chụp hoặc tải ảnh sau ca.
                </div>
              ) : null}
              {booking.status !== "pending" && !hasSavedRealtimeNote ? (
                <div className="mb-4 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
                  Bạn cần bấm Lưu ghi chú trước khi chụp hoặc tải ảnh sau ca.
                </div>
              ) : null}
              {hasSavedRealtimeNote && shift.checkOutPhotoUrl.length > 0 && !hasSavedCheckOutPhoto ? (
                <div className="mb-4 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
                  Ảnh sau ca đã tải tạm thời. Hãy bấm Lưu báo cáo để lưu ảnh vào ca làm trước khi hoàn thành.
                </div>
              ) : null}
              {hasSavedCheckOutPhoto ? (
                <div className="mb-4 rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
                  Ảnh sau ca đã được lưu. Bạn có thể bấm Hoàn thành ca.
                </div>
              ) : null}
              <ImageUpload
                label="Ảnh sau ca"
                folder="carego/check-out"
                value={shift.checkOutPhotoUrl}
                onUploaded={(url) => setShift({ ...shift, checkOutPhotoUrl: url })}
                locked={booking.status === "pending" || !hasSavedRealtimeNote || hasSavedCheckOutPhoto}
                compact={hasSavedCheckOutPhoto}
              />
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {!hasSavedCheckOutPhoto ? (
                <Button className="min-h-12 rounded-full font-black" variant="secondary" onClick={() => updateShift(checklist)} disabled={!gpsReady || !hasSavedRealtimeNote || !hasCheckOutPhoto}>
                  Lưu ảnh
                </Button>
              ) : null}
              {hasSavedCheckOutPhoto && savedCheckOutPhotoUrls.length > 0 ? (
                <a href={savedCheckOutPhotoUrls[0]} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center justify-center rounded-full border border-teal-200 bg-white px-4 text-sm font-black text-teal-800 transition hover:bg-teal-50">
                  Xem ảnh đã lưu ({savedCheckOutPhotoUrls.length})
                </a>
              ) : null}
              <Button className="min-h-12 rounded-full font-black" onClick={completeShift} disabled={!gpsReady || booking.status !== "in_progress" || !hasSavedCheckOutPhoto}>
                Hoàn thành ca
              </Button>
              <Button className="min-h-12 rounded-full font-black" variant="muted" disabled>
                Chờ khách xác nhận
              </Button>
            </div>
          </Card>
        </section>

        <aside className="grid gap-6 lg:sticky lg:top-24">
          <Card className="rounded-[30px] border-teal-100 bg-white/95 p-6 shadow-xl shadow-teal-900/5">
            <div className="mb-4">
              <h2 className="text-2xl font-black">Tóm tắt ca</h2>
              <p className="mt-2 text-sm text-slate-500">Thông tin nhanh để theo dõi tiến trình.</p>
            </div>
            <div className="rounded-[30px] bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.28),transparent_30%),linear-gradient(135deg,#0f766e,#14b8a6)] p-5 text-white">
              <div className="mb-5 flex items-center gap-4">
                <div className="grid h-16 w-16 place-items-center rounded-3xl bg-white text-xl font-black text-teal-800">CG</div>
                <div>
                  <h3 className="text-xl font-black">{booking.elderProfileId?.fullName || "Người thân"}</h3>
                  <p className="text-sm text-white/75">{booking.serviceId?.name || "CareGo"}</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/20 bg-white/15 p-3">
                  <small className="block text-white/70">Trạng thái</small>
                  <strong>{copy.state}</strong>
                </div>
                <div className="rounded-2xl border border-white/20 bg-white/15 p-3">
                  <small className="block text-white/70">Thu nhập</small>
                  <strong>{money(earning)}</strong>
                </div>
                <div className="rounded-2xl border border-white/20 bg-white/15 p-3">
                  <small className="block text-white/70">Check-in</small>
                  <strong>{hasCheckInPhoto ? "Đã có ảnh" : "Chưa có"}</strong>
                </div>
                <div className="rounded-2xl border border-white/20 bg-white/15 p-3">
                  <small className="block text-white/70">Sau ca</small>
                  <strong>{booking.status === "completed" || booking.status === "paid" ? "Đã gửi" : "Chưa gửi"}</strong>
                </div>
              </div>
            </div>
          </Card>

          <Card className="hidden rounded-[30px] border-teal-100 bg-white/95 p-6 shadow-xl shadow-teal-900/5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-black">Địa chỉ khách đã chọn</h2>
              <span className={`rounded-full px-3 py-1 text-xs font-black ${serviceLocation ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                {serviceLocation ? "Đã ghim" : "Chưa có tọa độ"}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Đây là vị trí khách hàng đã tìm kiếm hoặc bấm ghim trên bản đồ khi đặt lịch.
            </p>
            <div className="mt-4 rounded-3xl border border-teal-100 bg-[#fbfffe] p-4 text-sm text-slate-600">
              <strong className="block text-[#12312f]">Địa chỉ thực hiện</strong>
              <span className="mt-1 block leading-6">{booking.address || "Khách hàng chưa nhập địa chỉ."}</span>
              {serviceLocation ? (
                <span className="mt-2 block font-bold text-teal-700">
                  {Number(serviceLocation.lat).toFixed(6)}, {Number(serviceLocation.lng).toFixed(6)}
                </span>
              ) : null}
            </div>
            {serviceLocation ? (
              <>
                <div className="mt-4">
                  <LiveLocationMap location={serviceLocation} locations={[]} height="420px" />
                </div>
                <a href={directionUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-full border border-teal-200 bg-white px-4 text-sm font-black text-teal-800 transition hover:bg-teal-50">
                  Mở chỉ đường đến địa chỉ này
                </a>
              </>
            ) : (
              <div className="mt-4 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
                Đơn này chưa có tọa độ trên bản đồ. Hãy dùng địa chỉ chữ để liên hệ khách hoặc yêu cầu khách tạo lại đơn có ghim vị trí.
              </div>
            )}
          </Card>

          <Card className="rounded-[30px] border-teal-100 bg-white/95 p-6 shadow-xl shadow-teal-900/5">
            <h2 className="text-xl font-black">Quy tắc an toàn</h2>
            <div className="mt-4 grid gap-3">
              <DetailItem number="1" title="Không tự ý cho thuốc">Chỉ nhắc thuốc theo đơn có sẵn hoặc lời dặn của gia đình.</DetailItem>
              <DetailItem number="2" title="Không thu tiền ngoài app">Mọi thanh toán cần được thực hiện qua CareGo.</DetailItem>
              <DetailItem number="3" title="Không đổi lộ trình">Cần báo gia đình trước khi thay đổi điểm đến hoặc lịch trình.</DetailItem>
            </div>
          </Card>
        </aside>
      </main>
    </div>
  );
};

export default CompanionBookingDetailPage;
