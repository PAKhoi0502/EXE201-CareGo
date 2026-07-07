import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { api } from "../../api/client.js";
import AddressSearchMap from "../../components/AddressSearchMap.jsx";
import { Button, Select, Textarea } from "../../components/Ui.jsx";
import { useAuth } from "../../context/useAuth.js";
import { useAsync } from "../../hooks/useAsync.js";
import { money } from "../../utils/format.js";
import { getCompanionApplicantType } from "../../utils/companionApplication.js";

const ServiceIcon = ({ serviceName = "", index = 0 }) => {
  const normalizedName = serviceName.toLowerCase();
  const type = normalizedName.includes("hospital") || normalizedName.includes("khám")
    ? "hospital"
    : normalizedName.includes("home") || normalizedName.includes("nhà")
      ? "home"
      : normalizedName.includes("walk") || normalizedName.includes("dạo")
        ? "walk"
        : ["hospital", "home", "walk", "care"][index % 4];

  const paths = {
    hospital: (
      <>
        <path d="M5 21V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v14" />
        <path d="M3 21h18M9 21v-5h6v5M10 10h4M12 8v4" />
      </>
    ),
    home: (
      <>
        <path d="m3 11 9-7 9 7" />
        <path d="M5 10v10h14V10M9 20v-6h6v6" />
        <path d="M15.5 8.5c-1.5-1.4-4.5-.3-3.5 2.2 1-2.5-2-3.6-3.5-2.2C6.6 10.4 9 13 12 15c3-2 5.4-4.6 3.5-6.5Z" />
      </>
    ),
    walk: (
      <>
        <circle cx="12" cy="4" r="2" />
        <path d="m10 8-2 5 4 2 1 6M12 15l4-3 3 3M8 13l-3 8M13 8l3 2" />
      </>
    ),
    care: (
      <>
        <path d="M20.8 5.7a5.5 5.5 0 0 0-7.8 0L12 6.8l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 22l8.8-8.5a5.5 5.5 0 0 0 0-7.8Z" />
        <path d="M8 13h2l1-3 2 6 1-3h2" />
      </>
    ),
  };

  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {paths[type]}
      </g>
    </svg>
  );
};

const initials = (name = "CG") =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

const StatusPill = ({ children, tone = "green" }) => {
  const tones = {
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    blue: "bg-sky-50 text-sky-700 border-sky-200",
    orange: "bg-orange-50 text-orange-700 border-orange-200",
  };

  return <span className={`rounded-full border px-3 py-1.5 text-xs font-black ${tones[tone]}`}>{children}</span>;
};

const getCompanionUserId = (companion) => companion?.userId?._id || companion?.userId || "";

const bookingStartHour = 7;
const bookingEndHour = 19;
const bookingLookaheadDays = 7;
const maxBookingDurationHours = 6;

const pad2 = (value) => String(value).padStart(2, "0");

const toDateKey = (date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const buildStartTimeValue = (dateKey, hour) => `${dateKey}T${pad2(hour)}:00`;

const getStartHourFromValue = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.getHours();
};

const buildInstantStartTimeValue = () => {
  const start = new Date(Date.now() + 15 * 60 * 1000);
  start.setSeconds(0, 0);
  start.setMinutes(Math.ceil(start.getMinutes() / 5) * 5);
  return start.toISOString();
};

const formatTimeValue = (value) =>
  value
    ? new Intl.DateTimeFormat("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
      }).format(new Date(value))
    : "";

const formatHourMinute = (value) =>
  value
    ? new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" }).format(new Date(value))
    : "";

const getMaxDurationForStart = (value) => {
  const start = new Date(value);
  if (Number.isNaN(start.getTime())) return 0;
  const serviceEnd = new Date(start);
  serviceEnd.setHours(bookingEndHour, 0, 0, 0);
  return Math.max(0, Math.floor((serviceEnd.getTime() - start.getTime()) / (60 * 60 * 1000)));
};

const getDurationChoices = () => Array.from({ length: maxBookingDurationHours }, (_, index) => index + 1);

const getSlotEndHour = (hour, durationHours) => hour + Number(durationHours || 0);

const canFitDurationFromHour = (hour, durationHours) =>
  Number(durationHours) > 0 && getSlotEndHour(hour, durationHours) <= bookingEndHour;

const getDateOptions = () =>
  Array.from({ length: bookingLookaheadDays }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index);
    return {
      value: toDateKey(date),
      day: pad2(date.getDate()),
      month: pad2(date.getMonth() + 1),
      weekday: new Intl.DateTimeFormat("vi-VN", { weekday: "short" }).format(date),
    };
  });

const NewBookingPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: elderData, loading: elderLoading } = useAsync(() => api.get("/elders/my"), []);
  const { data: serviceData, loading: serviceLoading } = useAsync(() => api.get("/services"), []);
  const [onlineStatuses, setOnlineStatuses] = useState({});
  const [onlineLoading, setOnlineLoading] = useState(false);
  const [detailCompanion, setDetailCompanion] = useState(null);
  const [detailReviews, setDetailReviews] = useState([]);
  const [detailReviewsLoading, setDetailReviewsLoading] = useState(false);
  const [detailReviewsError, setDetailReviewsError] = useState("");
  const [form, setForm] = useState({
    elderProfileId: "",
    serviceId: "",
    companionId: "",
    startTime: "",
    durationHours: 2,
    address: "",
    addressLocation: null,
    note: "",
    bookingMode: "scheduled",
  });
  const [selectedDateKey, setSelectedDateKey] = useState(() => toDateKey(new Date()));
  const [error, setError] = useState("");
  const companionAvailabilityQuery = useMemo(() => {
    if (!form.startTime || !form.durationHours) return "";
    const params = new URLSearchParams({
      startTime: form.startTime,
      durationHours: String(Number(form.durationHours)),
      bookingMode: form.bookingMode,
    });
    return `?${params.toString()}`;
  }, [form.bookingMode, form.durationHours, form.startTime]);
  const {
    data: companionData,
    loading: companionLoading,
    error: companionError,
  } = useAsync(
    () => (companionAvailabilityQuery ? api.get(`/companions${companionAvailabilityQuery}`) : Promise.resolve({ companions: [] })),
    [companionAvailabilityQuery],
  );

  const elders = useMemo(() => elderData?.elders || [], [elderData?.elders]);
  const services = useMemo(() => serviceData?.services || [], [serviceData?.services]);
  const companions = useMemo(() => companionData?.companions || [], [companionData?.companions]);
  const currentUserId = user?.id || user?._id;
  const selectableCompanions = useMemo(
    () => {
      if (!companionAvailabilityQuery) return [];
      return companions
        .filter((item) => getCompanionUserId(item) !== currentUserId)
        .filter((item) => form.bookingMode !== "instant" || onlineStatuses[getCompanionUserId(item)]?.isOnline)
        .sort((first, second) => {
          const firstOnline = onlineStatuses[getCompanionUserId(first)]?.isOnline ? 1 : 0;
          const secondOnline = onlineStatuses[getCompanionUserId(second)]?.isOnline ? 1 : 0;
          return secondOnline - firstOnline;
        });
    },
    [companionAvailabilityQuery, companions, currentUserId, form.bookingMode, onlineStatuses],
  );
  const getCompanionOnlineStatus = (companion) => onlineStatuses[getCompanionUserId(companion)] || null;
  const selectedService = useMemo(() => services.find((item) => item._id === form.serviceId), [services, form.serviceId]);
  const selectedElder = useMemo(() => elders.find((item) => item._id === form.elderProfileId), [elders, form.elderProfileId]);
  const selectedCompanion = useMemo(
    () => companions.find((item) => getCompanionUserId(item) === form.companionId),
    [companions, form.companionId],
  );
  const total = (selectedService?.pricePerHour || 0) * Number(form.durationHours || 0);
  const detailCompanionOnlineStatus = detailCompanion ? getCompanionOnlineStatus(detailCompanion) : null;
  const detailApplicantType = getCompanionApplicantType(detailCompanion?.applicantType);
  const dateOptions = useMemo(() => getDateOptions(), []);
  const durationChoices = useMemo(() => getDurationChoices(), []);
  const selectedStartHour = getStartHourFromValue(form.startTime);
  const startHourOptions = useMemo(() => {
    const now = new Date();
    const selectedDuration = Number(form.durationHours || 0);
    return Array.from({ length: bookingEndHour - bookingStartHour }, (_, index) => {
      const hour = bookingStartHour + index;
      const endHour = getSlotEndHour(hour, selectedDuration);
      const value = buildStartTimeValue(selectedDateKey, hour);
      return {
        hour,
        endHour,
        value,
        label: `${pad2(hour)}:00 - ${pad2(endHour)}:00`,
        disabled: new Date(value) <= now,
      };
    }).filter((slot) => canFitDurationFromHour(slot.hour, selectedDuration));
  }, [form.durationHours, selectedDateKey]);
  const scheduledSlotGroups = useMemo(
    () =>
      [
        { key: "morning", label: "Buổi sáng 07:00 - 13:00", slots: startHourOptions.filter((slot) => slot.hour < 13) },
        { key: "afternoon", label: "Buổi chiều 13:00 - 19:00", slots: startHourOptions.filter((slot) => slot.hour >= 13) },
      ].filter((group) => group.slots.length > 0),
    [startHourOptions],
  );
  const maxDuration = form.startTime ? getMaxDurationForStart(form.startTime) : 0;
  const selectedEndHour = selectedStartHour === null ? null : selectedStartHour + Number(form.durationHours || 0);
  const instantEndTime = form.bookingMode === "instant" && form.startTime && form.durationHours
    ? new Date(new Date(form.startTime).getTime() + Number(form.durationHours) * 60 * 60 * 1000)
    : null;

  useEffect(() => {
    let active = true;

    const loadOnlineStatuses = async () => {
      setOnlineLoading(true);
      try {
        const data = await api.get("/companions/online-statuses");
        if (active) {
          setOnlineStatuses(data.onlineStatuses || {});
        }
      } catch {
        if (active) {
          setOnlineStatuses({});
        }
      } finally {
        if (active) {
          setOnlineLoading(false);
        }
      }
    };

    Promise.resolve().then(loadOnlineStatuses);
    const timer = setInterval(loadOnlineStatuses, 10000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!detailCompanion) return;
    const companionUserId = detailCompanion.userId?._id || detailCompanion.userId;
    if (!companionUserId) return;

    let active = true;
    const loadReviews = async () => {
      setDetailReviewsLoading(true);
      setDetailReviewsError("");
      try {
        const data = await api.get(`/companions/${companionUserId}/reviews`);
        if (active) {
          setDetailReviews(data.reviews || []);
        }
      } catch (err) {
        if (active) {
          setDetailReviews([]);
          setDetailReviewsError(err.message);
        }
      } finally {
        if (active) {
          setDetailReviewsLoading(false);
        }
      }
    };

    Promise.resolve().then(loadReviews);
    return () => {
      active = false;
    };
  }, [detailCompanion]);

  const chooseDate = (dateKey) => {
    setSelectedDateKey(dateKey);
    setForm((current) => ({
      ...current,
      startTime: "",
      companionId: "",
    }));
    setDetailCompanion(null);
  };

  const chooseBookingMode = (bookingMode) => {
    const instantStartTime = bookingMode === "instant" ? buildInstantStartTimeValue() : "";
    const instantMaxDuration = instantStartTime ? getMaxDurationForStart(instantStartTime) : 0;
    setForm((current) => ({
      ...current,
      bookingMode,
      startTime: instantStartTime,
      durationHours: bookingMode === "instant"
        ? instantMaxDuration > 0
          ? Math.min(Number(current.durationHours || 1), Math.min(maxBookingDurationHours, instantMaxDuration))
          : ""
        : current.durationHours || 2,
      companionId: "",
    }));
    setDetailCompanion(null);
    setError("");
  };

  const chooseStartTime = (value, hour) => {
    setForm((current) => ({
      ...current,
      startTime: value,
      durationHours: Math.max(1, Math.min(Number(current.durationHours || 1), bookingEndHour - hour)),
      companionId: "",
    }));
  };

  const chooseDuration = (durationHours) => {
    const nextDuration = Number(durationHours);
    setForm((current) => ({
      ...current,
      startTime: selectedStartHour !== null && !canFitDurationFromHour(selectedStartHour, nextDuration) ? "" : current.startTime,
      durationHours: nextDuration,
      companionId: "",
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (!form.addressLocation?.lat || !form.addressLocation?.lng) {
      setError("Vui lòng tìm địa chỉ trên bản đồ hoặc bấm vào bản đồ để ghim vị trí trước khi đặt lịch.");
      return;
    }
    if (form.bookingMode === "instant") {
      const leadMinutes = (new Date(form.startTime).getTime() - Date.now()) / 60000;
      if (leadMinutes < 5 || leadMinutes > 30) {
        setForm((current) => ({
          ...current,
          startTime: buildInstantStartTimeValue(),
          companionId: "",
        }));
        setError("Thời gian đặt ngay đã được cập nhật. Vui lòng chọn lại người đồng hành.");
        return;
      }
    }

    try {
      const data = await api.post("/bookings", {
        ...form,
        durationHours: Number(form.durationHours),
        addressLocation: form.addressLocation,
      });
      navigate(`/customer/bookings/${data.booking._id}`);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-7 text-[#12312f]">
      <section className="flex flex-col gap-6 py-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-4 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-700">
            Đặt lịch chăm sóc
          </div>
          <h1 className="max-w-3xl text-4xl font-black leading-tight md:text-5xl">
            Đặt lịch chăm sóc ba mẹ cùng <span className="text-teal-700">CareGo</span>
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-slate-500">
            Điền thông tin, chọn người đồng hành phù hợp. Sau khi xác nhận, bạn có thể theo dõi GPS realtime.
          </p>
        </div>

        {/* <div className="min-w-64 rounded-[24px] border border-teal-100 bg-white p-5 shadow-xl shadow-teal-900/10">
          <small className="block text-xs font-bold uppercase text-slate-400">Trạng thái hiện tại</small>
          <strong className="mt-2 block text-lg font-black text-teal-700">Đang tạo đơn</strong>
        </div> */}
      </section>

      <main className="grid items-start gap-6 xl:grid-cols-[1fr_370px]">
        <section className="grid gap-6">
          <div className="rounded-[32px] border border-teal-100 bg-white/95 p-6 shadow-xl shadow-teal-900/10">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-2xl font-black">Chọn dịch vụ</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">Chọn loại dịch vụ phù hợp với nhu cầu của người thân.</p>
              </div>
              <StatusPill>Bắt buộc</StatusPill>
            </div>

            {serviceLoading ? <p className="text-sm text-slate-500">Đang tải dịch vụ...</p> : null}
            <div className="grid gap-4 md:grid-cols-3">
              {services.map((service, index) => {
                const active = form.serviceId === service._id;
                return (
                  <button
                    key={service._id}
                    type="button"
                    onClick={() => setForm((current) => ({ ...current, serviceId: service._id }))}
                    className={`rounded-[24px] border bg-[#fbfffe] p-5 text-left transition hover:-translate-y-1 hover:border-teal-600 hover:bg-gradient-to-b hover:from-white hover:to-teal-50 hover:shadow-lg hover:shadow-teal-900/10 ${active ? "border-teal-700 bg-gradient-to-b from-white to-teal-50 shadow-lg shadow-teal-900/10" : "border-teal-50"
                      }`}
                  >
                    <div
                      className={`mb-4 grid h-14 w-14 place-items-center rounded-[20px] transition ${active
                          ? "bg-teal-700 text-white shadow-lg shadow-teal-700/20"
                          : "bg-gradient-to-br from-teal-100 to-sky-100 text-teal-700"
                        }`}
                    >
                      <ServiceIcon serviceName={service.name} index={index} />
                    </div>
                    <h3 className="text-lg font-black">{service.name}</h3>
                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-500">{service.description}</p>
                    <p className="mt-4 text-sm font-black text-teal-700">{money(service.pricePerHour)}/giờ</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-[32px] border border-teal-100 bg-white/95 p-6 shadow-xl shadow-teal-900/10">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-2xl font-black">Thông tin đặt lịch</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">Nhập thông tin người thân để CareGo đề xuất người đồng hành phù hợp.</p>
              </div>
              <StatusPill tone="blue">Biểu mẫu</StatusPill>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {!elderLoading && elderData && elders.length === 0 ? (
                <div className="rounded-[18px] border border-dashed border-teal-200 bg-teal-50/60 p-5 md:col-span-2">
                  <p className="font-black text-[#12312f]">Bạn chưa có hồ sơ người thân</p>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Tạo hồ sơ người thân trước để CareGo có đủ thông tin cho lần đặt lịch này.
                  </p>
                  <Button
                    type="button"
                    onClick={() => navigate("/customer/elders")}
                    className="mt-4 min-h-11 rounded-[16px]"
                  >
                    Tạo hồ sơ người thân
                  </Button>
                </div>
              ) : (
                <Select
                  label="Hồ sơ người thân"
                  value={form.elderProfileId}
                  onChange={(event) => setForm({ ...form, elderProfileId: event.target.value })}
                  required
                  className="rounded-[18px] border-teal-100 bg-[#fbfffe] px-4"
                >
                  <option value="">{elderLoading ? "Đang tải..." : "Chọn hồ sơ"}</option>
                  {elders.map((elder) => (
                    <option key={elder._id} value={elder._id}>
                      {elder.fullName} - {elder.age} tuổi
                    </option>
                  ))}
                </Select>
              )}
              <div className="grid gap-4 md:col-span-2">
                <div>
                  <span className="mb-2 block text-sm font-bold text-slate-700">Hình thức đặt lịch</span>
                  <div className="grid grid-cols-2 rounded-[18px] border border-teal-100 bg-teal-50/60 p-1">
                    <button
                      type="button"
                      onClick={() => chooseBookingMode("scheduled")}
                      className={`min-h-11 rounded-[14px] px-4 text-sm font-black transition ${
                        form.bookingMode === "scheduled" ? "bg-white text-teal-700 shadow-sm" : "text-slate-500"
                      }`}
                    >
                      Đặt theo lịch
                    </button>
                    <button
                      type="button"
                      onClick={() => chooseBookingMode("instant")}
                      className={`min-h-11 rounded-[14px] px-4 text-sm font-black transition ${
                        form.bookingMode === "instant" ? "bg-teal-700 text-white shadow-sm" : "text-slate-500"
                      }`}
                    >
                      Đặt ngay
                    </button>
                  </div>
                </div>
                <div>
                  <span className="mb-2 block text-sm font-bold text-slate-700">Thời lượng</span>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                    {durationChoices.map((duration) => {
                      const active = Number(form.durationHours) === duration;
                      const disabled = form.bookingMode === "instant" && (maxDuration === 0 || duration > maxDuration);
                      return (
                        <button
                          key={duration}
                          type="button"
                          disabled={disabled}
                          onClick={() => chooseDuration(duration)}
                          className={`min-h-11 rounded-[16px] border px-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-40 ${
                            active
                              ? "border-teal-700 bg-teal-700 text-white shadow-lg shadow-teal-900/15"
                              : "border-teal-100 bg-[#fbfffe] text-slate-700 hover:border-teal-500"
                          }`}
                        >
                          {duration} giờ
                        </button>
                      );
                    })}
                  </div>
                </div>
                {form.bookingMode === "scheduled" ? (
                  <>
                    <div>
                      <span className="mb-2 block text-sm font-bold text-slate-700">Chọn ngày trong 7 ngày tới</span>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                        {dateOptions.map((day) => {
                          const active = selectedDateKey === day.value;
                          return (
                            <button
                              key={day.value}
                              type="button"
                              onClick={() => chooseDate(day.value)}
                              className={`rounded-[18px] border px-3 py-3 text-left transition ${
                                active
                                  ? "border-teal-700 bg-teal-700 text-white shadow-lg shadow-teal-900/15"
                                  : "border-teal-100 bg-[#fbfffe] text-slate-700 hover:border-teal-500"
                              }`}
                            >
                              <span className="block text-xs font-bold uppercase opacity-75">{day.weekday}</span>
                              <span className="mt-1 block text-xl font-black">{day.day}</span>
                              <span className="block text-xs opacity-75">Tháng {day.month}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <span className="mb-2 block text-sm font-bold text-slate-700">Chọn khung giờ</span>
                      <div className="grid gap-3">
                        {scheduledSlotGroups.map((group) => (
                          <div key={group.key}>
                            <span className="mb-2 block text-xs font-black uppercase text-slate-400">{group.label}</span>
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                              {group.slots.map((slot) => {
                                const active = form.startTime === slot.value;
                                return (
                                  <button
                                    key={slot.value}
                                    type="button"
                                    disabled={slot.disabled}
                                    onClick={() => chooseStartTime(slot.value, slot.hour)}
                                    className={`rounded-[18px] border px-3 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-40 ${
                                      active
                                        ? "border-teal-700 bg-teal-700 text-white shadow-lg shadow-teal-900/15"
                                        : "border-teal-100 bg-[#fbfffe] text-slate-700 hover:border-teal-500"
                                    }`}
                                  >
                                    {slot.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="rounded-[18px] border border-emerald-200 bg-emerald-50 p-4">
                    <small className="block text-xs font-black uppercase text-emerald-700">Dự kiến bắt đầu</small>
                    <strong className="mt-1 block text-xl font-black text-[#12312f]">
                      {maxDuration > 0 ? formatTimeValue(form.startTime) : "Ngoài giờ phục vụ"}
                    </strong>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Chỉ người đồng hành đang online, đúng ca và không trùng lịch được hiển thị. Yêu cầu có hiệu lực trong 5 phút.
                    </p>
                  </div>
                )}
                <div className="rounded-[18px] border border-teal-50 bg-teal-50/60 p-4">
                  <small className="block text-xs font-bold uppercase text-slate-400">Khung giờ đã chọn</small>
                  <strong className="mt-1 block text-lg font-black text-teal-700">
                    {selectedStartHour === null || !form.durationHours
                      ? form.bookingMode === "instant" && maxDuration === 0
                        ? "Ngoài giờ phục vụ"
                        : "Chưa chọn giờ"
                      : form.bookingMode === "instant"
                        ? `${formatHourMinute(form.startTime)} - ${formatHourMinute(instantEndTime)}`
                        : `${pad2(selectedStartHour)}:00 - ${pad2(selectedEndHour)}:00`}
                  </strong>
                </div>
              </div>
              <div className="rounded-[18px] border border-teal-50 bg-teal-50/60 p-4">
                <small className="block text-xs font-bold uppercase text-slate-400">Tạm tính</small>
                <strong className="mt-1 block text-2xl font-black text-teal-700">{money(total)}</strong>
              </div>
            </div>

            <div className="mt-5">
              <AddressSearchMap
                address={form.address}
                location={form.addressLocation}
                onAddressChange={(address) => setForm((current) => ({ ...current, address }))}
                onLocationChange={(addressLocation) => setForm((current) => ({ ...current, addressLocation }))}
              />
            </div>

            <div className="mt-5">
              <Textarea
                label="Ghi chú sức khỏe / yêu cầu đặc biệt"
                value={form.note}
                onChange={(event) => setForm({ ...form, note: event.target.value })}
                placeholder="Ví dụ: đi chậm, cần hỗ trợ xếp hàng, lấy số khám và ghi chú lời dặn bác sĩ."
                className="rounded-[18px] border-teal-100 bg-[#fbfffe] px-4 py-3"
              />
            </div>
          </div>

          <div className="rounded-[32px] border border-teal-100 bg-white/95 p-6 shadow-xl shadow-teal-900/10">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-2xl font-black">Chọn người đồng hành</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {form.bookingMode === "instant"
                    ? "Chọn người đang online để gửi yêu cầu phản hồi trong 5 phút."
                    : "Sau khi chọn người đồng hành, nhấn xác nhận để tạo đơn."}
                </p>
              </div>
              <StatusPill>Gợi ý phù hợp</StatusPill>
            </div>

            {companionLoading ? <p className="text-sm text-slate-500">Đang tải người đồng hành...</p> : null}
            {companionError ? <p className="text-sm font-semibold text-rose-600">{companionError}</p> : null}
            {!companionLoading && onlineLoading ? (
              <p className="text-sm text-slate-500">Đang cập nhật trạng thái online...</p>
            ) : null}
            {!companionLoading && !onlineLoading && selectableCompanions.length === 0 ? (
              <p className="text-sm text-slate-500">
                {form.bookingMode === "instant"
                  ? maxDuration === 0
                    ? "Hiện đã ngoài thời gian có thể bắt đầu và hoàn thành ca trước 19:00."
                    : "Hiện chưa có người đồng hành online phù hợp để nhận ngay."
                  : form.startTime
                    ? "Hiện chưa có người đồng hành phù hợp trong khung giờ này."
                    : "Chọn ngày và giờ để hệ thống lọc người đồng hành phù hợp."}
              </p>
            ) : null}
            <div className="grid max-h-[36rem] gap-3 overflow-y-auto pr-1 md:grid-cols-2 2xl:grid-cols-3">
              {selectableCompanions.map((item) => {
                const companionUserId = getCompanionUserId(item);
                const onlineStatus = getCompanionOnlineStatus(item);
                const active = form.companionId === companionUserId;
                const ratingAverage = Number(item.ratingAverage || 0);
                const ratingCount = Number(item.ratingCount || 0);
                return (
                  <article
                    key={item._id}
                    className={`relative flex flex-col overflow-hidden rounded-[18px] border bg-[#fbfffe] transition ${active ? "border-teal-700 bg-teal-50/70 shadow-sm shadow-teal-900/10" : "border-teal-100"
                      }`}
                  >
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => setForm((current) => ({ ...current, companionId: companionUserId }))}
                      className="min-w-0 flex-1 p-4 text-left transition hover:bg-teal-50/70 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-teal-200"
                    >
                      <div className="flex items-center gap-3">
                        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[16px] bg-gradient-to-br from-teal-100 to-sky-100 text-sm font-black text-teal-700">
                          {initials(item.fullName)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="break-words text-base font-black leading-snug text-[#12312f]">{item.fullName}</h3>
                        </div>
                      </div>
                      <div className="mt-3 flex min-h-6 flex-wrap items-center gap-2">
                        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-600">
                          {ratingCount > 0 ? `${ratingAverage.toFixed(1)}/5` : "Chưa có đánh giá"}
                        </span>
                        {ratingCount > 0 ? (
                          <span className="text-xs font-semibold text-slate-500">{ratingCount} đánh giá</span>
                        ) : null}
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-black ${
                            onlineStatus?.isOnline ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {onlineStatus?.isOnline ? "Online" : "Offline"}
                        </span>
                      </div>
                    </button>
                    <div className={`flex items-center gap-2 border-t border-teal-100 px-3 py-2 ${active ? "justify-between" : "justify-end"}`}>
                      {active ? (
                        <span className="shrink-0 rounded-full bg-teal-700 px-3 py-1 text-xs font-black text-white">Đã chọn</span>
                      ) : null}
                      <Button
                        type="button"
                        variant="secondary"
                        className="min-h-9 shrink-0 rounded-full px-4 text-xs"
                        onClick={() => setDetailCompanion(item)}
                      >
                        Chi tiết
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <aside className="grid gap-5 xl:sticky xl:top-24">
          <div className="rounded-[32px] border border-teal-100 bg-white/95 p-6 shadow-xl shadow-teal-900/10">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black">Tóm tắt đơn</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">Thông tin đơn sẽ được tạo sau khi xác nhận.</p>
              </div>
              <StatusPill tone="orange">Nháp</StatusPill>
            </div>

            <div className="mb-5 rounded-[28px] bg-gradient-to-br from-teal-700 to-teal-500 p-5 text-white">
              <div className="mb-5 flex items-center gap-3">
                <div className="grid h-16 w-16 shrink-0 place-items-center rounded-[22px] bg-white text-xl font-black text-teal-700">
                  {initials(selectedElder?.fullName || "CG")}
                </div>
                <div>
                  <h3 className="text-xl font-black">{selectedElder?.fullName || "Chưa chọn người thân"}</h3>
                  <p className="text-sm text-white/75">{selectedService?.name || "Chưa chọn dịch vụ"}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-[17px] border border-white/20 bg-white/15 p-3">
                  <small className="block text-white/70">Dịch vụ</small>
                  <strong className="mt-1 block text-sm">{selectedService?.name || "Chưa chọn"}</strong>
                </div>
                <div className="rounded-[17px] border border-white/20 bg-white/15 p-3">
                  <small className="block text-white/70">Thời lượng</small>
                  <strong className="mt-1 block text-sm">{form.durationHours || 0} giờ</strong>
                </div>
                <div className="rounded-[17px] border border-white/20 bg-white/15 p-3">
                  <small className="block text-white/70">Đồng hành</small>
                  <strong className="mt-1 block truncate text-sm">{selectedCompanion?.fullName || "Chưa chọn"}</strong>
                </div>
                <div className="rounded-[17px] border border-white/20 bg-white/15 p-3">
                  <small className="block text-white/70">Dự kiến</small>
                  <strong className="mt-1 block text-sm">{money(total)}</strong>
                </div>
              </div>
            </div>

            <div className="mb-5 grid gap-3 text-sm">
              <div className="flex justify-between gap-3 border-b border-teal-50 pb-3 text-slate-500">
                <span>Phí dịch vụ</span>
                <strong className="text-[#12312f]">{money(total)}</strong>
              </div>
                <div className="flex justify-between gap-3 border-b border-teal-50 pb-3 text-slate-500">
                  <span>Địa điểm</span>
                  <strong className="text-[#12312f]">{form.addressLocation ? "Đã ghim" : "Chưa ghim"}</strong>
                </div>
                <div className="flex justify-between gap-3 border-b border-teal-50 pb-3 text-slate-500">
                  <span>Hình thức</span>
                  <strong className="text-[#12312f]">{form.bookingMode === "instant" ? "Đặt ngay" : "Theo lịch"}</strong>
                </div>
              <div className="flex justify-between gap-3 text-2xl font-black">
                <span>Tổng</span>
                <span>{money(total)}</span>
              </div>
            </div>

            {error ? <p className="mb-4 rounded-[18px] border border-rose-100 bg-rose-50 p-3 text-sm font-semibold text-rose-600">{error}</p> : null}

            <Button
              className="min-h-12 w-full rounded-[18px] text-base"
              disabled={!form.elderProfileId || !form.serviceId || !form.startTime || !form.durationHours || !form.companionId}
            >
              {form.bookingMode === "instant" ? "Gửi yêu cầu đặt ngay" : "Xác nhận đặt lịch"}
            </Button>
          </div>
        </aside>
      </main>

      {detailCompanion ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setDetailCompanion(null);
          }}
        >
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-[32px] border border-white/20 bg-white shadow-2xl shadow-slate-950/30">
            <header className="relative shrink-0 overflow-hidden bg-gradient-to-br from-teal-700 via-teal-600 to-cyan-500 p-6 text-white sm:p-8">
              <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/20 blur-3xl" />
              <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
                <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-[30px] border border-white/30 bg-white text-2xl font-black text-teal-700 shadow-xl">
                  {detailCompanion.selfieUrl || detailCompanion.userId?.avatar?.url ? (
                    <img
                      src={detailCompanion.selfieUrl || detailCompanion.userId?.avatar?.url}
                      alt={detailCompanion.fullName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    initials(detailCompanion.fullName)
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/25 bg-white/15 px-3 py-1 text-xs font-black">Hồ sơ đã xác thực</span>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-black ${
                        detailCompanionOnlineStatus?.isOnline ? "bg-emerald-300/20 text-emerald-50" : "bg-white/15 text-white/75"
                      }`}
                    >
                      {detailCompanionOnlineStatus?.isOnline ? "Online" : "Offline"}
                    </span>
                  </div>
                  <h2 className="mt-3 text-3xl font-black">{detailCompanion.fullName}</h2>
                  <p className="mt-2 text-sm font-semibold text-white/75">
                    {detailApplicantType.label} · {detailCompanion.major || detailCompanion.qualificationDescription || "Hồ sơ đã xác minh"}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <span className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-amber-500">★ {detailCompanion.ratingAverage || 0}/5</span>
                    <span className="text-xs font-bold text-white/75">{detailCompanion.ratingCount || 0} đánh giá từ khách hàng</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDetailCompanion(null)}
                  aria-label="Đóng chi tiết"
                  className="absolute right-0 top-0 grid h-10 w-10 place-items-center rounded-full bg-white/15 text-xl font-bold transition hover:bg-white/25"
                >
                  ×
                </button>
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto bg-[#f7fffe] p-5 sm:p-7">
              <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
                <div className="space-y-5">
                  <section className="rounded-[26px] border border-teal-100 bg-white p-5 shadow-sm">
                    <h3 className="text-lg font-black text-[#12312f]">Thông tin chuyên môn</h3>
                    <div className="mt-4 grid gap-3">
                      {[
                        ["Nhóm ứng viên", detailApplicantType.label],
                        ["Chuyên môn", detailCompanion.major || detailCompanion.qualificationDescription || "Đã xác minh"],
                        ["Cơ sở đào tạo", detailCompanion.university || "Không áp dụng"],
                        ["Kinh nghiệm", `${detailCompanion.yearsOfExperience || 0} năm`],
                        ["Khu vực hoạt động", detailCompanion.serviceArea || detailCompanion.area || "Chưa cập nhật"],
                        ["Liên hệ", "Mở sau khi người đồng hành nhận lịch"],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                          <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">{label}</p>
                          <p className="mt-1 break-words text-sm font-bold text-slate-700">{value}</p>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-[26px] border border-teal-100 bg-white p-5 shadow-sm">
                    <h3 className="text-lg font-black text-[#12312f]">Kỹ năng nổi bật</h3>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {(detailCompanion.skills?.length ? detailCompanion.skills : ["Chưa cập nhật kỹ năng"]).map((skill) => (
                        <span key={skill} className="rounded-full border border-teal-100 bg-teal-50 px-3 py-2 text-xs font-black text-teal-700">{skill}</span>
                      ))}
                    </div>
                  </section>
                </div>

                <section className="rounded-[26px] border border-teal-100 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wide text-teal-700">Trải nghiệm thực tế</p>
                      <h3 className="mt-1 text-xl font-black text-[#12312f]">Đánh giá từ khách hàng</h3>
                    </div>
                    <span className="rounded-full bg-amber-50 px-3 py-2 text-xs font-black text-amber-600">★ {detailCompanion.ratingAverage || 0}/5 · {detailCompanion.ratingCount || 0} đánh giá</span>
                  </div>

                  {detailReviewsLoading ? <div className="mt-5 rounded-2xl border border-dashed border-teal-100 p-6 text-center text-sm font-bold text-slate-400">Đang tải đánh giá...</div> : null}
                  {detailReviewsError ? <div className="mt-5 rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-bold text-rose-600">{detailReviewsError}</div> : null}
                  {!detailReviewsLoading && !detailReviewsError && detailReviews.length === 0 ? (
                    <div className="mt-5 rounded-2xl border border-dashed border-teal-100 bg-[#f7fffe] p-8 text-center">
                      <p className="font-black text-slate-700">Chưa có đánh giá</p>
                      <p className="mt-2 text-sm text-slate-500">Người đồng hành chưa nhận được nhận xét từ khách hàng.</p>
                    </div>
                  ) : null}

                  <div className="mt-5 grid gap-3">
                    {detailReviews.map((review) => (
                      <article key={review._id} className="rounded-2xl border border-teal-100 bg-[#fbfffe] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-teal-100 to-sky-100 text-xs font-black text-teal-700">{initials(review.customerId?.name || "Khách hàng")}</span>
                            <div>
                              <strong className="block text-sm text-slate-900">{review.customerId?.name || "Khách hàng"}</strong>
                              <span className="mt-1 block text-xs font-black text-amber-500">{"★".repeat(Math.max(1, Number(review.rating || 0)))}</span>
                            </div>
                          </div>
                          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-teal-700">{review.rating}/5</span>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-slate-600">{review.comment || "Khách hàng không để lại nhận xét."}</p>
                      </article>
                    ))}
                  </div>
                </section>
              </div>
            </div>

            <footer className="flex shrink-0 flex-col gap-3 border-t border-teal-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
              <p className="text-xs font-semibold text-slate-500">Hồ sơ và đánh giá giúp bạn chọn người đồng hành phù hợp hơn.</p>
              <div className="flex gap-3">
                <button type="button" onClick={() => setDetailCompanion(null)} className="min-h-11 rounded-2xl border border-teal-100 bg-white px-5 text-sm font-black text-slate-600 transition hover:bg-teal-50">Đóng</button>
                <button
                  type="button"
                  onClick={() => {
                    setForm((current) => ({ ...current, companionId: detailCompanion.userId?._id || detailCompanion.userId }));
                    setDetailCompanion(null);
                  }}
                  className="min-h-11 rounded-2xl bg-teal-700 px-5 text-sm font-black text-white shadow-lg shadow-teal-700/20 transition hover:bg-teal-800"
                >
                  Chọn người đồng hành này
                </button>
              </div>
            </footer>
          </div>
        </div>
      ) : null}

    </form>
  );
};

export default NewBookingPage;
