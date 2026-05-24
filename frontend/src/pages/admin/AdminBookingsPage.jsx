import { useMemo, useState } from "react";
import { api } from "../../api/client.js";
import AdminDetailModal, { DetailGrid, DetailItem } from "../../components/AdminDetailModal.jsx";
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

const initials = (name = "CG") =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const AdminBookingsPage = () => {
  const { data, loading, error } = useAsync(() => api.get("/admin/bookings"), []);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [selectedBooking, setSelectedBooking] = useState(null);
  const bookings = data?.bookings || [];

  const services = useMemo(() => {
    const values = bookings.map((booking) => booking.serviceId?.name).filter(Boolean);
    return ["all", ...new Set(values)];
  }, [bookings]);

  const filteredBookings = bookings.filter((booking) => {
    const text =
      `${booking.customerId?.name} ${booking.customerId?.email} ${booking.companionId?.name} ${booking.companionId?.email} ${booking.elderProfileId?.fullName} ${booking.serviceId?.name} ${booking.address}`.toLowerCase();
    const matchesQuery = text.includes(query.toLowerCase());
    const matchesStatus = statusFilter === "all" || booking.status === statusFilter;
    const matchesService = serviceFilter === "all" || booking.serviceId?.name === serviceFilter;
    return matchesQuery && matchesStatus && matchesService;
  });

  const runningCount = bookings.filter((booking) => ["accepted", "in_progress"].includes(booking.status)).length;
  const paidRevenue = bookings
    .filter((booking) => booking.status === "paid")
    .reduce((sum, booking) => sum + (booking.totalAmount || 0), 0);
  const platformFee = bookings.reduce((sum, booking) => sum + (booking.platformFee || 0), 0);
  const gpsReadyCount = bookings.filter((booking) => booking.addressLocation?.lat).length;

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
            onChange={(event) => setQuery(event.target.value)}
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
          <p className="mt-2 text-2xl font-bold text-slate-900">{bookings.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="block text-xs font-medium text-slate-400">Ca đang chạy</span>
          <p className="mt-2 text-2xl font-bold text-teal-700">{runningCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="block text-xs font-medium text-slate-400">Doanh thu paid</span>
          <p className="mt-2 text-2xl font-bold text-emerald-700">{money(paidRevenue)}</p>
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
              onChange={(event) => setServiceFilter(event.target.value)}
            >
              {services.map((service) => (
                <option key={service} value={service}>
                  {service === "all" ? "Dịch vụ: Tất cả" : service}
                </option>
              ))}
            </select>
            <select
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 outline-none focus:ring-2 focus:ring-teal-100"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status === "all" ? "Trạng thái: Tất cả" : status}
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
                      <p className="text-sm font-bold text-teal-700">{money(booking.totalAmount)}</p>
                      <p className="text-[11px] text-slate-400">Phí nền tảng: {money(booking.platformFee)}</p>
                    </td>
                    <td className="p-4 text-right">
                      <Button variant="muted" className="min-h-8 px-2.5 text-xs" onClick={() => setSelectedBooking(booking)}>
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

        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 p-4 text-xs">
          <span className="font-medium text-slate-500">Hiển thị {filteredBookings.length} booking</span>
          <span className="font-semibold text-slate-500">Phí nền tảng tạm tính: {money(platformFee)}</span>
        </div>
      </section>

      {selectedBooking ? (
        <AdminDetailModal
          title={`Booking ${selectedBooking._id}`}
          subtitle={`${selectedBooking.serviceId?.name || "Dịch vụ"} - ${dateTime(selectedBooking.startTime)}`}
          status={selectedBooking.status}
          onClose={() => setSelectedBooking(null)}
        >
          <div className="space-y-5">
            <DetailGrid>
              <DetailItem label="Khách hàng" value={`${selectedBooking.customerId?.name || "Khách hàng"} - ${selectedBooking.customerId?.email || ""}`} />
              <DetailItem label="Người thân" value={selectedBooking.elderProfileId?.fullName} />
              <DetailItem label="Companion" value={`${selectedBooking.companionId?.name || "Chưa có"} - ${selectedBooking.companionId?.email || ""}`} />
              <DetailItem label="Dịch vụ" value={selectedBooking.serviceId?.name} />
              <DetailItem label="Thời gian bắt đầu" value={dateTime(selectedBooking.startTime)} />
              <DetailItem label="Thời lượng" value={`${selectedBooking.durationHours || 0} giờ`} />
              <DetailItem label="Tổng tiền" value={money(selectedBooking.totalAmount)} />
              <DetailItem label="Phí nền tảng" value={money(selectedBooking.platformFee)} />
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
