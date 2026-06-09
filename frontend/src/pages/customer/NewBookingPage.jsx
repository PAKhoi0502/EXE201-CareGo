import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { api } from "../../api/client.js";
import AddressSearchMap from "../../components/AddressSearchMap.jsx";
import { Button, Input, Select, Textarea } from "../../components/Ui.jsx";
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

  const elders = elderData?.elders || [];
  const services = serviceData?.services || [];
  const companions = companionData?.companions || [];
  const onlineCompanions = useMemo(
    () =>
      companions.filter((item) => {
        const userId = item.userId?._id || item.userId;
        return onlineStatuses[userId]?.isOnline;
      }),
    [companions, onlineStatuses],
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

    loadOnlineStatuses();
    const timer = setInterval(loadOnlineStatuses, 10000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!form.companionId) return;
    const status = onlineStatuses[form.companionId];
    if (status && !status.isOnline) {
      setForm((current) => ({ ...current, companionId: "" }));
    }
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

    loadReviews();
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
                      className={`mb-4 grid h-14 w-14 place-items-center rounded-[20px] transition ${
                        active
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
                label="Ho so nguoi than"
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
                return (
                  <button
                    key={item._id}
                    type="button"
                    onClick={() => setForm((current) => ({ ...current, companionId: companionUserId }))}
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
                    <p className="mb-3 text-sm font-black text-amber-500">4.9/5 đánh giá</p>
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
                  </button>
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
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-[28px] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <div>
                <p className="text-xs font-bold uppercase text-slate-400">Chi tiết người đồng hành</p>
                <h3 className="mt-1 text-xl font-black text-[#12312f]">{detailCompanion.fullName}</h3>
              </div>
              <button
                type="button"
                onClick={() => setDetailCompanion(null)}
                className="rounded-full bg-slate-100 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200"
              >
                Đóng
              </button>
            </div>

            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <div className="rounded-[18px] border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase text-slate-400">Chuyên ngành</p>
                <p className="mt-2 font-bold text-slate-900">{detailCompanion.major || "Chưa cập nhật"}</p>
              </div>
              <div className="rounded-[18px] border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase text-slate-400">Trường</p>
                <p className="mt-2 font-bold text-slate-900">{detailCompanion.university || "Chưa cập nhật"}</p>
              </div>
              <div className="rounded-[18px] border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase text-slate-400">Số điện thoại</p>
                <p className="mt-2 font-bold text-slate-900">{detailCompanion.phone || detailCompanion.userId?.phone || "Chưa cập nhật"}</p>
              </div>
              <div className="rounded-[18px] border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase text-slate-400">Email</p>
                <p className="mt-2 font-bold text-slate-900">{detailCompanion.userId?.email || "Chưa cập nhật"}</p>
              </div>
            </div>

            <div className="px-5">
              <div className="rounded-[18px] border border-teal-100 bg-[#f7fffe] p-4">
                <p className="text-xs font-black uppercase text-slate-400">Kỹ năng</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(detailCompanion.skills?.length ? detailCompanion.skills : ["Chưa có kỹ năng"]).map((skill) => (
                    <span key={skill} className="rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-700">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-5 pb-6">
              <div className="rounded-[18px] border border-slate-100 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-black uppercase text-slate-400">Đánh giá từ khách hàng</p>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                    {detailCompanion.ratingAverage || 0}/5 · {detailCompanion.ratingCount || 0}
                  </span>
                </div>

                {detailReviewsLoading ? <p className="mt-3 text-sm text-slate-500">Đang tải đánh giá...</p> : null}
                {detailReviewsError ? <p className="mt-3 text-sm text-rose-600">{detailReviewsError}</p> : null}
                {!detailReviewsLoading && !detailReviewsError && detailReviews.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-500">Chưa có đánh giá.</p>
                ) : null}

                <div className="mt-4 space-y-3">
                  {detailReviews.map((review) => (
                    <div key={review._id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                      <div className="flex items-center justify-between text-sm">
                        <strong className="text-slate-900">{review.customerId?.name || "Khách hàng"}</strong>
                        <span className="text-emerald-700">{review.rating}/5</span>
                      </div>
                      {review.comment ? (
                        <p className="mt-2 text-sm text-slate-600">{review.comment}</p>
                      ) : (
                        <p className="mt-2 text-xs text-slate-400">Không có nhận xét.</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
};

export default NewBookingPage;
