import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router";
import { api } from "../../api/client.js";
import { Button, Card, Input, StatusBadge, Textarea } from "../../components/Ui.jsx";
import LiveLocationMap from "../../components/LiveLocationMap.jsx";
import { useAsync } from "../../hooks/useAsync.js";
import { connectLocationSocket, locationSocket } from "../../socket/locationSocket.js";
import { dateTime, money } from "../../utils/format.js";

const MAX_LIVE_LOCATION_POINTS = 100;

const appendLiveLocation = (locations, location) =>
  [...locations, location].slice(-MAX_LIVE_LOCATION_POINTS);

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

const OVERDUE_PAYMENT_PENALTY_AMOUNT = 50000;
const waitingPaymentStatuses = ["pending", "accepted", "in_progress"];
const BOOKING_CHAT_AFTER_COMPLETION_MS = 3 * 60 * 60 * 1000;
const HOTLINE_PHONE_LABEL = "033 610 8492";
const HOTLINE_PHONE_HREF = "tel:0336108492";

const toTelHref = (phone) => {
  const normalizedPhone = String(phone || "").replace(/[^\d+]/g, "");
  return normalizedPhone ? `tel:${normalizedPhone}` : "";
};

const BOOKING_STATUS_CONTENT = {
  pending: {
    text: "Chờ xác nhận",
    heroDescription: "Đơn đã được tạo và đang chờ người đồng hành xác nhận. Bạn có thể theo dõi trạng thái, nhắn tin nếu là đặt ngay hoặc hủy trước khi đơn được nhận.",
    progressLabel: "Đang chờ phản hồi",
    steps: [
      { label: "Đặt lịch", state: "done" },
      { label: "Chờ xác nhận", state: "active" },
      { label: "Di chuyển", state: "waiting" },
      { label: "Hoàn thành", state: "waiting" },
    ],
    timeline: [
      { title: "Đơn đã được tạo", description: "Mã đơn đã được ghi nhận trên CareGo.", state: "done" },
      { title: "Đang chờ người đồng hành xác nhận", description: "Bạn sẽ thấy thông tin liên hệ và GPS sau khi đơn được nhận.", state: "active" },
      { title: "Chưa bắt đầu di chuyển", description: "GPS realtime sẽ mở khi ca chăm sóc sẵn sàng.", state: "waiting" },
    ],
  },
  accepted: {
    text: "Đã xác nhận",
    heroDescription: "Người đồng hành đã nhận đơn. Bạn có thể theo dõi thông tin liên hệ, chat và GPS khi ca chăm sóc bắt đầu.",
    progressLabel: "Đã có người nhận",
    steps: [
      { label: "Đặt lịch", state: "done" },
      { label: "Xác nhận", state: "done" },
      { label: "Chuẩn bị", state: "active" },
      { label: "Hoàn thành", state: "waiting" },
    ],
    timeline: [
      { title: "Đơn đã được tạo", description: "Mã đơn đã được ghi nhận trên CareGo.", state: "done" },
      { title: "Người đồng hành đã xác nhận", description: "Bạn có thể liên hệ hoặc nhắn tin để trao đổi thêm.", state: "done" },
      { title: "Chuẩn bị di chuyển", description: "GPS sẽ cập nhật khi người đồng hành bắt đầu gửi vị trí.", state: "active" },
    ],
  },
  in_progress: {
    text: "Đang diễn ra",
    heroDescription: "Ca chăm sóc đang diễn ra. Bạn có thể theo dõi GPS realtime, checklist và nhật ký ca làm.",
    progressLabel: "Đang chăm sóc",
    steps: [
      { label: "Đặt lịch", state: "done" },
      { label: "Xác nhận", state: "done" },
      { label: "Đang chăm sóc", state: "active" },
      { label: "Hoàn thành", state: "waiting" },
    ],
    timeline: [
      { title: "Đơn đã được tạo", description: "Mã đơn đã được ghi nhận trên CareGo.", state: "done" },
      { title: "Người đồng hành đã xác nhận", description: "Ca chăm sóc đã được nhận.", state: "done" },
      { title: "Ca chăm sóc đang diễn ra", description: "GPS và checklist được cập nhật theo thời gian thực.", state: "active" },
    ],
  },
  completed: {
    text: "Hoàn thành",
    heroDescription: "Ca chăm sóc đã hoàn thành. Bạn có thể xem nhật ký, ảnh check-out và thanh toán dịch vụ.",
    progressLabel: "Chờ thanh toán",
    steps: [
      { label: "Đặt lịch", state: "done" },
      { label: "Xác nhận", state: "done" },
      { label: "Chăm sóc", state: "done" },
      { label: "Thanh toán", state: "active" },
    ],
    timeline: [
      { title: "Đơn đã được tạo", description: "Mã đơn đã được ghi nhận trên CareGo.", state: "done" },
      { title: "Ca chăm sóc đã hoàn thành", description: "Bạn có thể xem lại nhật ký và ảnh ca làm.", state: "done" },
      { title: "Chờ thanh toán", description: "Thanh toán để hoàn tất đơn và mở phần đánh giá.", state: "active" },
    ],
  },
  paid: {
    text: "Đã thanh toán",
    heroDescription: "Đơn đã hoàn tất và được thanh toán. Bạn có thể xem lại nhật ký hoặc gửi đánh giá cho người đồng hành.",
    progressLabel: "Đã hoàn tất",
    steps: [
      { label: "Đặt lịch", state: "done" },
      { label: "Xác nhận", state: "done" },
      { label: "Hoàn thành", state: "done" },
      { label: "Đã thanh toán", state: "done" },
    ],
    timeline: [
      { title: "Đơn đã được tạo", description: "Mã đơn đã được ghi nhận trên CareGo.", state: "done" },
      { title: "Ca chăm sóc đã hoàn thành", description: "Nhật ký ca làm đã được cập nhật.", state: "done" },
      { title: "Đơn đã thanh toán", description: "Bạn có thể đánh giá trải nghiệm chăm sóc.", state: "done" },
    ],
  },
  cancelled: {
    text: "Đã hủy",
    heroDescription: "Đơn đã bị hủy. GPS, liên hệ người đồng hành và thanh toán không còn khả dụng cho booking này.",
    progressLabel: "Đơn đã hủy",
    steps: [
      { label: "Đặt lịch", state: "done" },
      { label: "Đã hủy", state: "cancelled" },
    ],
    timeline: [
      { title: "Đơn đã được tạo", description: "Mã đơn đã được ghi nhận trên CareGo.", state: "done" },
      { title: "Đơn đã hủy", description: "Bạn có thể tạo booking mới nếu vẫn cần hỗ trợ.", state: "cancelled" },
    ],
  },
};

