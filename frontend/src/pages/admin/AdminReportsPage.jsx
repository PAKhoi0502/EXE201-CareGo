import {
  ArcElement,
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
import { useState } from "react";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import * as XLSX from "xlsx";
import { api } from "../../api/client.js";
import { StatusBadge } from "../../components/Ui.jsx";
import { useAsync } from "../../hooks/useAsync.js";
import { money } from "../../utils/format.js";

ChartJS.register(ArcElement, BarElement, CategoryScale, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip);

const statuses = ["pending", "accepted", "in_progress", "completed", "paid", "cancelled"];

const toDateInputValue = (date) => {
  const value = new Date(date);
  value.setMinutes(value.getMinutes() - value.getTimezoneOffset());
  return value.toISOString().slice(0, 10);
};

const getRecentRange = (days) => {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));

  return {
    from: toDateInputValue(start),
    to: toDateInputValue(end),
  };
};

const reportRangePresets = [
  { label: "Hôm nay", days: 1 },
  { label: "7 ngày gần nhất", days: 7 },
  { label: "30 ngày gần nhất", days: 30 },
  { label: "90 ngày gần nhất", days: 90 },
];

const isDateInRange = (value, range) => {
  if (!value) return false;

  const date = new Date(value);
  const from = range.from ? new Date(`${range.from}T00:00:00`) : null;
  const to = range.to ? new Date(`${range.to}T23:59:59.999`) : null;

  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
};

const getBaseAmount = (booking) => Number(booking.payment?.baseAmount ?? booking.totalAmount ?? 0);
const getPenaltyAmount = (booking) => Number(booking.payment?.penaltyAmount ?? 0);
const getPaidAmount = (booking) => Number(booking.payment?.paidAmount ?? booking.payment?.amount ?? getBaseAmount(booking));
const getPlatformFee = (booking) => Number(booking.payment?.platformFee ?? booking.platformFee ?? 0);
const getCompanionEarning = (booking) =>
  Number(booking.payment?.companionEarning ?? Math.max(getBaseAmount(booking) - getPlatformFee(booking), 0));
const getCareGoRevenue = (booking) => getPlatformFee(booking) + getPenaltyAmount(booking);

const makeMonthly = (bookings) => {
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (5 - index));
    return {
      key: `${date.getFullYear()}-${date.getMonth()}`,
      label: new Intl.DateTimeFormat("vi-VN", { month: "short" }).format(date),
      count: 0,
      revenue: 0,
      penalty: 0,
    };
  });

  bookings.forEach((booking) => {
    const date = new Date(booking.createdAt);
    const bucket = months.find((item) => item.key === `${date.getFullYear()}-${date.getMonth()}`);
    if (!bucket) return;
    bucket.count += 1;
    if (booking.status === "paid") {
      bucket.revenue += getPaidAmount(booking);
      bucket.penalty += getPenaltyAmount(booking);
    }
  });

  return months;
};

