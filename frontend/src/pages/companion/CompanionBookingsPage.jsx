import { Link } from "react-router";
import { api } from "../../api/client.js";
import { Button, Card, EmptyState, PageHeader, StatusBadge } from "../../components/Ui.jsx";
import { useAsync } from "../../hooks/useAsync.js";
import { dateTime, money } from "../../utils/format.js";

const workStatuses = ["pending", "accepted", "in_progress"];

const CompanionBookingsPage = () => {
  const { data, loading, error } = useAsync(() => api.get("/bookings/my"), []);
  const bookings = data?.bookings || [];
  const workBookings = bookings.filter((booking) => workStatuses.includes(booking.status));
  const activeCount = bookings.filter((booking) => ["accepted", "in_progress"].includes(booking.status)).length;
  const completedCount = bookings.filter((booking) => ["completed", "paid"].includes(booking.status)).length;

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-teal-100 bg-white/95 p-6 shadow-xl shadow-teal-900/10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-700">
              Ca làm của tôi
            </div>
            <h1 className="text-3xl font-black text-slate-950 sm:text-4xl">Quản lý ca chăm sóc</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Theo dõi trạng thái, cập nhật checklist và ghi chú sức khỏe cho từng ca.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[18px] border border-teal-100 bg-[#f7fffe] px-4 py-3 text-sm">
              <p className="text-xs font-semibold text-slate-400">Đang diễn ra</p>
              <p className="mt-1 text-lg font-black text-teal-700">{activeCount}</p>
            </div>
            <div className="rounded-[18px] border border-teal-100 bg-[#f7fffe] px-4 py-3 text-sm">
              <p className="text-xs font-semibold text-slate-400">Hoàn thành</p>
              <p className="mt-1 text-lg font-black text-slate-900">{completedCount}</p>
            </div>
          </div>
        </div>
      </section>

      {loading ? <p>Đang tải...</p> : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {!loading && workBookings.length === 0 ? <EmptyState title="Chưa có ca đang làm" /> : null}

      <div className="grid gap-4">
        {workBookings.map((booking) => (
          <Card key={booking._id} className="border-teal-100 bg-white/95 shadow-xl shadow-teal-900/5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-bold text-slate-950">{booking.serviceId?.name}</h2>
                  <StatusBadge status={booking.status} />
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {booking.elderProfileId?.fullName} • {dateTime(booking.startTime)}
                </p>
                <p className="mt-1 text-sm font-semibold text-teal-700">
                  Thu nhập: {money(booking.totalAmount - booking.platformFee)}
                </p>
              </div>
              <Link to={`/companion/bookings/${booking._id}`}>
                <Button variant="secondary">Cập nhật ca</Button>
              </Link>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default CompanionBookingsPage;
