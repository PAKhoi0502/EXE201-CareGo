import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";
import { api } from "../../api/client.js";
import { Button, Card, Input, PageHeader, StatusBadge, Textarea } from "../../components/Ui.jsx";
import LiveLocationMap from "../../components/LiveLocationMap.jsx";
import { useAsync } from "../../hooks/useAsync.js";
import { locationSocket } from "../../socket/locationSocket.js";
import { dateTime, money } from "../../utils/format.js";

const ShiftPhoto = ({ label, url, onPreview }) => {
  // Normalize to array
  const urls = Array.isArray(url) ? url : (url ? [url] : []);
  const [sourceIndices, setSourceIndices] = useState({});

  const getCloudinarySources = (imageUrl = "") => {
    const cleanUrl = String(imageUrl || "").trim();
    if (!cleanUrl) {
      return [];
    }

    const sources = [cleanUrl];
    if (cleanUrl.includes("/image/upload/")) {
      sources.push(cleanUrl.replace("/image/upload/", "/image/upload/f_auto,q_auto/"));
      sources.push(cleanUrl.replace(/\.(jpg|jpeg|png|webp|heic|heif)$/i, ""));
    }

    return [...new Set(sources)];
  };

  useEffect(() => {
    setSourceIndices({});
  }, [url]);

  if (urls.length === 0) {
    return (
      <div className="rounded-2xl border border-teal-100 bg-[#fbfffe] p-3">
        <p className="text-sm font-bold text-[#12312f]">{label}</p>
        <p className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Chưa có ảnh</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-teal-100 bg-[#fbfffe] p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-[#12312f]">{label}</p>
        {urls.length > 1 && <p className="text-xs font-bold text-teal-600">({urls.length} ảnh)</p>}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {urls.map((imageUrl, idx) => {
          const sources = getCloudinarySources(imageUrl);
          const currentSourceIndex = sourceIndices[idx] || 0;
          const currentSource = sources[currentSourceIndex];
          const hasUrl = sources.length > 0;

          return (
            <div key={imageUrl} className="relative">
              {hasUrl ? (
                <div className="grid gap-2">
                  {currentSource ? (
                    <button
                      type="button"
                      className="block w-full cursor-zoom-in text-left"
                      onClick={() => onPreview?.({ label: `${label} #${idx + 1}`, url: currentSource, originalUrl: imageUrl })}
                    >
                      <img
                        src={currentSource}
                        alt={`${label} ${idx + 1}`}
                        className="h-32 w-full rounded-2xl border border-teal-100 object-cover shadow-lg shadow-teal-900/5"
                        onError={() =>
                          setSourceIndices((prev) => ({
                            ...prev,
                            [idx]: Math.min((prev[idx] || 0) + 1, sources.length),
                          }))
                        }
                      />
                    </button>
                  ) : null}
                  {currentSourceIndex >= sources.length ? (
                    <a
                      href={imageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-2xl border border-amber-200 bg-amber-50 p-2 text-center text-xs font-bold text-amber-700"
                    >
                      Mở gốc
                    </a>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const CustomerBookingDetailPage = () => {
  const { id } = useParams();
  const { data, loading, error, reload } = useAsync(() => api.get(`/bookings/${id}`), [id]);
  const [review, setReview] = useState({ rating: 5, comment: "" });
  const [submitError, setSubmitError] = useState("");
  const [liveLocations, setLiveLocations] = useState([]);
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [showCompanionPhone, setShowCompanionPhone] = useState(false);
  const [showHotline, setShowHotline] = useState(false);

  const booking = data?.booking;
  const shiftLog = data?.shiftLog;
  const serviceLocation = booking?.addressLocation?.lat ? booking.addressLocation : null;
  const allLocations = useMemo(
    () => [...(shiftLog?.locations || []), ...liveLocations],
    [shiftLog?.locations, liveLocations],
  );
  const latestLocation = allLocations[allLocations.length - 1];
  const statusText = {
    pending: "Chờ xác nhận",
    accepted: "Đã xác nhận",
    in_progress: "Đang diễn ra",
    completed: "Hoàn thành",
    cancelled: "Đã hủy",
    paid: "Đã thanh toán",
  }[booking?.status] || "Đang cập nhật";
  const statusSteps = ["Đặt lịch", "Xác nhận", "Di chuyển", "Hoàn thành"];
  const statusIndex = Math.max(0, ["pending", "accepted", "in_progress", "completed"].indexOf(booking?.status));

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

  if (loading) return <p>Đang tải...</p>;
  if (error) return <p className="text-sm text-rose-600">{error}</p>;
  if (!booking) return null;

  return (
    <div className="min-h-screen bg-[#f5fbfa] text-[#12312f]">
      <div className="mx-auto w-[min(1180px,92%)] py-8">
        <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-700">
              📍 Theo dõi đơn chăm sóc
            </div>
            <h1 className="text-4xl font-black leading-tight sm:text-5xl">
              Theo dõi đơn chăm sóc <span className="text-teal-700">CareGo</span>
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-8 text-slate-500">
              Người đồng hành đã nhận đơn. Bạn có thể theo dõi GPS realtime, nhật ký ca làm và thanh toán dịch vụ.
            </p>
          </div>
          <div className="min-w-[260px] rounded-[24px] border border-teal-100 bg-white p-5 shadow-xl shadow-teal-900/10">
            <small className="block text-xs font-bold uppercase text-slate-400">Trạng thái hiện tại</small>
            <strong className="mt-2 block text-lg font-black text-teal-700">{statusText}</strong>
            <p className="mt-2 text-xs text-slate-500">{booking.serviceId?.name} • {dateTime(booking.startTime)}</p>
          </div>
        </header>

        <main className="mt-8 grid items-start gap-6 xl:grid-cols-[1fr_370px]">
          <section className="grid gap-6">
            <Card className="rounded-[32px] border-teal-100 bg-white/95 p-6 shadow-xl shadow-teal-900/10">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black">Trạng thái đơn chăm sóc</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Đơn đã được tạo thành công. Bạn có thể theo dõi GPS và hoạt động của người đồng hành.
                  </p>
                </div>
                <StatusBadge status={booking.status} />
              </div>

              <div className="mt-6 rounded-[28px] bg-gradient-to-br from-teal-700 to-teal-500 p-5 text-white">
                <div className="mb-5 flex items-center gap-3">
                  <div className="grid h-14 w-14 place-items-center rounded-[18px] bg-white text-xl font-black text-teal-700">
                    {booking.elderProfileId?.fullName?.[0] || "C"}
                  </div>
                  <div>
                    <h3 className="text-xl font-black">{booking.elderProfileId?.fullName}</h3>
                    <p className="text-sm text-white/75">{booking.serviceId?.name}</p>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[16px] border border-white/20 bg-white/15 p-3">
                    <small className="block text-white/70">Người đồng hành</small>
                    <strong className="mt-1 block text-sm">{booking.companionId?.name || "Đang cập nhật"}</strong>
                  </div>
                  <div className="rounded-[16px] border border-white/20 bg-white/15 p-3">
                    <small className="block text-white/70">Thời lượng</small>
                    <strong className="mt-1 block text-sm">{booking.durationHours} giờ</strong>
                  </div>
                  <div className="rounded-[16px] border border-white/20 bg-white/15 p-3">
                    <small className="block text-white/70">Chi phí</small>
                    <strong className="mt-1 block text-sm">{money(booking.totalAmount)}</strong>
                  </div>
                  <div className="rounded-[16px] border border-white/20 bg-white/15 p-3">
                    <small className="block text-white/70">Địa điểm</small>
                    <strong className="mt-1 block text-sm">{booking.address}</strong>
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-[22px] border border-teal-100 bg-[#fbfffe] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <strong>Tiến trình đơn</strong>
                  <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-black text-sky-700">ETA: đang cập nhật</span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-teal-50">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-teal-600 to-emerald-500"
                    style={{ width: `${((statusIndex + 1) / statusSteps.length) * 100}%` }}
                  />
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-4">
                  {statusSteps.map((label, index) => (
                    <div
                      key={label}
                      className={`rounded-[14px] border px-3 py-2 text-center text-xs font-black ${index <= statusIndex
                        ? "border-teal-600 bg-teal-700 text-white"
                        : "border-teal-100 bg-[#f7fffe] text-slate-400"
                        }`}
                    >
                      {label}
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            <Card className="rounded-[32px] border-teal-100 bg-white/95 p-6 shadow-xl shadow-teal-900/10">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black">GPS Người Đồng Hành</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {latestLocation
                      ? `Vị trí mới nhất: ${Number(latestLocation.lat).toFixed(6)}, ${Number(latestLocation.lng).toFixed(6)}`
                      : "Chưa có vị trí."}
                  </p>
                </div>
                <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-black text-sky-700">Live</span>
              </div>
              <div className="mt-4">
                <LiveLocationMap location={latestLocation || serviceLocation} locations={allLocations} markerVariant="person" />
              </div>
              <div className="mt-4 max-h-64 space-y-2 overflow-auto text-sm">
                {allLocations.length ? allLocations.map((location) => (
                  <div key={`${location.lat}-${location.lng}-${location.recordedAt}`} className="rounded-md bg-slate-50 p-3">
                    {location.lat}, {location.lng} - {dateTime(location.recordedAt)}
                  </div>
                )) : <p className="text-slate-500">Chưa có vị trí.</p>}
              </div>
            </Card>

            <div className="grid gap-6">
              <Card className="rounded-[32px] border-teal-100 bg-white/95 p-6 shadow-xl shadow-teal-900/10">
                <h2 className="text-2xl font-black">Checklist</h2>
                <div className="mt-4 grid gap-2">
                  {shiftLog?.checklist?.length ? shiftLog.checklist.map((item) => (
                    <div key={item.label} className="flex items-center justify-between rounded-md bg-slate-50 p-3 text-sm">
                      <span>{item.label}</span>
                      <span className={item.done ? "text-teal-700" : "text-slate-400"}>{item.done ? "Đã xong" : "Chưa"}</span>
                    </div>
                  )) : <p className="text-sm text-slate-500">Chưa có checklist.</p>}
                </div>
              </Card>

              <Card className="rounded-[32px] border-teal-100 bg-white/95 p-6 shadow-xl shadow-teal-900/10">
                <h2 className="text-2xl font-black">Nhật ký ca làm</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <ShiftPhoto label="Ảnh check-in" url={shiftLog?.checkInPhotoUrl} onPreview={setPreviewPhoto} />
                  <ShiftPhoto label="Ảnh check-out" url={shiftLog?.checkOutPhotoUrl} onPreview={setPreviewPhoto} />
                </div>
                <div className="mt-4 space-y-3 text-sm">
                  <p><b>Huyết áp:</b> {shiftLog?.healthMetrics?.bloodPressure || "Chưa có"}</p>
                  <p><b>Nhịp tim:</b> {shiftLog?.healthMetrics?.heartRate || "Chưa có"}</p>
                  <p><b>Tâm trạng:</b> {shiftLog?.healthMetrics?.mood || "Chưa có"}</p>
                  <div>
                    <p><b>Ghi chú:</b></p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-slate-700">
                      {shiftLog?.companionNote || "Chưa có"}
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            <Card className="rounded-[32px] border-teal-100 bg-white/95 p-6 shadow-xl shadow-teal-900/10">
              <h2 className="text-2xl font-black">Đánh giá người đồng hành</h2>
              {data?.review ? (
                <p className="mt-3 text-sm text-slate-600">Bạn đã đánh giá {data.review.rating}/5: {data.review.comment}</p>
              ) : (
                <form className="mt-4 grid gap-4" onSubmit={submitReview}>
                  <Input label="Số sao" type="number" min="1" max="5" value={review.rating} onChange={(e) => setReview({ ...review, rating: e.target.value })} />
                  <Textarea label="Nhận xét" value={review.comment} onChange={(e) => setReview({ ...review, comment: e.target.value })} />
                  <Button className="w-fit">Gửi đánh giá</Button>
                </form>
              )}
            </Card>
          </section>

          <aside className="grid gap-6 xl:sticky xl:top-24">
            <Card className="rounded-[32px] border-teal-100 bg-white/95 p-6 shadow-xl shadow-teal-900/10">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black">Thanh toán</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">Thanh toán dịch vụ sau khi đơn được xác nhận.</p>
                </div>
                <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-black text-orange-700">Chờ</span>
              </div>

              <div className="mt-5 grid gap-3 text-sm">
                <div className="flex justify-between gap-3 border-b border-teal-50 pb-3 text-slate-500">
                  <span>Phí dịch vụ</span>
                  <strong className="text-[#12312f]">{money(booking.totalAmount)}</strong>
                </div>
                <div className="flex justify-between gap-3 border-b border-teal-50 pb-3 text-slate-500">
                  <span>Phí nền tảng</span>
                  <strong className="text-[#12312f]">{money(booking.platformFee)}</strong>
                </div>
                <div className="flex justify-between gap-3 text-2xl font-black">
                  <span>Tổng</span>
                  <span>{money(booking.totalAmount)}</span>
                </div>
              </div>

              {booking.status !== "paid" ? (
                <Button className="mt-5 w-full" onClick={pay}>Thanh toán ngay</Button>
              ) : (
                <div className="mt-5 rounded-[18px] border border-emerald-100 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
                  Đơn đã được thanh toán.
                </div>
              )}
              {submitError ? <p className="mt-3 text-sm text-rose-600">{submitError}</p> : null}
            </Card>

            <Card className="rounded-[32px] border-teal-100 bg-white/95 p-6 shadow-xl shadow-teal-900/10">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black">Hoạt động realtime</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">Cập nhật mới nhất từ ca chăm sóc.</p>
                </div>
                <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-black text-sky-700">Live</span>
              </div>

              <div className="mt-5 grid gap-3 text-sm">
                <div className="flex gap-3">
                  <div className="grid h-8 w-8 place-items-center rounded-full bg-emerald-50 font-black text-emerald-600">✓</div>
                  <div>
                    <strong className="block text-slate-900">Đơn đã được tạo</strong>
                    <p className="text-slate-500">Mã đơn {booking._id} đã được ghi nhận.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="grid h-8 w-8 place-items-center rounded-full bg-emerald-50 font-black text-emerald-600">✓</div>
                  <div>
                    <strong className="block text-slate-900">Người đồng hành đã xác nhận</strong>
                    <p className="text-slate-500">Đang chuẩn bị di chuyển tới điểm đón.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 font-black text-slate-400">•</div>
                  <div>
                    <strong className="block text-slate-900">Đang di chuyển</strong>
                    <p className="text-slate-500">GPS đang cập nhật theo thời gian thực.</p>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="rounded-[32px] border-teal-100 bg-white/95 p-6 shadow-xl shadow-teal-900/10">
              <h2 className="text-2xl font-black">Hành động nhanh</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">Liên hệ khi cần hỗ trợ.</p>
              <div className="mt-4 grid gap-3">
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => setShowCompanionPhone((current) => !current)}
                >
                  {showCompanionPhone
                    ? booking.companionId?.phone || "Chưa cập nhật số điện thoại"
                    : "Gọi người đồng hành"}
                </Button>
                <Button variant="secondary">Nhắn tin</Button>
                <Button
                  className="bg-[#12312f] text-white hover:bg-[#0b1f1d]"
                  type="button"
                  onClick={() => setShowHotline((current) => !current)}
                >
                  {showHotline ? "1900 6868" : "Gọi tổng đài CareGo"}
                </Button>
              </div>
            </Card>
          </aside>
        </main>
      </div>
      {previewPhoto ? (
        <div
          className="fixed inset-0 z-[100] grid place-items-center bg-transparent p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setPreviewPhoto(null)}
        >
          <img
            src={previewPhoto.url}
            alt={previewPhoto.label}
            className="max-h-[92vh] max-w-[94vw] rounded-2xl object-contain shadow-2xl shadow-slate-950/50"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      ) : null}
    </div>
  );
};

export default CustomerBookingDetailPage;