const makeDaily = (bookings, range) => {
  const start = range.from ? new Date(`${range.from}T00:00:00`) : new Date();
  const end = range.to ? new Date(`${range.to}T00:00:00`) : new Date();
  const days = [];

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return days;
  }

  const cursor = new Date(start);
  while (cursor <= end && days.length < 45) {
    const key = toDateInputValue(cursor);
    days.push({
      key,
      label: new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit" }).format(cursor),
      count: 0,
      caregoRevenue: 0,
      companionEarning: 0,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  bookings.forEach((booking) => {
    const key = toDateInputValue(booking.createdAt);
    const bucket = days.find((item) => item.key === key);
    if (!bucket) return;

    bucket.count += 1;
    if (booking.status === "paid") {
      bucket.caregoRevenue += getCareGoRevenue(booking);
      bucket.companionEarning += getCompanionEarning(booking);
    }
  });

  return days;
};

const topServices = (bookings) => {
  const stats = {};
  bookings.forEach((booking) => {
    const name = booking.serviceId?.name || "Khác";
    stats[name] ||= { name, count: 0, revenue: 0 };
    stats[name].count += 1;
    stats[name].revenue += getBaseAmount(booking);
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
      earning: 0,
    };
    stats[id].count += 1;
    if (booking.status === "paid") {
      stats[id].paid += 1;
      stats[id].earning += getCompanionEarning(booking);
    }
  });
  return Object.values(stats).sort((a, b) => b.count - a.count).slice(0, 6);
};

const formatDateTime = (value) => (value ? new Date(value).toLocaleString("vi-VN") : "");

const AdminReportsPage = () => {
  const [dateRange, setDateRange] = useState(() => getRecentRange(30));
  const { data: bookingsData, loading, error } = useAsync(() => api.get("/admin/bookings"), []);
  const { data: companionsData } = useAsync(() => api.get("/companions/admin/all"), []);
  const bookings = bookingsData?.bookings || [];
  const filteredBookings = bookings.filter((booking) => isDateInRange(booking.createdAt, dateRange));
  const companions = companionsData?.companions || [];
  const monthly = makeMonthly(filteredBookings);
  const daily = makeDaily(filteredBookings, dateRange);
  const services = topServices(filteredBookings);
  const companionRows = topCompanions(filteredBookings);
  const paidBookings = filteredBookings.filter((item) => item.status === "paid");

  const paidRevenue = paidBookings.reduce((sum, item) => sum + getPaidAmount(item), 0);
  const baseRevenue = paidBookings.reduce((sum, item) => sum + getBaseAmount(item), 0);
  const penaltyRevenue = paidBookings.reduce((sum, item) => sum + getPenaltyAmount(item), 0);
  const platformFee = paidBookings.reduce((sum, item) => sum + getPlatformFee(item), 0);
  const careGoRevenue = paidBookings.reduce((sum, item) => sum + getCareGoRevenue(item), 0);
  const completed = filteredBookings.filter((item) => ["completed", "paid"].includes(item.status)).length;
  const completionRate = filteredBookings.length ? Math.round((completed / filteredBookings.length) * 100) : 0;
  const missingGps = filteredBookings.filter((item) => !item.addressLocation?.lat).length;
  const pendingCompanions = companions.filter((item) => item.vettingStatus === "pending").length;

  const exportExcel = () => {
    const workbook = XLSX.utils.book_new();

    const summaryRows = [
      { label: "Tu ngay", value: dateRange.from },
      { label: "Den ngay", value: dateRange.to },
      { label: "Tong booking trong khoang", value: filteredBookings.length },
      { label: "Doanh thu paid", value: paidRevenue },
      { label: "Gia tri ca da thanh toan", value: baseRevenue },
      { label: "Phi nen tang", value: platformFee },
      { label: "Phi phat qua han", value: penaltyRevenue },
      { label: "CareGo thu", value: careGoRevenue },
      { label: "Ty le hoan thanh", value: `${completionRate}%` },
      { label: "Thieu GPS diem den", value: missingGps },
      { label: "Ho so cho duyet", value: pendingCompanions },
    ];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), "Tong quan");

    const monthlyRows = monthly.map((item) => ({
      thang: item.label,
      so_booking: item.count,
      doanh_thu_paid: item.revenue,
      phi_phat: item.penalty,
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
      thu_nhap: item.earning,
    }));
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(companionRowsExport), "Hieu suat companion");

    const bookingRows = filteredBookings.map((booking) => ({
      booking_id: booking._id,
      khach_hang: booking.customerId?.name || "",
      email_khach_hang: booking.customerId?.email || "",
      companion: booking.companionId?.name || "",
      dich_vu: booking.serviceId?.name || "",
      trang_thai: booking.status,
      tien_ca: getBaseAmount(booking),
      phi_nen_tang: getPlatformFee(booking),
      phi_phat: getPenaltyAmount(booking),
      tong_khach_tra: booking.status === "paid" ? getPaidAmount(booking) : 0,
      carego_thu: booking.status === "paid" ? getCareGoRevenue(booking) : 0,
      thu_nhap_companion: booking.status === "paid" ? getCompanionEarning(booking) : 0,
      ngay_tao: formatDateTime(booking.createdAt),
    }));
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(bookingRows), "Bookings");

    const fileName = `admin-report-${dateRange.from}-to-${dateRange.to}.xlsx`;
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
        data: statuses.map((status) => filteredBookings.filter((booking) => booking.status === status).length),
        backgroundColor: ["#f59e0b", "#0284c7", "#4f46e5", "#64748b", "#0f766e", "#e11d48"],
        borderRadius: 6,
      },
    ],
  };

  const dailyBookingData = {
    labels: daily.map((item) => item.label),
    datasets: [
      {
        label: "Booking",
        data: daily.map((item) => item.count),
        borderColor: "#0f766e",
        backgroundColor: "rgba(20, 184, 166, 0.18)",
        pointBackgroundColor: "#0f766e",
        pointRadius: 3,
        tension: 0.35,
        fill: true,
      },
    ],
  };

  const statusShareData = {
    labels: statuses,
    datasets: [
      {
        data: statuses.map((status) => filteredBookings.filter((booking) => booking.status === status).length),
        backgroundColor: ["#f59e0b", "#0284c7", "#4f46e5", "#64748b", "#0f766e", "#e11d48"],
        borderColor: "#ffffff",
        borderWidth: 3,
        hoverOffset: 8,
      },
    ],
  };

  const moneySplitData = {
    labels: daily.map((item) => item.label),
    datasets: [
      {
        label: "CareGo thu",
        data: daily.map((item) => Math.round((item.caregoRevenue / 1000000) * 10) / 10),
        backgroundColor: "rgba(15, 118, 110, 0.78)",
        borderRadius: 6,
      },
      {
        label: "Companion nhận",
        data: daily.map((item) => Math.round((item.companionEarning / 1000000) * 10) / 10),
        backgroundColor: "rgba(37, 99, 235, 0.68)",
        borderRadius: 6,
      },
    ],
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
        labels: { boxWidth: 10, padding: 12, font: { size: 11, weight: "700" } },
      },
    },
    cutout: "64%",
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

      <section className="overflow-hidden rounded-2xl border border-teal-100 bg-white shadow-xl shadow-teal-900/5">
        <div className="bg-gradient-to-r from-teal-700 via-teal-600 to-emerald-500 p-5 text-white">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-teal-100">
                Bộ lọc báo cáo
              </p>
              <h2 className="mt-1 text-xl font-black">Lọc dữ liệu theo ngày tạo booking</h2>
              <p className="mt-1 max-w-2xl text-sm font-medium text-teal-50">
                Doanh thu, biểu đồ, top dịch vụ, hiệu suất companion và file Excel sẽ tính theo khoảng ngày này.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDateRange(getRecentRange(30))}
              className="inline-flex min-h-10 items-center justify-center rounded-full bg-white px-5 text-sm font-black text-teal-700 shadow-sm transition hover:bg-teal-50"
            >
              Đặt lại 30 ngày
            </button>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_auto] xl:items-end">
            <div className="flex flex-wrap gap-2">
              {reportRangePresets.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setDateRange(getRecentRange(preset.days))}
                  className="rounded-full border border-white/25 bg-white/10 px-4 py-2 text-xs font-black text-white transition hover:bg-white hover:text-teal-700"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-xs font-bold text-teal-50">
                Từ ngày
                <input
                  type="date"
                  value={dateRange.from}
                  onChange={(event) => setDateRange((current) => ({ ...current, from: event.target.value }))}
                  className="min-h-10 rounded-xl border border-white/20 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-white/60"
                />
              </label>
              <label className="grid gap-1 text-xs font-bold text-teal-50">
                Đến ngày
                <input
                  type="date"
                  value={dateRange.to}
                  onChange={(event) => setDateRange((current) => ({ ...current, to: event.target.value }))}
                  className="min-h-10 rounded-xl border border-white/20 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-white/60"
                />
              </label>
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-5 md:grid-cols-3">
          <div className="rounded-2xl border border-teal-100 bg-teal-50 p-4">
            <p className="text-sm font-semibold text-teal-700">Booking trong khoảng</p>
            <strong className="mt-2 block text-3xl font-black text-teal-800">{filteredBookings.length}</strong>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
            <p className="text-sm font-semibold text-emerald-700">CareGo thu trong khoảng</p>
            <strong className="mt-2 block text-2xl font-black text-emerald-800">{money(careGoRevenue)}</strong>
          </div>
          <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4">
            <p className="text-sm font-semibold text-sky-700">Khoảng lọc</p>
            <strong className="mt-2 block text-sm font-black text-sky-800">
              {dateRange.from} - {dateRange.to}
            </strong>
          </div>
        </div>
      </section>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-6">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="text-xs font-medium text-slate-400">Doanh thu paid</span>
          <p className="mt-2 text-xl font-bold text-teal-700">{money(paidRevenue)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="text-xs font-medium text-slate-400">CareGo thu</span>
          <p className="mt-2 text-xl font-bold text-emerald-700">{money(careGoRevenue)}</p>
          <p className="mt-1 text-[11px] text-slate-400">Phí nền tảng: {money(platformFee)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="text-xs font-medium text-slate-400">Phí phạt</span>
          <p className="mt-2 text-xl font-bold text-rose-700">{money(penaltyRevenue)}</p>
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

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="rounded-2xl border border-teal-100 bg-white p-5 shadow-xl shadow-teal-900/5 xl:col-span-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="font-bold text-slate-900">Booking theo ngày</h2>
              <p className="mt-1 text-xs text-slate-400">
                Theo dõi nhu cầu đặt lịch trong khoảng ngày đang lọc.
              </p>
            </div>
            <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-black text-teal-700">
              {filteredBookings.length} booking
            </span>
          </div>
          <div className="mt-4 h-72">
            <Line data={dailyBookingData} options={chartOptions} />
          </div>
        </section>

        <section className="rounded-2xl border border-teal-100 bg-white p-5 shadow-xl shadow-teal-900/5">
          <h2 className="font-bold text-slate-900">Tỷ lệ trạng thái booking</h2>
          <p className="mt-1 text-xs text-slate-400">
            Nhìn nhanh pending, đang chạy, hoàn thành, đã thanh toán và hủy.
          </p>
          <div className="mt-4 h-72">
            <Doughnut data={statusShareData} options={doughnutOptions} />
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-teal-100 bg-white p-5 shadow-xl shadow-teal-900/5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-bold text-slate-900">CareGo thu vs Companion nhận</h2>
            <p className="mt-1 text-xs text-slate-400">
              Chỉ tính các booking đã thanh toán, đơn vị hiển thị theo triệu VND.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-black">
            <span className="rounded-full bg-teal-50 px-3 py-1 text-teal-700">
              CareGo: {money(careGoRevenue)}
            </span>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">
              Companion: {money(paidBookings.reduce((sum, item) => sum + getCompanionEarning(item), 0))}
            </span>
          </div>
        </div>
        <div className="mt-4 h-80">
          <Bar data={moneySplitData} options={chartOptions} />
        </div>
      </section>

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
                <th className="p-4 text-right">Thu nhập</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {companionRows.map((item) => (
                <tr key={item.id}>
                  <td className="p-4 font-semibold text-slate-800">{item.name}</td>
                  <td className="p-4">{item.count}</td>
                  <td className="p-4">{item.paid}</td>
                  <td className="p-4 text-right font-bold text-teal-700">{money(item.earning)}</td>
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
              {filteredBookings.filter((booking) => booking.status === "cancelled").length} booking đang cancelled.
            </p>
            <StatusBadge status={filteredBookings.some((booking) => booking.status === "cancelled") ? "cancelled" : "approved"} />
          </div>
        </div>
      </section>
    </div>
  );
};

export default AdminReportsPage;
