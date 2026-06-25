import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { api } from "../../api/client.js";
import AddressSearchMap from "../../components/AddressSearchMap.jsx";
import { Button, Input, Select, Textarea } from "../../components/Ui.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useAsync } from "../../hooks/useAsync.js";
import { money } from "../../utils/format.js";

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

const NewBookingPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: elderData, loading: elderLoading } = useAsync(() => api.get("/elders/my"), []);
  const { data: serviceData, loading: serviceLoading } = useAsync(() => api.get("/services"), []);
  const { data: companionData, loading: companionLoading } = useAsync(() => api.get("/companions"), []);
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
  });
  const [error, setError] = useState("");

  const elders = useMemo(() => elderData?.elders || [], [elderData?.elders]);
  const services = useMemo(() => serviceData?.services || [], [serviceData?.services]);
  const companions = useMemo(() => companionData?.companions || [], [companionData?.companions]);
  const currentUserId = user?.id || user?._id;
  const onlineCompanions = useMemo(
    () =>
      companions.filter((item) => {
        const companionUserId = item.userId?._id || item.userId;
        return companionUserId !== currentUserId && onlineStatuses[companionUserId]?.isOnline;
      }),
    [companions, currentUserId, onlineStatuses],
  );
  const selectedService = useMemo(() => services.find((item) => item._id === form.serviceId), [services, form.serviceId]);
  const selectedElder = useMemo(() => elders.find((item) => item._id === form.elderProfileId), [elders, form.elderProfileId]);
  const selectedCompanion = useMemo(
    () => companions.find((item) => item.userId?._id === form.companionId),
    [companions, form.companionId],
  );
  const total = (selectedService?.pricePerHour || 0) * Number(form.durationHours || 0);

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
    if (!form.companionId) return undefined;
    const status = onlineStatuses[form.companionId];
    if (status && !status.isOnline) {
      let active = true;
      Promise.resolve().then(() => {
        if (active) {
          setForm((current) => ({ ...current, companionId: "" }));
        }
      });
      return () => {
        active = false;
      };
    }
    return undefined;
  }, [form.companionId, onlineStatuses]);

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

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (!form.addressLocation?.lat || !form.addressLocation?.lng) {
      setError("Vui lòng tìm địa chỉ trên bản đồ hoặc bấm vào bản đồ để ghim vị trí trước khi đặt lịch.");
      return;
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
              <Input
                label="Thời gian bắt đầu"
                type="datetime-local"
                value={form.startTime}
                onChange={(event) => setForm({ ...form, startTime: event.target.value })}
                required
                className="rounded-[18px] border-teal-100 bg-[#fbfffe] px-4"
              />
              <Input
                label="Số giờ"
                type="number"
                min="1"
                value={form.durationHours}
                onChange={(event) => setForm({ ...form, durationHours: event.target.value })}
                required
                className="rounded-[18px] border-teal-100 bg-[#fbfffe] px-4"
              />
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
                <p className="mt-2 text-sm leading-6 text-slate-500">Sau khi chọn người đồng hành, nhấn xác nhận để tạo đơn.</p>
              </div>
              <StatusPill>Gợi ý phù hợp</StatusPill>
            </div>

            {companionLoading ? <p className="text-sm text-slate-500">Đang tải người đồng hành...</p> : null}
            {!companionLoading && onlineLoading ? (
              <p className="text-sm text-slate-500">Đang cập nhật trạng thái online...</p>
            ) : null}
            {!companionLoading && !onlineLoading && onlineCompanions.length === 0 ? (
              <p className="text-sm text-slate-500">
                Hiện chưa có người đồng hành online. Vui lòng quay lại sau ít phút.
              </p>
            ) : null}
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {onlineCompanions.map((item) => {
                const companionUserId = item.userId?._id;
                const active = form.companionId === companionUserId;
                const ratingAverage = Number(item.ratingAverage || 0);
                const ratingCount = Number(item.ratingCount || 0);
                return (
                  <div
                    key={item._id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setForm((current) => ({ ...current, companionId: companionUserId }))}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setForm((current) => ({ ...current, companionId: companionUserId }));
                      }
                    }}
                    className={`rounded-[24px] border bg-[#fbfffe] p-5 text-left transition hover:-translate-y-1 hover:border-teal-600 hover:bg-gradient-to-b hover:from-white hover:to-teal-50 hover:shadow-lg hover:shadow-teal-900/10 ${active ? "border-teal-700 bg-gradient-to-b from-white to-teal-50 shadow-lg shadow-teal-900/10" : "border-teal-50"
                      }`}
                  >
                    <div className="mb-4 flex items-center gap-3">
                      <div className="grid h-14 w-14 shrink-0 place-items-center rounded-[19px] bg-gradient-to-br from-teal-100 to-sky-100 text-base font-black text-teal-700">
                        {initials(item.fullName)}
                      </div>
                      <div>
                        <h3 className="font-black">{item.fullName}</h3>
                        <small className="text-slate-500">{item.major || "Người đồng hành"}</small>
                      </div>
                    </div>
                    <p className="mb-3 text-sm font-black text-amber-500">
                      {ratingCount > 0
                        ? `${ratingAverage.toFixed(1)}/5 (${ratingCount} đánh giá)`
                        : "Chưa có đánh giá"}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {(item.skills || []).slice(0, 4).map((skill) => (
                        <span key={skill} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-teal-700">
                          {skill}
                        </span>
                      ))}
                    </div>
                    <div className="mt-4">
                      <Button
                        type="button"
                        variant="secondary"
                        className="min-h-9 px-3 text-xs"
                        onClick={(event) => {
                          event.stopPropagation();
                          setDetailCompanion(item);
                        }}
                      >
                        Xem chi tiết
                      </Button>
                    </div>
                  </div>
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
              <div className="flex justify-between gap-3 text-2xl font-black">
                <span>Tổng</span>
                <span>{money(total)}</span>
              </div>
            </div>

            {error ? <p className="mb-4 rounded-[18px] border border-rose-100 bg-rose-50 p-3 text-sm font-semibold text-rose-600">{error}</p> : null}

            <Button className="min-h-12 w-full rounded-[18px] text-base" disabled={!form.elderProfileId || !form.serviceId || !form.companionId}>
              Xác nhận đặt lịch
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
                    <span className="rounded-full bg-emerald-300/20 px-3 py-1 text-xs font-black text-emerald-50">Đang online</span>
                  </div>
                  <h2 className="mt-3 text-3xl font-black">{detailCompanion.fullName}</h2>
                  <p className="mt-2 text-sm font-semibold text-white/75">
                    {detailCompanion.major || "Người đồng hành CareGo"} · {detailCompanion.university || "Chưa cập nhật trường"}
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
                        ["Chuyên ngành", detailCompanion.major || "Chưa cập nhật"],
                        ["Trường học", detailCompanion.university || "Chưa cập nhật"],
                        ["Khu vực hoạt động", detailCompanion.serviceArea || detailCompanion.area || "Chưa cập nhật"],
                        ["Số điện thoại", detailCompanion.phone || detailCompanion.userId?.phone || "Chưa cập nhật"],
                        ["Email", detailCompanion.userId?.email || "Chưa cập nhật"],
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
