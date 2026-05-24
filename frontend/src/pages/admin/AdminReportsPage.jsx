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
import * as XLSX from "xlsx";
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
    const name = booking.serviceId?.name || "Khác";
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
      name: booking.companionId?.name || "Chưa có companion",
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

const formatDateTime = (value) => (value ? new Date(value).toLocaleString("vi-VN") : "");

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

  const exportExcel = () => {
    const workbook = XLSX.utils.book_new();

    const summaryRows = [
      { label: "Doanh thu paid", value: paidRevenue },
      { label: "Phi nen tang", value: platformFee },
      { label: "Ty le hoan thanh", value: `${completionRate}%` },
      { label: "Thieu GPS diem den", value: missingGps },
      { label: "Ho so cho duyet", value: pendingCompanions },
    ];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), "Tong quan");

    const monthlyRows = monthly.map((item) => ({
      thang: item.label,
      so_booking: item.count,
      doanh_thu_paid: item.revenue,
    }));
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(monthlyRows), "Doanh thu theo thang");

    const serviceRows = services.map((item) => ({
      dich_vu: item.name,
      so_booking: item.count,
      tong_gia_tri: item.revenue,
    }));
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(serviceRows), "Top dich vu");

    const companionRowsExport = companionRows.map((item) => ({
      companion: item.name,
      so_ca: item.count,
      paid: item.paid,
      doanh_thu: item.revenue,
    }));
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(companionRowsExport), "Hieu suat companion");

    const bookingRows = bookings.map((booking) => ({
      booking_id: booking._id,
      khach_hang: booking.customerId?.name || "",
      email_khach_hang: booking.customerId?.email || "",
      companion: booking.companionId?.name || "",
      dich_vu: booking.serviceId?.name || "",
      trang_thai: booking.status,
      tong_tien: booking.totalAmount || 0,
      phi_nen_tang: booking.platformFee || 0,
      ngay_tao: formatDateTime(booking.createdAt),
    }));
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(bookingRows), "Bookings");

    const fileName = `admin-report-${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

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
        label: "Doanh thu paid (triệu VND)",
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
        label: "Số booking",
        data: statuses.map((status) => bookings.filter((booking) => booking.status === status).length),
        backgroundColor: ["#f59e0b", "#0284c7", "#4f46e5", "#64748b", "#0f766e", "#e11d48"],
        borderRadius: 6,
      },
    ],
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Báo cáo vận hành</h1>
          <p className="mt-1 text-sm text-slate-500">Tổng hợp doanh thu, booking, companion và cảnh báo chất lượng.</p>
        </div>
        <button
          type="button"
          onClick={exportExcel}
          className="inline-flex items-center justify-center rounded-xl border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-bold text-teal-700 transition hover:border-teal-300 hover:bg-teal-100"
        >
          Xuất Excel
        </button>
      </div>

      {loading ? <p className="text-sm text-slate-500">Đang tải báo cáo...</p> : null}
      {error ? <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="text-xs font-medium text-slate-400">Doanh thu paid</span>
          <p className="mt-2 text-xl font-bold text-teal-700">{money(paidRevenue)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="text-xs font-medium text-slate-400">Phí nền tảng</span>
          <p className="mt-2 text-xl font-bold text-emerald-700">{money(platformFee)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="text-xs font-medium text-slate-400">Tỷ lệ hoàn thành</span>
          <p className="mt-2 text-xl font-bold text-blue-700">{completionRate}%</p>
        </div>
        <div className="rounded-xl border-l-4 border-amber-500 bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <span className="text-xs font-medium text-amber-600">Thiếu GPS điểm đến</span>
          <p className="mt-2 text-xl font-bold text-slate-900">{missingGps}</p>
        </div>
        <div className="rounded-xl border-l-4 border-rose-500 bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <span className="text-xs font-medium text-rose-600">Hồ sơ chờ duyệt</span>
          <p className="mt-2 text-xl font-bold text-slate-900">{pendingCompanions}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-bold text-slate-900">Doanh thu theo tháng</h2>
          <p className="mt-1 text-xs text-slate-400">Chỉ tính booking đã thanh toán.</p>
          <div className="mt-4 h-72">
            <Line data={revenueData} options={chartOptions} />
          </div>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-bold text-slate-900">Booking theo trạng thái</h2>
          <p className="mt-1 text-xs text-slate-400">Theo dõi backlog và chất lượng vận hành.</p>
          <div className="mt-4 h-72">
            <Bar data={statusData} options={chartOptions} />
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50/70 p-5">
            <h2 className="font-bold text-slate-900">Top dịch vụ</h2>
            <p className="mt-1 text-xs text-slate-400">Dịch vụ có nhiều booking nhất.</p>
          </div>
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400">
                <th className="p-4">Dịch vụ</th>
                <th className="p-4">Booking</th>
                <th className="p-4 text-right">Tổng giá trị</th>
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
                  <td colSpan="3" className="p-6 text-center text-slate-400">Chưa có dữ liệu.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50/70 p-5">
            <h2 className="font-bold text-slate-900">Hiệu suất companion</h2>
            <p className="mt-1 text-xs text-slate-400">Xếp theo số ca được gán.</p>
          </div>
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400">
                <th className="p-4">Companion</th>
                <th className="p-4">Số ca</th>
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
                  <td colSpan="4" className="p-6 text-center text-slate-400">Chưa có dữ liệu.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
      </div>

      <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5 shadow-sm">
        <h2 className="font-bold text-rose-800">Cảnh báo cần theo dõi</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl bg-white p-4 ring-1 ring-rose-100">
            <p className="text-sm font-semibold text-slate-800">Booking thiếu GPS điểm đến</p>
            <p className="mt-1 text-xs text-slate-500">Cần yêu cầu customer ghim địa chỉ khi đặt lịch mới.</p>
            <StatusBadge status={missingGps ? "pending" : "approved"} />
          </div>
          <div className="rounded-xl bg-white p-4 ring-1 ring-rose-100">
            <p className="text-sm font-semibold text-slate-800">Hồ sơ companion chờ duyệt</p>
            <p className="mt-1 text-xs text-slate-500">Ảnh hưởng đến nguồn cung ca chăm sóc.</p>
            <StatusBadge status={pendingCompanions ? "pending" : "approved"} />
          </div>
          <div className="rounded-xl bg-white p-4 ring-1 ring-rose-100">
            <p className="text-sm font-semibold text-slate-800">Booking bị hủy</p>
            <p className="mt-1 text-xs text-slate-500">
              {bookings.filter((booking) => booking.status === "cancelled").length} booking đang cancelled.
            </p>
            <StatusBadge status={bookings.some((booking) => booking.status === "cancelled") ? "cancelled" : "approved"} />
          </div>
        </div>
      </section>
    </div>
  );
};

export default AdminReportsPage;