const progressStepClassName = (state) => {
  const styles = {
    done: "border-teal-600 bg-teal-700 text-white",
    active: "border-sky-300 bg-sky-50 text-sky-700",
    waiting: "border-teal-100 bg-[#f7fffe] text-slate-400",
    cancelled: "border-rose-300 bg-rose-50 text-rose-700",
  };
  return styles[state] || styles.waiting;
};

const timelineIconClassName = (state) => {
  const styles = {
    done: "bg-emerald-50 text-emerald-600",
    active: "bg-sky-50 text-sky-600",
    waiting: "bg-slate-100 text-slate-400",
    cancelled: "bg-rose-50 text-rose-600",
  };
  return styles[state] || styles.waiting;
};

const timelineIcon = (state) => {
  if (state === "done") return "✓";
  if (state === "cancelled") return "!";
  return "•";
};

const getRemainingMinutes = (value, now) => {
  if (!value) return 0;
  return Math.max(0, Math.ceil((new Date(value).getTime() - now.getTime()) / 60000));
};

const CustomerBookingDetailPage = () => {
  const { id } = useParams();
  const location = useLocation();
  const { data, setData, loading, error, reload } = useAsync(() => api.get(`/bookings/${id}?as=customer`), [id]);
  const [review, setReview] = useState({ rating: 5, comment: "" });
  const [submitError, setSubmitError] = useState("");
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [liveLocations, setLiveLocations] = useState([]);
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState("");

  const booking = data?.booking;
  const companionContact = data?.companionContact;
  const payosStatus = useMemo(() => {
    const searchParams = new URLSearchParams(location.search);
    return searchParams.get("payosStatus") || "";
  }, [location.search]);
  const payosOrderCode = useMemo(() => {
    const searchParams = new URLSearchParams(location.search);
    return searchParams.get("orderCode") || "";
  }, [location.search]);
  const isPayOSReturn = payosStatus === "return";
  const isPayOSCancel = payosStatus === "cancel";
  const shiftLog = data?.shiftLog;
  const serviceLocation = booking?.addressLocation?.lat ? booking.addressLocation : null;
  const allLocations = useMemo(
    () => [...(shiftLog?.locations || []), ...liveLocations].slice(-MAX_LIVE_LOCATION_POINTS),
    [shiftLog?.locations, liveLocations],
  );
  const latestLocation = allLocations[allLocations.length - 1];
  const statusContent = BOOKING_STATUS_CONTENT[booking?.status] || {
    text: "Đang cập nhật",
    heroDescription: "CareGo đang cập nhật trạng thái mới nhất của đơn chăm sóc.",
    progressLabel: "Đang cập nhật",
    steps: [
      { label: "Đặt lịch", state: "done" },
      { label: "Cập nhật", state: "active" },
    ],
    timeline: [
      { title: "Đang cập nhật trạng thái", description: "Vui lòng tải lại trang sau ít phút nếu trạng thái chưa thay đổi.", state: "active" },
    ],
  };
  const statusText = statusContent.text;
  const statusSteps = statusContent.steps;
  const highlightedStepCount = statusSteps.filter((step) => ["done", "active", "cancelled"].includes(step.state)).length;
  const progressPercent = statusSteps.length ? (highlightedStepCount / statusSteps.length) * 100 : 0;
  const companionPhoneHref = toTelHref(companionContact?.phone);
  const paymentDueAt = booking?.paymentDueAt ? new Date(booking.paymentDueAt) : null;
  const hasValidPaymentDueAt = paymentDueAt && !Number.isNaN(paymentDueAt.getTime());
  const isPaymentOverdue = Boolean(booking?.status === "completed" && hasValidPaymentDueAt && paymentDueAt < currentTime);
  const penaltyAmount = isPaymentOverdue ? OVERDUE_PAYMENT_PENALTY_AMOUNT : 0;
  const payableAmount = Number(booking?.totalAmount || 0) + penaltyAmount;
  const canPay = booking?.status === "completed";
  const canReview = booking?.status === "paid";
  const canCancel = ["pending", "accepted"].includes(booking?.status);
  const instantOfferActive = Boolean(
    booking?.bookingMode === "instant" &&
    booking?.status === "pending" &&
    booking?.offerExpiresAt &&
    new Date(booking.offerExpiresAt) > currentTime,
  );
  const completedChatActive = Boolean(
    ["completed", "paid"].includes(booking?.status) &&
    booking?.completedAt &&
    new Date(booking.completedAt).getTime() + BOOKING_CHAT_AFTER_COMPLETION_MS > currentTime.getTime(),
  );
  const canOpenBookingChat = instantOfferActive || ["accepted", "in_progress"].includes(booking?.status) || completedChatActive;
  const instantOfferRemainingMinutes = getRemainingMinutes(booking?.offerExpiresAt, currentTime);
  const isWaitingForPayment = waitingPaymentStatuses.includes(booking?.status);
  const paymentBadge = booking?.status === "paid"
    ? { label: "Đã thanh toán", className: "bg-emerald-50 text-emerald-700" }
    : isPaymentOverdue
      ? { label: "Quá hạn", className: "bg-rose-50 text-rose-700" }
      : canPay
        ? { label: "Sẵn sàng", className: "bg-teal-50 text-teal-700" }
        : { label: "Chưa đến hạn", className: "bg-orange-50 text-orange-700" };

  useEffect(() => {
    connectLocationSocket();
    locationSocket.emit("booking:join", { bookingId: id });

    const handleLocation = (location) => {
      if (location.bookingId === id) {
        setLiveLocations((current) => appendLiveLocation(current, location));
      }
    };
    const handleBookingChatState = (state) => {
      if (String(state?.bookingId) === String(id)) {
        reload();
      }
    };

    locationSocket.on("location:update", handleLocation);
    locationSocket.on("booking-chat:state", handleBookingChatState);

    return () => {
      locationSocket.emit("booking:leave", { bookingId: id });
      locationSocket.off("location:update", handleLocation);
      locationSocket.off("booking-chat:state", handleBookingChatState);
    };
  }, [id, reload]);

  useEffect(() => {
    if (booking?.status !== "completed" && !(booking?.bookingMode === "instant" && booking?.status === "pending")) {
      return undefined;
    }

    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => {
      clearInterval(timer);
    };
  }, [booking?.bookingMode, booking?.status]);

  useEffect(() => {
    if (!isPayOSReturn && !isPayOSCancel) return undefined;

    let active = true;
    const refreshBooking = async () => {
      try {
        if ((isPayOSReturn || isPayOSCancel) && payosOrderCode) {
          await api.post("/payments/payos/sync", { bookingId: id, orderCode: payosOrderCode });
        }
        const nextData = await api.get(`/bookings/${id}?as=customer`);
        if (active) {
          setData(nextData);
        }
      } catch (err) {
        if (active) {
          setSubmitError(err.message);
        }
      }
    };

    const startRefresh = async () => {
      if (!active) return;
      setPaymentLoading(false);
      setSubmitError("");
      setCurrentTime(new Date());
      await refreshBooking();
    };

    Promise.resolve().then(startRefresh);

    if (!isPayOSReturn) {
      return () => {
        active = false;
      };
    }

    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      refreshBooking();
      if (attempts >= 5) {
        clearInterval(timer);
      }
    }, 2500);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [id, isPayOSReturn, isPayOSCancel, payosOrderCode, setData]);

  const pay = async () => {
    setSubmitError("");
    setPaymentLoading(true);
    try {
      const paymentData = await api.post(`/bookings/${id}/pay`, { method: "payos" });
      if (!paymentData.checkoutUrl) {
        throw new Error("Không nhận được liên kết thanh toán PayOS.");
      }
      window.location.href = paymentData.checkoutUrl;
    } catch (err) {
      setSubmitError(err.message);
      setPaymentLoading(false);
    }
  };

  const submitReview = async (event) => {
    event.preventDefault();
    setSubmitError("");
    if (!canReview) {
      setSubmitError("Bạn chỉ có thể đánh giá sau khi lịch chăm sóc đã được thanh toán.");
      return;
    }

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

  const cancelBooking = async () => {
    if (!canCancel || cancelLoading) return;

    setCancelError("");
    setCancelLoading(true);
    try {
      await api.patch(`/bookings/${id}/cancel`, {});
      setShowCancelDialog(false);
      await reload();
    } catch (err) {
      setCancelError(err.message);
    } finally {
      setCancelLoading(false);
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
              {statusContent.heroDescription}
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
                  <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-black text-sky-700">{statusContent.progressLabel}</span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-teal-50">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-teal-600 to-emerald-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-4">
                  {statusSteps.map((step) => (
                    <div
                      key={step.label}
                      className={`rounded-[14px] border px-3 py-2 text-center text-xs font-black ${progressStepClassName(step.state)}`}
                    >
                      {step.label}
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            <Card className="rounded-[32px] border-teal-100 bg-white/95 p-6 shadow-xl shadow-teal-900/10">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black">GPS Người Đồng Hành</h2>
                  {/* <p className="mt-2 text-sm leading-6 text-slate-500">
                    {latestLocation
                      ? `Vị trí mới nhất: ${Number(latestLocation.lat).toFixed(6)}, ${Number(latestLocation.lng).toFixed(6)}`
                      : "Chưa có vị trí."}
                  </p> */}
                </div>
                <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-black text-sky-700">Live</span>
              </div>
              <div className="mt-4">
                <LiveLocationMap location={latestLocation || serviceLocation} locations={allLocations} markerVariant="person" />
              </div>
              {/* <div className="mt-4 max-h-64 space-y-2 overflow-auto text-sm">
                {allLocations.length ? allLocations.map((location) => (
                  <div key={`${location.lat}-${location.lng}-${location.recordedAt}`} className="rounded-md bg-slate-50 p-3">
                    {location.lat}, {location.lng} - {dateTime(location.recordedAt)}
                  </div>
                )) : <p className="text-slate-500">Chưa có vị trí.</p>}
              </div> */}
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
              ) : canReview ? (
                <form className="mt-4 grid gap-4" onSubmit={submitReview}>
                  <Input label="Số sao" type="number" min="1" max="5" value={review.rating} onChange={(e) => setReview({ ...review, rating: e.target.value })} />
                  <Textarea label="Nhận xét" value={review.comment} onChange={(e) => setReview({ ...review, comment: e.target.value })} />
                  <Button className="w-fit">Gửi đánh giá</Button>
                </form>
              ) : (
                <p className="mt-3 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm font-semibold text-amber-700">
                  Bạn có thể đánh giá sau khi booking đã được thanh toán.
                </p>
              )}
            </Card>
          </section>

          <aside className="grid gap-6 xl:sticky xl:top-24">
            <Card className="rounded-[32px] border-teal-100 bg-white/95 p-6 shadow-xl shadow-teal-900/10">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black">Thanh toán</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">Thanh toán sau khi companion hoàn thành ca chăm sóc.</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-black ${paymentBadge.className}`}>{paymentBadge.label}</span>
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
                {hasValidPaymentDueAt ? (
                  <div className="flex justify-between gap-3 border-b border-teal-50 pb-3 text-slate-500">
                    <span>Hạn thanh toán</span>
                    <strong className="text-[#12312f]">{dateTime(paymentDueAt)}</strong>
                  </div>
                ) : null}
                {penaltyAmount > 0 ? (
                  <div className="flex justify-between gap-3 border-b border-rose-100 pb-3 text-rose-600">
                    <span>Phí quá hạn</span>
                    <strong>{money(penaltyAmount)}</strong>
                  </div>
                ) : null}
                <div className="flex justify-between gap-3 text-2xl font-black">
                  <span>Tổng</span>
                  <span>{money(payableAmount)}</span>
                </div>
              </div>

              {isPayOSReturn ? (
                <div className={`mt-5 rounded-[18px] border p-3 text-sm font-semibold ${booking.status === "paid"
                  ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                  : "border-sky-100 bg-sky-50 text-sky-700"
                  }`}>
                  {booking.status === "paid"
                    ? "PayOS đã xác nhận thanh toán thành công."
                    : "Đã quay lại từ PayOS. Hệ thống đang xác minh trạng thái thanh toán."}
                </div>
              ) : null}
              {isPayOSCancel ? (
                <div className="mt-5 rounded-[18px] border border-amber-100 bg-amber-50 p-3 text-sm font-semibold text-amber-700">
                  Bạn đã hủy thanh toán PayOS. Booking vẫn chưa được ghi nhận là đã thanh toán.
                </div>
              ) : null}
              {isWaitingForPayment ? (
                <div className="mt-5 rounded-[18px] border border-orange-100 bg-orange-50 p-3 text-sm font-semibold text-orange-700">
                  Nút thanh toán sẽ hiện sau khi ca chăm sóc hoàn thành.
                </div>
              ) : null}
              {canPay ? (
                <Button className="mt-5 w-full" onClick={pay} disabled={paymentLoading}>
                  {paymentLoading ? "Đang tạo link..." : `Thanh toán ${money(payableAmount)}`}
                </Button>
              ) : null}
              {booking.status === "paid" ? (
                <div className="mt-5 rounded-[18px] border border-emerald-100 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
                  Đơn đã được thanh toán.
                </div>
              ) : null}
              {booking.status === "cancelled" ? (
                <div className="mt-5 rounded-[18px] border border-slate-100 bg-slate-50 p-3 text-sm font-semibold text-slate-600">
                  Đơn đã hủy nên không cần thanh toán.
                </div>
              ) : null}
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
                {statusContent.timeline.map((item) => (
                  <div key={item.title} className="flex gap-3">
                    <div className={`grid h-8 w-8 place-items-center rounded-full font-black ${timelineIconClassName(item.state)}`}>
                      {timelineIcon(item.state)}
                    </div>
                    <div>
                      <strong className="block text-slate-900">{item.title}</strong>
                      <p className="text-slate-500">
                        {item.description.replace("Mã đơn", `Mã đơn ${booking._id}`)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="rounded-[32px] border-teal-100 bg-white/95 p-6 shadow-xl shadow-teal-900/10">
              <h2 className="text-2xl font-black">Hành động nhanh</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">Liên hệ khi cần hỗ trợ.</p>
              {instantOfferActive ? (
                <div className="mt-4 rounded-[18px] border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-700">
                  Yêu cầu đặt ngay đang chờ phản hồi, còn khoảng {instantOfferRemainingMinutes} phút. Bạn có thể trao đổi qua box chat.
                </div>
              ) : null}
              {booking.bookingMode === "instant" && booking.status === "pending" && !instantOfferActive ? (
                <div className="mt-4 rounded-[18px] border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-600">
                  Yêu cầu đặt ngay đã hết thời gian phản hồi. Bạn có thể hủy đơn và chọn người đồng hành khác.
                </div>
              ) : null}
              <div className="mt-4 grid gap-3">
                {canCancel ? (
                  <Button
                    variant="danger"
                    type="button"
                    onClick={() => {
                      setCancelError("");
                      setShowCancelDialog(true);
                    }}
                  >
                    Hủy booking
                  </Button>
                ) : null}
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => {
                    if (companionPhoneHref) window.location.href = companionPhoneHref;
                  }}
                  disabled={!companionPhoneHref}
                >
                  {companionContact?.phone
                    ? `Gọi người đồng hành (${companionContact.phone})`
                    : "Số điện thoại mở sau khi nhận lịch"}
                </Button>
                <Button
                  variant="secondary"
                  type="button"
                  disabled={!companionContact?.email}
                  onClick={() => {
                    if (companionContact?.email) window.location.href = `mailto:${companionContact.email}`;
                  }}
                >
                  {companionContact?.email || "Email mở sau khi nhận lịch"}
                </Button>
                <Button
                  variant="secondary"
                  type="button"
                  disabled={!canOpenBookingChat}
                  onClick={() =>
                    window.dispatchEvent(
                      new CustomEvent("carego:open-booking-chat", {
                        detail: { bookingId: booking._id },
                      }),
                    )
                  }
                >
                  {canOpenBookingChat ? "Nhắn tin qua CareGo" : "Box chat chưa khả dụng"}
                </Button>
                <Button
                  className="bg-[#12312f] text-white hover:bg-[#0b1f1d]"
                  type="button"
                  onClick={() => {
                    window.location.href = HOTLINE_PHONE_HREF;
                  }}
                >
                  Gọi tổng đài CareGo ({HOTLINE_PHONE_LABEL})
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
      {showCancelDialog ? (
        <div
          className="fixed inset-0 z-[110] grid place-items-center bg-slate-950/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-booking-title"
          onClick={() => {
            if (!cancelLoading) setShowCancelDialog(false);
          }}
        >
          <div
            className="w-full max-w-md rounded-[28px] border border-rose-100 bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-rose-50 text-xl font-black text-rose-600">
              !
            </div>
            <h2 id="cancel-booking-title" className="mt-4 text-2xl font-black text-slate-950">
              Xác nhận hủy booking?
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Booking {booking.serviceId?.name || "chăm sóc"} vào {dateTime(booking.startTime)} sẽ được hủy và không thể khôi phục.
            </p>
            {booking.status === "accepted" ? (
              <p className="mt-3 rounded-2xl border border-amber-100 bg-amber-50 p-3 text-sm font-semibold text-amber-700">
                Người đồng hành đã nhận lịch. Vui lòng chỉ hủy khi thực sự cần thiết.
              </p>
            ) : null}
            {cancelError ? (
              <p className="mt-3 rounded-2xl border border-rose-100 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
                {cancelError}
              </p>
            ) : null}
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Button
                variant="secondary"
                type="button"
                disabled={cancelLoading}
                onClick={() => setShowCancelDialog(false)}
              >
                Giữ booking
              </Button>
              <Button
                variant="danger"
                type="button"
                disabled={cancelLoading || !canCancel}
                onClick={cancelBooking}
              >
                {cancelLoading ? "Đang hủy..." : "Xác nhận hủy"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default CustomerBookingDetailPage;
