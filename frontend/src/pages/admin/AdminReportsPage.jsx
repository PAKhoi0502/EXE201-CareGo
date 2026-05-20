import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { Bar, Line } from "react-chartjs-2";
import { api } from "../../api/client.js";
import { StatusBadge } from "../../components/Ui.jsx";
import { useAsync } from "../../hooks/useAsync.js";
import { money } from "../../utils/format.js";

ChartJS.register(BarElement, CategoryScale, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip);

const statuses = ["pending", "accepted", "in_progress", "completed", "paid", "cancelled"];

const makeMonthly = (bookings) => {
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (5 - index));
    return {
      key: `${date.getFullYear()}-${date.getMonth()}`,
      label: new Intl.DateTimeFormat("vi-VN", { month: "short" }).format(date),
      count: 0,
      revenue: 0,
    };
  });

  bookings.forEach((booking) => {
    const date = new Date(booking.createdAt);
    const bucket = months.find((item) => item.key === `${date.getFullYear()}-${date.getMonth()}`);
    if (!bucket) return;
    bucket.count += 1;
    if (booking.status === "paid") bucket.revenue += booking.totalAmount || 0;
  });

  return months;
};

const topServices = (bookings) => {
  const stats = {};
  bookings.forEach((booking) => {
    const name = booking.serviceId?.name || "Khac";
    stats[name] ||= { name, count: 0, revenue: 0 };
    stats[name].count += 1;
    stats[name].revenue += booking.totalAmount || 0;
  });
  return Object.values(stats).sort((a, b) => b.count - a.count).slice(0, 5);
};

const topCompanions = (bookings) => {
  const stats = {};
  bookings.forEach((booking) => {
    const id = booking.companionId?._id || booking.companionId?.email || "unknown";
    stats[id] ||= {
      id,
      name: booking.companionId?.name || "Chua co companion",
      count: 0,
      paid: 0,
      revenue: 0,
    };
    stats[id].count += 1;
    if (booking.status === "paid") {
      stats[id].paid += 1;
      stats[id].revenue += booking.totalAmount || 0;
    }
  });
  return Object.values(stats).sort((a, b) => b.count - a.count).slice(0, 6);
};

