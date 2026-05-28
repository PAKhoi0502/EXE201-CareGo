import { Link } from "react-router";
import { api } from "../../api/client.js";
import { Button, Card, EmptyState, PageHeader, StatusBadge } from "../../components/Ui.jsx";
import { useAsync } from "../../hooks/useAsync.js";
import { dateTime, money } from "../../utils/format.js";

const startOfDay = (date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const startOfWeek = (date) => {
  const next = startOfDay(date);
  const day = next.getDay() || 7;
  next.setDate(next.getDate() - day + 1);
  return next;
};

const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);

const getPaidAt = (booking) => new Date(booking.updatedAt || booking.createdAt || booking.startTime);
const getEarning = (booking) => (booking.totalAmount || 0) - (booking.platformFee || 0);

const StatCard = ({ label, value, tone = "emerald" }) => {
  const tones = {
    emerald: "border-emerald-100 bg-emerald-50 text-emerald-700",
    sky: "border-sky-100 bg-sky-50 text-sky-700",
    teal: "border-teal-100 bg-teal-50 text-teal-700",
    slate: "border-slate-100 bg-slate-50 text-slate-800",
  };

  return (
    <div className={`rounded-[22px] border p-4 ${tones[tone] || tones.emerald}`}>
      <p className="text-xs font-black uppercase opacity-70">{label}</p>
      <p className="mt-2 text-xl font-black">{value}</p>
    </div>
  );
};

const CompanionEarningsPage = () => {
  const { data, loading, error } = useAsync(() => api.get("/bookings/my"), []);
  const bookings = data?.bookings || [];
  const paidBookings = bookings
    .filter((booking) => booking.status === "paid")
    .sort((a, b) => getPaidAt(b) - getPaidAt(a));

  const now = new Date();
  const todayStart = startOfDay(now);
  const weekStart = startOfWeek(now);
  const monthStart = startOfMonth(now);

  const stats = paidBookings.reduce(
    (result, booking) => {
      const earning = getEarning(booking);
      const paidAt = getPaidAt(booking);

      result.total += earning;
      if (paidAt >= todayStart) result.today += earning;
      if (paidAt >= weekStart) result.week += earning;
      if (paidAt >= monthStart) result.month += earning;
      return result;
    },
    { today: 0, week: 0, month: 0, total: 0 },
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Thu nhập của tôi"
        subtitle="Theo dõi thu nhập đã được thanh toán theo ngày, tuần, tháng và từng ca làm."
        action={
          <Link to="/companion/bookings">
            <Button variant="secondary">Quay lại ca làm</Button>
          </Link>
        }
      />

      <section className="rounded-[32px] border border-teal-100 bg-white/95 p-6 shadow-xl shadow-teal-900/10">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Hôm nay" value={money(stats.today)} />
          <StatCard label="Tuần này" value={money(stats.week)} tone="sky" />
          <StatCard label="Tháng này" value={money(stats.month)} tone="teal" />
          <StatCard label="Tổng đã nhận" value={money(stats.total)} tone="slate" />
        </div>
      </section>

      <section className="rounded-[32px] border border-teal-100 bg-white/95 p-6 shadow-xl shadow-teal-900/10">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-950">Lịch sử thu nhập</h2>
            <p className="mt-1 text-sm text-slate-500">Chỉ hiển thị các ca đã thanh toán.</p>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
            {paidBookings.length} ca đã trả tiền
          </span>
        </div>

        {loading ? <p className="mt-5 text-sm text-slate-500">Đang tải...</p> : null}
        {error ? <p className="mt-5 text-sm text-rose-600">{error}</p> : null}
        {!loading && paidBookings.length === 0 ? <EmptyState title="Chưa có thu nhập" /> : null}

        <div className="mt-5 grid gap-4">
          {paidBookings.map((booking) => (
            <Card key={booking._id} className="border-emerald-100 bg-white/95 shadow-lg shadow-emerald-900/5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-slate-950">{booking.serviceId?.name}</h3>
                    <StatusBadge status={booking.status} />
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {booking.elderProfileId?.fullName} • {dateTime(booking.startTime)}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-400">
                    Thanh toán: {dateTime(getPaidAt(booking))}
                  </p>
                </div>
                <div className="text-left md:text-right">
                  <p className="text-lg font-black text-emerald-700">{money(getEarning(booking))}</p>
                  <Link to={`/companion/bookings/${booking._id}`}>
                    <Button variant="secondary" className="mt-2 min-h-9 px-3 text-xs">Xem chi tiết</Button>
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
};

export default CompanionEarningsPage;
