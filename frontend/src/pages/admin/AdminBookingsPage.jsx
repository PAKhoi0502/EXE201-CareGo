import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { api } from "../../api/client.js";
import AdminDetailModal, { DetailGrid, DetailItem } from "../../components/AdminDetailModal.jsx";
import AdminPagination from "../../components/AdminPagination.jsx";
import { Button, StatusBadge } from "../../components/Ui.jsx";
import { useAsync } from "../../hooks/useAsync.js";
import { dateTime, money } from "../../utils/format.js";

const statusOptions = [
  "all",
  "pending",
  "accepted",
  "in_progress",
  "completed",
  "paid",
  "cancelled",
];

const statusLabels = {
  pending: "Chờ xử lý",
  accepted: "Đã nhận",
  in_progress: "Đang diễn ra",
  completed: "Hoàn thành",
  paid: "Đã thanh toán",
  cancelled: "Đã hủy",
};

const initials = (name = "CG") =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const getBaseAmount = (booking) => Number(booking.payment?.baseAmount ?? booking.totalAmount ?? 0);
const getPenaltyAmount = (booking) => Number(booking.payment?.penaltyAmount ?? 0);
const getPaidAmount = (booking) => Number(booking.payment?.paidAmount ?? booking.payment?.amount ?? getBaseAmount(booking));
const getPlatformFee = (booking) => Number(booking.payment?.platformFee ?? booking.platformFee ?? 0);
const getCompanionEarning = (booking) =>
  Number(booking.payment?.companionEarning ?? Math.max(getBaseAmount(booking) - getPlatformFee(booking), 0));
const getCareGoRevenue = (booking) => getPlatformFee(booking) + getPenaltyAmount(booking);
const getDisplayAmount = (booking) => (booking.status === "paid" ? getPaidAmount(booking) : getBaseAmount(booking));

const adminStatusActions = {
  pending: [{ status: "accepted", label: "Nhận ca" }],
  accepted: [{ status: "in_progress", label: "Bắt đầu ca" }],
  in_progress: [{ status: "completed", label: "Hoàn thành ca" }],
};

const adminCancellableStatuses = ["pending", "accepted", "in_progress"];

