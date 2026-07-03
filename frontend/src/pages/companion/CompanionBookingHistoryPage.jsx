import { useState } from "react";
import { Link } from "react-router";
import { api } from "../../api/client.js";
import { Button, Card, EmptyState, PageHeader, StatusBadge } from "../../components/Ui.jsx";
import { useAsync } from "../../hooks/useAsync.js";
import { dateTime, money } from "../../utils/format.js";

const historyStatuses = ["completed", "paid", "cancelled"];
const historyFilters = [
  { value: "all", label: "Tất cả" },
  { value: "completed", label: "Hoàn thành" },
  { value: "paid", label: "Đã thanh toán" },
  { value: "cancelled", label: "Đã hủy / từ chối" },
];

const getBookingEarning = (booking) =>
  Math.max(Number(booking?.totalAmount || 0) - Number(booking?.platformFee || 0), 0);

const CompanionBookingHistoryPage = () => {
  const { data, loading, error } = useAsync(() => api.get("/bookings/my?as=companion"), []);
  const [statusFilter, setStatusFilter] = useState("all");
  const bookings = data?.bookings || [];
  const historyBookings = bookings.filter((booking) => historyStatuses.includes(booking.status));
  const filteredBookings = statusFilter === "all"
    ? historyBookings
    : historyBookings.filter((booking) => booking.status === statusFilter);
  const completedCount = historyBookings.filter((booking) => booking.status === "completed").length;
  const cancelledCount = historyBookings.filter((booking) => booking.status === "cancelled").length;
  const paidEarnings = historyBookings
    .filter((booking) => booking.status === "paid")
    .reduce((sum, booking) => sum + getBookingEarning(booking), 0);

  const getFilterCount = (status) => status === "all"
    ? historyBookings.length
    : historyBookings.filter((booking) => booking.status === status).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lịch sử ca làm"
        subtitle="Theo dõi các ca đã hoàn thành, đã thanh toán, bị hủy hoặc bị từ chối."
        action={
          <Link to="/companion/bookings">
            <Button variant="secondary">Quay lại ca làm</Button>
          </Link>
        }
      />

      <section className="rounded-[28px] border border-emerald-100 bg-white/95 p-6 shadow-xl shadow-emerald-900/10">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-[18px] border border-teal-100 bg-[#f7fffe] px-4 py-3 text-sm">
            <p className="text-xs font-semibold text-slate-400">Tổng ca trong lịch sử</p>
            <p className="mt-1 text-lg font-black text-teal-700">{historyBookings.length}</p>
          </div>
          <div className="rounded-[18px] border border-amber-100 bg-amber-50/60 px-4 py-3 text-sm">
            <p className="text-xs font-semibold text-slate-400">Chờ thanh toán</p>
            <p className="mt-1 text-lg font-black text-amber-700">{completedCount}</p>
          </div>
          <div className="rounded-[18px] border border-rose-100 bg-rose-50/60 px-4 py-3 text-sm">
            <p className="text-xs font-semibold text-slate-400">Đã hủy / từ chối</p>
            <p className="mt-1 text-lg font-black text-rose-700">{cancelledCount}</p>
          </div>
          <div className="rounded-[18px] border border-emerald-100 bg-[#f7fffe] px-4 py-3 text-sm">
            <p className="text-xs font-semibold text-slate-400">Thu nhập đã nhận</p>
            <p className="mt-1 text-lg font-black text-emerald-700">{money(paidEarnings)}</p>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-2 rounded-[24px] border border-slate-100 bg-white p-3 shadow-sm">
        {historyFilters.map((filter) => {
          const active = statusFilter === filter.value;
          return (
            <button
              key={filter.value}
              type="button"
              aria-pressed={active}
              onClick={() => setStatusFilter(filter.value)}
              className={`rounded-full px-4 py-2 text-sm font-black transition ${
                active
                  ? "bg-teal-700 text-white shadow-lg shadow-teal-700/15"
                  : "bg-slate-50 text-slate-600 hover:bg-teal-50 hover:text-teal-800"
              }`}
            >
              {filter.label} ({getFilterCount(filter.value)})
            </button>
          );
        })}
      </div>

      {loading ? <p>Đang tải...</p> : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {!loading && !error && filteredBookings.length === 0 ? (
        <EmptyState title={statusFilter === "all" ? "Chưa có lịch sử ca làm" : "Không có ca ở trạng thái này"} />
      ) : null}

      <div className="grid gap-4">
        {filteredBookings.map((booking) => {
          const earning = getBookingEarning(booking);
          const borderClass = booking.status === "cancelled"
            ? "border-rose-100"
            : booking.status === "completed"
              ? "border-amber-100"
              : "border-emerald-100";

          return (
            <Card key={booking._id} className={`${borderClass} bg-white/95 shadow-xl shadow-emerald-900/5`}>
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-bold text-slate-950">{booking.serviceId?.name}</h2>
                    <StatusBadge status={booking.status} />
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {booking.elderProfileId?.fullName} • {dateTime(booking.startTime)}
                  </p>
                  {booking.status === "paid" ? (
                    <p className="mt-1 text-sm font-semibold text-emerald-700">
                      Thu nhập đã nhận: {money(earning)}
                    </p>
                  ) : null}
                  {booking.status === "completed" ? (
                    <p className="mt-1 text-sm font-semibold text-amber-700">
                      Thu nhập chờ thanh toán: {money(earning)}
                    </p>
                  ) : null}
                  {booking.status === "cancelled" ? (
                    <p className="mt-1 text-sm font-semibold text-rose-600">Không phát sinh thu nhập.</p>
                  ) : null}
                </div>
                <Link to={`/companion/bookings/${booking._id}`}>
                  <Button variant="secondary">Xem chi tiết</Button>
                </Link>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default CompanionBookingHistoryPage;