const AdminReportsPage = () => {
  const { data: bookingsData, loading, error } = useAsync(() => api.get("/admin/bookings"), []);
  const { data: companionsData } = useAsync(() => api.get("/companions/admin/all"), []);
  const bookings = bookingsData?.bookings || [];
  const companions = companionsData?.companions || [];
  const monthly = makeMonthly(bookings);
  const services = topServices(bookings);
  const companionRows = topCompanions(bookings);

  const paidRevenue = bookings.filter((item) => item.status === "paid").reduce((sum, item) => sum + (item.totalAmount || 0), 0);
  const platformFee = bookings.reduce((sum, item) => sum + (item.platformFee || 0), 0);
  const completed = bookings.filter((item) => ["completed", "paid"].includes(item.status)).length;
  const completionRate = bookings.length ? Math.round((completed / bookings.length) * 100) : 0;
  const missingGps = bookings.filter((item) => !item.addressLocation?.lat).length;
  const pendingCompanions = companions.filter((item) => item.vettingStatus === "pending").length;

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: "top", labels: { boxWidth: 12, font: { size: 11 } } } },
    scales: {
      y: { grid: { color: "#f1f5f9" } },
      x: { grid: { display: false } },
    },
  };

  const revenueData = {
    labels: monthly.map((item) => item.label),
    datasets: [
      {
        label: "Doanh thu paid (trieu VND)",
        data: monthly.map((item) => Math.round((item.revenue / 1000000) * 10) / 10),
        borderColor: "#0f766e",
        backgroundColor: "rgba(15, 118, 110, 0.16)",
        tension: 0.35,
        fill: true,
      },
    ],
  };

  const statusData = {
    labels: statuses,
    datasets: [
      {
        label: "So booking",
        data: statuses.map((status) => bookings.filter((booking) => booking.status === status).length),
        backgroundColor: ["#f59e0b", "#0284c7", "#4f46e5", "#64748b", "#0f766e", "#e11d48"],
        borderRadius: 6,
      },
    ],
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Bao cao van hanh</h1>
        <p className="mt-1 text-sm text-slate-500">Tong hop doanh thu, booking, companion va canh bao chat luong.</p>
      </div>

      {loading ? <p className="text-sm text-slate-500">Dang tai bao cao...</p> : null}
      {error ? <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="text-xs font-medium text-slate-400">Doanh thu paid</span>
          <p className="mt-2 text-xl font-bold text-teal-700">{money(paidRevenue)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="text-xs font-medium text-slate-400">Phi nen tang</span>
          <p className="mt-2 text-xl font-bold text-emerald-700">{money(platformFee)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="text-xs font-medium text-slate-400">Ty le hoan thanh</span>
          <p className="mt-2 text-xl font-bold text-blue-700">{completionRate}%</p>
        </div>
        <div className="rounded-xl border-l-4 border-amber-500 bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <span className="text-xs font-medium text-amber-600">Thieu GPS diem den</span>
          <p className="mt-2 text-xl font-bold text-slate-900">{missingGps}</p>
        </div>
        <div className="rounded-xl border-l-4 border-rose-500 bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <span className="text-xs font-medium text-rose-600">Ho so cho duyet</span>
          <p className="mt-2 text-xl font-bold text-slate-900">{pendingCompanions}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-bold text-slate-900">Doanh thu theo thang</h2>
          <p className="mt-1 text-xs text-slate-400">Chi tinh booking da thanh toan.</p>
          <div className="mt-4 h-72">
            <Line data={revenueData} options={chartOptions} />
          </div>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-bold text-slate-900">Booking theo trang thai</h2>
          <p className="mt-1 text-xs text-slate-400">Theo doi backlog va chat luong van hanh.</p>
          <div className="mt-4 h-72">
            <Bar data={statusData} options={chartOptions} />
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50/70 p-5">
            <h2 className="font-bold text-slate-900">Top dich vu</h2>
            <p className="mt-1 text-xs text-slate-400">Dich vu co nhieu booking nhat.</p>
          </div>
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400">
                <th className="p-4">Dich vu</th>
                <th className="p-4">Booking</th>
                <th className="p-4 text-right">Tong gia tri</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {services.map((item) => (
                <tr key={item.name}>
                  <td className="p-4 font-semibold text-slate-800">{item.name}</td>
                  <td className="p-4">{item.count}</td>
                  <td className="p-4 text-right font-bold text-teal-700">{money(item.revenue)}</td>
                </tr>
              ))}
              {!services.length ? (
                <tr>
                  <td colSpan="3" className="p-6 text-center text-slate-400">Chua co du lieu.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50/70 p-5">
            <h2 className="font-bold text-slate-900">Hieu suat companion</h2>
            <p className="mt-1 text-xs text-slate-400">Xep theo so ca duoc gan.</p>
          </div>
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400">
                <th className="p-4">Companion</th>
                <th className="p-4">So ca</th>
                <th className="p-4">Paid</th>
                <th className="p-4 text-right">Doanh thu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {companionRows.map((item) => (
                <tr key={item.id}>
                  <td className="p-4 font-semibold text-slate-800">{item.name}</td>
                  <td className="p-4">{item.count}</td>
                  <td className="p-4">{item.paid}</td>
                  <td className="p-4 text-right font-bold text-teal-700">{money(item.revenue)}</td>
                </tr>
              ))}
              {!companionRows.length ? (
                <tr>
                  <td colSpan="4" className="p-6 text-center text-slate-400">Chua co du lieu.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
      </div>

      <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5 shadow-sm">
        <h2 className="font-bold text-rose-800">Canh bao can theo doi</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl bg-white p-4 ring-1 ring-rose-100">
            <p className="text-sm font-semibold text-slate-800">Booking thieu GPS diem den</p>
            <p className="mt-1 text-xs text-slate-500">Can yeu cau customer ghim dia chi khi dat lich moi.</p>
            <StatusBadge status={missingGps ? "pending" : "approved"} />
          </div>
          <div className="rounded-xl bg-white p-4 ring-1 ring-rose-100">
            <p className="text-sm font-semibold text-slate-800">Ho so companion cho duyet</p>
            <p className="mt-1 text-xs text-slate-500">Anh huong den nguon cung ca cham soc.</p>
            <StatusBadge status={pendingCompanions ? "pending" : "approved"} />
          </div>
          <div className="rounded-xl bg-white p-4 ring-1 ring-rose-100">
            <p className="text-sm font-semibold text-slate-800">Booking bi huy</p>
            <p className="mt-1 text-xs text-slate-500">
              {bookings.filter((booking) => booking.status === "cancelled").length} booking dang cancelled.
            </p>
            <StatusBadge status={bookings.some((booking) => booking.status === "cancelled") ? "cancelled" : "approved"} />
          </div>
        </div>
      </section>
    </div>
  );
};

export default AdminReportsPage;