const AdminBookingsPage = () => {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [actionLoading, setActionLoading] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [replacementCompanions, setReplacementCompanions] = useState([]);
  const [replacementCompanionId, setReplacementCompanionId] = useState("");
  const deferredQuery = useDeferredValue(query.trim());
  const { data, setData, loading, error } = useAsync(() => {
    const params = new URLSearchParams({ page: String(page), limit: "25" });
    if (deferredQuery) params.set("search", deferredQuery);
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (serviceFilter !== "all") params.set("serviceId", serviceFilter);
    return api.get(`/admin/bookings?${params.toString()}`);
  }, [page, deferredQuery, statusFilter, serviceFilter]);
  const bookings = useMemo(() => data?.bookings || [], [data?.bookings]);
  const summary = data?.summary || {};
  const pagination = data?.pagination || { page, limit: 25, total: 0, totalPages: 1 };
  const selectedStatusActions = selectedBooking ? adminStatusActions[selectedBooking.status] || [] : [];
  const canCancelSelectedBooking = selectedBooking
    ? adminCancellableStatuses.includes(selectedBooking.status) && selectedBooking.payment?.status !== "paid"
    : false;
  const hasReportedIncident = selectedBooking?.incident?.status === "reported";

  const services = data?.filterOptions?.services || [];

  useEffect(() => {
    const loadReplacementCompanions = async () => {
      if (!selectedBooking || selectedBooking.incident?.status !== "reported" || selectedBooking.status !== "accepted") {
        setReplacementCompanions([]);
        setReplacementCompanionId("");
        return;
      }

      try {
        const params = new URLSearchParams({
          startTime: selectedBooking.startTime,
          durationHours: String(selectedBooking.durationHours || 0),
        });
        const response = await api.get(`/companions?${params.toString()}`);
        const companions = (response.companions || []).filter((item) => item.userId !== selectedBooking.companionId?._id);
        setReplacementCompanions(companions);
        setReplacementCompanionId(companions[0]?.userId || "");
      } catch {
        setReplacementCompanions([]);
        setReplacementCompanionId("");
      }
    };

    loadReplacementCompanions();
  }, [selectedBooking]);

  const filteredBookings = bookings;
  const runningCount = Number(summary.running || 0);
  const paidRevenue = Number(summary.paidRevenue || 0);
  const penaltyRevenue = Number(summary.penaltyRevenue || 0);
  const platformFee = Number(summary.platformFee || 0);
  const careGoRevenue = Number(summary.careGoRevenue || 0);
  const gpsReadyCount = Number(summary.gpsReady || 0);

  const updateBookingInView = (bookingId, updates) => {
    setData((current) => ({
      ...current,
      bookings: (current?.bookings || []).map((booking) =>
        booking._id === bookingId ? { ...booking, ...updates } : booking,
      ),
    }));
    setSelectedBooking((current) => (current?._id === bookingId ? { ...current, ...updates } : current));
  };

  const handleUpdateStatus = async (nextStatus) => {
    if (!selectedBooking) return;

    setActionLoading(`status:${nextStatus}`);
    setActionError("");
    setActionMessage("");
    try {
      const data = await api.patch(`/bookings/${selectedBooking._id}/status`, { status: nextStatus });
      const updatedBooking = data.booking || {};
      updateBookingInView(selectedBooking._id, {
        status: updatedBooking.status || nextStatus,
        completedAt: updatedBooking.completedAt,
        paymentDueAt: updatedBooking.paymentDueAt,
        updatedAt: updatedBooking.updatedAt || new Date().toISOString(),
      });
      setActionMessage("Đã cập nhật trạng thái lịch chăm sóc.");
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActionLoading("");
    }
  };

  const handleCancelBooking = async () => {
    if (!selectedBooking) return;

    if (!window.confirm("Hủy lịch chăm sóc này? Thao tác sẽ dừng ca nếu lịch chưa được thanh toán.")) {
      return;
    }

    setActionLoading("cancel");
    setActionError("");
    setActionMessage("");
    try {
      const data = await api.patch(`/bookings/${selectedBooking._id}/cancel`, {});
      const updatedBooking = data.booking || {};
      updateBookingInView(selectedBooking._id, {
        status: updatedBooking.status || "cancelled",
        updatedAt: updatedBooking.updatedAt || new Date().toISOString(),
      });
      setActionMessage("Đã hủy lịch chăm sóc.");
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActionLoading("");
    }
  };

  const handleResolveIncident = async (resolution) => {
    if (!selectedBooking) return;

    if (resolution === "reassign" && !replacementCompanionId) {
      setActionError("Vui lòng chọn người đồng hành thay thế.");
      return;
    }

    setActionLoading(`incident:${resolution}`);
    setActionError("");
    setActionMessage("");
    try {
      const data = await api.patch(`/bookings/${selectedBooking._id}/incident/resolve`, {
        resolution,
        companionId: resolution === "reassign" ? replacementCompanionId : undefined,
      });
      const updatedBooking = data.booking || {};
      updateBookingInView(selectedBooking._id, {
        ...updatedBooking,
        updatedAt: updatedBooking.updatedAt || new Date().toISOString(),
      });
      setActionMessage(
        resolution === "resume"
          ? "Đã cho lịch chăm sóc tiếp tục sau sự cố."
          : resolution === "cancel"
            ? "Đã hủy lịch chăm sóc sau sự cố."
            : "Đã chuyển lịch chăm sóc sang chờ người đồng hành thay thế xác nhận.",
      );
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActionLoading("");
    }
  };

  const openBookingDetail = (booking) => {
    setSelectedBooking(booking);
    setActionError("");
    setActionMessage("");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Quản lý ca làm</h1>
          <p className="mt-1 text-sm text-slate-500">
            Theo dõi booking, trạng thái vận hành, điểm đến GPS và doanh thu từng ca.
          </p>
        </div>
        <div className="relative w-full xl:w-96">
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Tìm booking, khách hàng, companion..."
            className="min-h-11 w-full rounded-xl border border-transparent bg-slate-100 px-4 pl-10 text-sm outline-none transition focus:border-teal-300 focus:bg-white focus:ring-2 focus:ring-teal-100"
          />
          <span className="absolute left-3 top-2.5 text-slate-400">⌕</span>
        </div>
      </div>

      {error ? <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="block text-xs font-medium text-slate-400">Tổng booking</span>
          <p className="mt-2 text-2xl font-bold text-slate-900">{summary.total || 0}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="block text-xs font-medium text-slate-400">Ca đang chạy</span>
          <p className="mt-2 text-2xl font-bold text-teal-700">{runningCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="block text-xs font-medium text-slate-400">Doanh thu paid</span>
          <p className="mt-2 text-2xl font-bold text-emerald-700">{money(paidRevenue)}</p>
          <p className="mt-1 text-[11px] text-slate-400">Phí phạt: {money(penaltyRevenue)}</p>
        </div>
        <div className="rounded-xl border-l-4 border-amber-500 bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <span className="block text-xs font-medium text-amber-600">Booking có GPS điểm đến</span>
          <p className="mt-2 text-2xl font-bold text-slate-900">{gpsReadyCount}</p>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 bg-slate-50/70 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-bold text-slate-900">Danh sách booking</h2>
            <p className="mt-1 text-xs text-slate-400">
              Kiểm soát ca chăm sóc, GPS điểm đến, tổng tiền và trạng thái thanh toán.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 outline-none focus:ring-2 focus:ring-teal-100"
              value={serviceFilter}
              onChange={(event) => {
                setServiceFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="all">Dịch vụ: Tất cả</option>
              {services.map((service) => (
                <option key={service._id} value={service._id}>
                  {service.name}
                </option>
              ))}
            </select>
            <select
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 outline-none focus:ring-2 focus:ring-teal-100"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(1);
              }}
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status === "all" ? "Trạng thái: Tất cả" : statusLabels[status] || "Không rõ"}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? <p className="p-6 text-sm text-slate-500">Đang tải booking...</p> : null}

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50 text-xs font-semibold uppercase text-slate-400">
                <th className="p-4">Khách hàng / Người thân</th>
                <th className="p-4">Companion</th>
                <th className="p-4">Dịch vụ / Thời gian</th>
                <th className="p-4">GPS điểm đến</th>
                <th className="p-4">Trạng thái</th>
                <th className="p-4 text-right">Giá trị</th>
                <th className="p-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredBookings.map((booking) => {
                const hasPinnedLocation = Boolean(booking.addressLocation?.lat);
                const googleMapsUrl = hasPinnedLocation
                  ? `https://www.google.com/maps/dir/?api=1&destination=${booking.addressLocation.lat},${booking.addressLocation.lng}`
                  : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(booking.address || "")}`;
                const penaltyAmount = getPenaltyAmount(booking);

                return (
                  <tr key={booking._id} className={booking.status === "in_progress" ? "bg-teal-50/40" : "hover:bg-slate-50/80"}>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                          {initials(booking.customerId?.name)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800">{booking.customerId?.name || "Khách hàng"}</p>
                          <p className="text-[11px] text-slate-400">{booking.customerId?.email}</p>
                          <p className="mt-1 text-xs font-semibold text-slate-700">
                            Người thân: {booking.elderProfileId?.fullName || "Chưa có"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <p className="font-bold text-slate-800">{booking.companionId?.name || "Chưa có"}</p>
                      <p className="text-[11px] text-slate-400">{booking.companionId?.email}</p>
                    </td>
                    <td className="p-4">
                      <span className="inline-block rounded bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                        {booking.serviceId?.name || "Dịch vụ"}
                      </span>
                      <p className="mt-2 font-semibold text-slate-700">{dateTime(booking.startTime)}</p>
                      <p className="text-[11px] text-slate-400">{booking.durationHours} giờ</p>
                    </td>
                    <td className="p-4">
                      <p className="max-w-56 truncate font-semibold text-slate-700">{booking.address}</p>
                      {hasPinnedLocation ? (
                        <p className="mt-1 text-[11px] font-semibold text-teal-700">
                          {Number(booking.addressLocation.lat).toFixed(5)}, {Number(booking.addressLocation.lng).toFixed(5)}
                        </p>
                      ) : (
                        <p className="mt-1 text-[11px] font-semibold text-amber-600">Chưa có tọa độ ghim</p>
                      )}
                      <a
                        href={googleMapsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-teal-50 hover:text-teal-700"
                      >
                        Xem bản đồ
                      </a>
                    </td>
                    <td className="p-4">
                      <StatusBadge status={booking.status} />
                      <p className="mt-2 text-[11px] text-slate-400">
                        Tạo lúc: {dateTime(booking.createdAt)}
                      </p>
                    </td>
                    <td className="p-4 text-right">
                      <p className="text-sm font-bold text-teal-700">{money(getDisplayAmount(booking))}</p>
                      <p className="text-[11px] text-slate-400">Tiền ca: {money(getBaseAmount(booking))}</p>
                      <p className="text-[11px] text-slate-400">Phí nền tảng: {money(getPlatformFee(booking))}</p>
                      {penaltyAmount > 0 ? (
                        <p className="text-[11px] font-semibold text-rose-600">Phí phạt: {money(penaltyAmount)}</p>
                      ) : null}
                    </td>
                    <td className="p-4 text-right">
                      <Button variant="muted" className="min-h-8 px-2.5 text-xs" onClick={() => openBookingDetail(booking)}>
                        Chi tiết
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {!filteredBookings.length ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-sm text-slate-400">
                    Không tìm thấy booking phù hợp.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="border-t border-slate-100 bg-slate-50/50 px-4 pt-4 text-right text-xs font-semibold text-slate-500">
          CareGo đã thu: {money(careGoRevenue)} | Phí nền tảng: {money(platformFee)}
        </div>
        <AdminPagination
          pagination={pagination}
          loading={loading}
          onPageChange={setPage}
          itemLabel="lịch chăm sóc"
        />
      </section>

      {selectedBooking ? (
        <AdminDetailModal
          title={`Booking ${selectedBooking._id}`}
          subtitle={`${selectedBooking.serviceId?.name || "Dịch vụ"} - ${dateTime(selectedBooking.startTime)}`}
          status={selectedBooking.status}
          onClose={() => setSelectedBooking(null)}
        >
          <div className="space-y-5">
            <section className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="font-bold text-slate-900">Điều phối booking</h3>
                  <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-slate-500">
                    <span>Trạng thái hiện tại</span>
                    <StatusBadge status={selectedBooking.status} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedStatusActions.map((action) => (
                    <Button
                      key={action.status}
                      type="button"
                      onClick={() => handleUpdateStatus(action.status)}
                      disabled={Boolean(actionLoading)}
                      className="min-h-9 px-3 text-xs"
                    >
                      {actionLoading === `status:${action.status}` ? "Đang cập nhật..." : action.label}
                    </Button>
                  ))}
                  {canCancelSelectedBooking ? (
                    <Button
                      type="button"
                      variant="danger"
                      onClick={handleCancelBooking}
                      disabled={Boolean(actionLoading)}
                      className="min-h-9 px-3 text-xs"
                    >
                      {actionLoading === "cancel" ? "Đang hủy..." : "Hủy booking"}
                    </Button>
                  ) : null}
                  {!selectedStatusActions.length && !canCancelSelectedBooking ? (
                    <span className="inline-flex min-h-9 items-center rounded-md bg-white px-3 text-xs font-bold text-slate-500 ring-1 ring-slate-200">
                      Không còn thao tác trực tiếp
                    </span>
                  ) : null}
                </div>
              </div>
              {actionError ? (
                <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{actionError}</p>
              ) : null}
              {actionMessage ? (
                <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
                  {actionMessage}
                </p>
              ) : null}
            </section>

            {hasReportedIncident ? (
              <section className="rounded-xl border border-rose-100 bg-rose-50 p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h3 className="font-bold text-rose-700">Sự cố do người đồng hành báo</h3>
                    <p className="mt-2 text-sm font-semibold text-rose-700">
                      Lý do: {selectedBooking.incident?.reason || "Không rõ"}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-rose-700">
                      {selectedBooking.incident?.details || "Không có mô tả."}
                    </p>
                  </div>
                  <div className="grid gap-2 sm:min-w-72">
                    {selectedBooking.status === "accepted" ? (
                      <>
                        <select
                          value={replacementCompanionId}
                          onChange={(event) => setReplacementCompanionId(event.target.value)}
                          className="min-h-10 rounded-lg border border-rose-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-rose-100"
                        >
                          <option value="">Chọn người đồng hành thay thế</option>
                          {replacementCompanions.map((companion) => (
                            <option key={companion.userId} value={companion.userId}>
                              {companion.fullName} - {companion.serviceAreas?.join(", ") || "Không rõ khu vực"}
                            </option>
                          ))}
                        </select>
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" variant="secondary" className="min-h-9 px-3 text-xs" onClick={() => handleResolveIncident("resume")} disabled={Boolean(actionLoading)}>
                            {actionLoading === "incident:resume" ? "Đang xử lý..." : "Cho tiếp tục"}
                          </Button>
                          <Button type="button" className="min-h-9 px-3 text-xs" onClick={() => handleResolveIncident("reassign")} disabled={Boolean(actionLoading) || !replacementCompanionId}>
                            {actionLoading === "incident:reassign" ? "Đang điều phối..." : "Đổi người đồng hành"}
                          </Button>
                          <Button type="button" variant="danger" className="min-h-9 px-3 text-xs" onClick={() => handleResolveIncident("cancel")} disabled={Boolean(actionLoading)}>
                            {actionLoading === "incident:cancel" ? "Đang hủy..." : "Hủy lịch chăm sóc"}
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="secondary" className="min-h-9 px-3 text-xs" onClick={() => handleResolveIncident("resume")} disabled={Boolean(actionLoading)}>
                          {actionLoading === "incident:resume" ? "Đang xử lý..." : "Cho tiếp tục"}
                        </Button>
                        <Button type="button" variant="danger" className="min-h-9 px-3 text-xs" onClick={() => handleResolveIncident("cancel")} disabled={Boolean(actionLoading)}>
                          {actionLoading === "incident:cancel" ? "Đang hủy..." : "Hủy lịch chăm sóc"}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            ) : null}

            <DetailGrid>
              <DetailItem label="Khách hàng" value={`${selectedBooking.customerId?.name || "Khách hàng"} - ${selectedBooking.customerId?.email || ""}`} />
              <DetailItem label="Người thân" value={selectedBooking.elderProfileId?.fullName} />
              <DetailItem label="Companion" value={`${selectedBooking.companionId?.name || "Chưa có"} - ${selectedBooking.companionId?.email || ""}`} />
              <DetailItem label="Dịch vụ" value={selectedBooking.serviceId?.name} />
              <DetailItem label="Thời gian bắt đầu" value={dateTime(selectedBooking.startTime)} />
              <DetailItem label="Thời lượng" value={`${selectedBooking.durationHours || 0} giờ`} />
              <DetailItem label="Tiền ca" value={money(getBaseAmount(selectedBooking))} />
              <DetailItem label="Phí nền tảng" value={money(getPlatformFee(selectedBooking))} />
              <DetailItem label="Phí phạt" value={money(getPenaltyAmount(selectedBooking))} />
              <DetailItem label="Tổng khách trả" value={money(getDisplayAmount(selectedBooking))} />
              <DetailItem label="CareGo thu" value={money(selectedBooking.status === "paid" ? getCareGoRevenue(selectedBooking) : 0)} />
              <DetailItem label="Thu nhập companion" value={money(selectedBooking.status === "paid" ? getCompanionEarning(selectedBooking) : 0)} />
              <DetailItem label="Ngày tạo" value={dateTime(selectedBooking.createdAt)} />
              <DetailItem label="Cập nhật lần cuối" value={dateTime(selectedBooking.updatedAt)} />
            </DetailGrid>

            <section className="rounded-xl border border-slate-100 p-4">
              <h3 className="font-bold text-slate-900">Địa điểm thực hiện</h3>
              <p className="mt-2 text-sm font-semibold text-slate-800">{selectedBooking.address}</p>
              <p className="mt-1 text-xs text-slate-500">
                {selectedBooking.addressLocation?.lat
                  ? `${selectedBooking.addressLocation.displayName || "Đã ghim trên bản đồ"} - ${selectedBooking.addressLocation.lat}, ${selectedBooking.addressLocation.lng}`
                  : "Booking này chưa có tọa độ GPS được ghim."}
              </p>
              <a
                href={
                  selectedBooking.addressLocation?.lat
                    ? `https://www.google.com/maps/dir/?api=1&destination=${selectedBooking.addressLocation.lat},${selectedBooking.addressLocation.lng}`
                    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedBooking.address || "")}`
                }
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex rounded-lg bg-teal-50 px-3 py-2 text-xs font-bold text-teal-700 hover:bg-teal-100"
              >
                Mở Google Maps
              </a>
            </section>

            <section className="rounded-xl border border-slate-100 p-4">
              <h3 className="font-bold text-slate-900">Ghi chú booking</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{selectedBooking.note || "Không có ghi chú."}</p>
            </section>
          </div>
        </AdminDetailModal>
      ) : null}
    </div>
  );
};

export default AdminBookingsPage;
