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
import { api } from "../../api/client.js";
import { StatusBadge } from "../../components/Ui.jsx";
import { useAsync } from "../../hooks/useAsync.js";
import { money } from "../../utils/format.js";

ChartJS.register(ArcElement, BarElement, CategoryScale, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip);

const statuses = ["pending", "accepted", "in_progress", "completed", "paid", "cancelled"];
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const VIETNAM_TIME_ZONE = "Asia/Ho_Chi_Minh";

const toDateInputValue = (date) => {
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: VIETNAM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

const getRecentRange = (days) => {
  const end = new Date();
  const start = new Date(end.getTime() - (days - 1) * MS_PER_DAY);

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
const REPORT_PAGE_SIZE = 25;
const DEFAULT_REPORT_FILTERS = {
  status: "all",
  serviceId: "all",
  companionId: "all",
  customerId: "all",
  bookingId: "",
};
const PAYMENT_METHOD_LABELS = {
  cash: "Tiền mặt",
  banking: "Chuyển khoản",
  momo: "MoMo",
  vnpay: "VNPay",
  prototype: "Dữ liệu mẫu",
  payos: "PayOS",
  unknown: "Không xác định",
};

const getPaidPayment = (booking) => (booking.payment?.status === "paid" ? booking.payment : null);
const getBaseAmount = (booking) => Number(booking.payment?.baseAmount || booking.payment?.amount || booking.totalAmount || 0);
const getPenaltyAmount = (booking) => Number(getPaidPayment(booking)?.penaltyAmount || 0);
const getPaidAmount = (booking) => {
  const payment = getPaidPayment(booking);
  return Number(payment?.paidAmount || payment?.amount || 0);
};
const getPlatformFee = (booking) => Number(getPaidPayment(booking)?.platformFee || 0);
const getCompanionEarning = (booking) => {
  const payment = getPaidPayment(booking);
  if (!payment) return 0;
  return Number(payment.companionEarning ?? Math.max(getBaseAmount(booking) - getPlatformFee(booking), 0));
};
const getCareGoRevenue = (booking) => getPlatformFee(booking) + getPenaltyAmount(booking);
const getSummaryNumber = (summary, key) => Number(summary?.[key] || 0);
const getRelativeChange = (current, previous) => {
  if (!previous) return current ? 100 : 0;
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
};
const formatChange = (value, suffix = "%") => `${value > 0 ? "+" : ""}${value}${suffix}`;

const formatDateTime = (value) => value
  ? new Intl.DateTimeFormat("vi-VN", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: VIETNAM_TIME_ZONE,
    }).format(new Date(value))
  : "";

const AdminReportsPage = () => {
  const [dateRange, setDateRange] = useState(() => getRecentRange(30));
  const [draftFilters, setDraftFilters] = useState(DEFAULT_REPORT_FILTERS);
  const [filters, setFilters] = useState(DEFAULT_REPORT_FILTERS);
  const [reportPage, setReportPage] = useState(1);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState("");
  const buildReportPath = ({ page = reportPage, exportAll = false } = {}) => {
    const params = new URLSearchParams({
      from: dateRange.from,
      to: dateRange.to,
      page: String(page),
      limit: String(REPORT_PAGE_SIZE),
    });
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== "all") params.set(key, value);
    });
    if (exportAll) params.set("export", "true");
    return `/admin/reports?${params.toString()}`;
  };
  const reportPath = buildReportPath();
  const { data: reportData, loading, error } = useAsync(() => api.get(reportPath), [reportPath]);
  const filteredBookings = reportData?.bookings || [];
  const monthly = reportData?.monthly || [];
  const daily = reportData?.daily || [];
  const serviceStats = reportData?.services || [];
  const companionRows = reportData?.companionRows || [];
  const statusCounts = reportData?.statusCounts || [];
  const paymentMethods = reportData?.paymentMethods || [];
  const reviewData = reportData?.reviews || {};
  const filterOptions = reportData?.filterOptions || {};
  const pagination = reportData?.pagination || {};
  const summary = reportData?.summary || {};
  const previousSummary = reportData?.previousPeriod?.summary || {};
  const previousRange = reportData?.previousPeriod?.range || {};
  const currentSnapshot = reportData?.currentSnapshot || {};

  const totalBookings = getSummaryNumber(summary, "totalBookings");
  const paidRevenue = getSummaryNumber(summary, "paidRevenue");
  const penaltyRevenue = getSummaryNumber(summary, "penaltyRevenue");
  const platformFee = getSummaryNumber(summary, "platformFee");
  const careGoRevenue = getSummaryNumber(summary, "careGoRevenue");
  const companionEarning = getSummaryNumber(summary, "companionEarning");
  const completionRate = getSummaryNumber(summary, "completionRate");
  const cancellationRate = getSummaryNumber(summary, "cancellationRate");
  const averageBookingValue = getSummaryNumber(summary, "averageBookingValue");
  const utilizationRate = getSummaryNumber(summary, "utilizationRate");
  const ratingAverage = getSummaryNumber(summary, "ratingAverage");
  const reviewCount = getSummaryNumber(summary, "reviewCount");
  const missingGps = getSummaryNumber(summary, "missingGps");
  const pendingCompanions = getSummaryNumber(currentSnapshot, "pendingCompanions");
  const cancelledBookings = getSummaryNumber(summary, "cancelled");
  const currentPage = Number(pagination.page || reportPage);
  const pageSize = Number(pagination.limit || REPORT_PAGE_SIZE);
  const totalPages = Math.max(1, Number(pagination.totalPages || 1));
  const detailStart = filteredBookings.length ? (currentPage - 1) * pageSize + 1 : 0;
  const detailEnd = filteredBookings.length ? detailStart + filteredBookings.length - 1 : 0;
  const getStatusCount = (status) =>
    Number(statusCounts.find((item) => item.status === status)?.count || 0);
  const setDateRangeAndResetPage = (nextRange) => {
    setReportPage(1);
    setDateRange(nextRange);
  };
  const updateDateRangeField = (field, value) => {
    setReportPage(1);
    setDateRange((current) => ({ ...current, [field]: value }));
  };
  const updateDraftFilter = (field, value) => {
    setDraftFilters((current) => ({ ...current, [field]: value }));
  };
  const applyFilters = (event) => {
    event.preventDefault();
    setReportPage(1);
    setFilters(draftFilters);
  };
  const clearFilters = () => {
    setReportPage(1);
    setDraftFilters(DEFAULT_REPORT_FILTERS);
    setFilters(DEFAULT_REPORT_FILTERS);
  };
  const activeFilterCount = Object.values(filters).filter((value) => value && value !== "all").length;

  const exportExcel = async () => {
    setExportLoading(true);
    setExportError("");
    try {
      const exportData = await api.get(buildReportPath({ page: 1, exportAll: true }));
      const XLSX = await import("xlsx");
      const workbook = XLSX.utils.book_new();
      const exportSummary = exportData.summary || {};
      const exportPrevious = exportData.previousPeriod?.summary || {};
      const exportBookings = exportData.bookings || [];

      const summaryRows = [
        { label: "Tu ngay", value: dateRange.from },
        { label: "Den ngay", value: dateRange.to },
        { label: "Tong booking", value: getSummaryNumber(exportSummary, "totalBookings") },
        { label: "Doanh thu paid", value: getSummaryNumber(exportSummary, "paidRevenue") },
        { label: "CareGo thu", value: getSummaryNumber(exportSummary, "careGoRevenue") },
        { label: "Companion nhan", value: getSummaryNumber(exportSummary, "companionEarning") },
        { label: "Gia tri booking trung binh", value: getSummaryNumber(exportSummary, "averageBookingValue") },
        { label: "Ty le hoan thanh", value: `${getSummaryNumber(exportSummary, "completionRate")}%` },
        { label: "Ty le huy", value: `${getSummaryNumber(exportSummary, "cancellationRate")}%` },
        { label: "Utilization companion", value: `${getSummaryNumber(exportSummary, "utilizationRate")}%` },
        { label: "Diem danh gia trung binh", value: getSummaryNumber(exportSummary, "ratingAverage") },
        { label: "So danh gia", value: getSummaryNumber(exportSummary, "reviewCount") },
        { label: "Thieu GPS diem den", value: getSummaryNumber(exportSummary, "missingGps") },
        { label: "Ho so companion cho duyet (hien tai)", value: getSummaryNumber(exportData.currentSnapshot, "pendingCompanions") },
        { label: "Tong dong booking trong file", value: exportBookings.length },
      ];
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), "Tong quan");

      const comparisonRows = [
        ["totalBookings", "Tong booking"],
        ["careGoRevenue", "CareGo thu"],
        ["averageBookingValue", "Gia tri booking TB"],
        ["completionRate", "Ty le hoan thanh"],
        ["cancellationRate", "Ty le huy"],
        ["utilizationRate", "Utilization"],
        ["ratingAverage", "Diem danh gia TB"],
      ].map(([key, label]) => ({
        chi_so: label,
        ky_hien_tai: getSummaryNumber(exportSummary, key),
        ky_truoc: getSummaryNumber(exportPrevious, key),
        thay_doi_phan_tram: getRelativeChange(
          getSummaryNumber(exportSummary, key),
          getSummaryNumber(exportPrevious, key),
        ),
      }));
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(comparisonRows), "So sanh ky truoc");

      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet((exportData.daily || []).map((item) => ({
        ngay: item.key,
        so_booking: item.count,
        carego_thu: item.caregoRevenue,
        companion_nhan: item.companionEarning,
      }))), "Theo ngay");
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet((exportData.monthly || []).map((item) => ({
        thang: item.key,
        so_booking: item.count,
        doanh_thu_paid: item.revenue,
        phi_phat: item.penalty,
      }))), "Theo thang");
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet((exportData.paymentMethods || []).map((item) => ({
        phuong_thuc: PAYMENT_METHOD_LABELS[item.method] || item.method,
        so_giao_dich: item.count,
        tong_tien: item.amount,
      }))), "Phuong thuc TT");
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet((exportData.reviews?.distribution || []).map((item) => ({
        so_sao: item.rating,
        so_danh_gia: item.count,
      }))), "Danh gia");
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet((exportData.services || []).map((item) => ({
        dich_vu: item.name,
        so_booking: item.count,
        tong_gia_tri: item.revenue,
      }))), "Top dich vu");
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet((exportData.companionRows || []).map((item) => ({
        companion: item.name,
        so_ca: item.count,
        paid: item.paid,
        gio_duoc_gan: item.assignedHours,
        gio_kha_dung: item.availableHours,
        utilization: item.utilizationRate,
        ty_le_gio_hoan_thanh: item.completionHoursRate,
        diem_danh_gia: item.ratingAverage,
        thu_nhap: item.earning,
      }))), "Hieu suat companion");

      const bookingRows = exportBookings.map((booking) => ({
        booking_id: booking._id,
        khach_hang: booking.customerId?.name || "",
        email_khach_hang: booking.customerId?.email || "",
        companion: booking.companionId?.name || "",
        dich_vu: booking.serviceId?.name || "",
        trang_thai: booking.status,
        thoi_luong_gio: booking.durationHours,
        tien_ca: getBaseAmount(booking),
        phi_nen_tang: getPlatformFee(booking),
        phi_phat: getPenaltyAmount(booking),
        payment_status: booking.payment?.status || "",
        payment_method: booking.payment?.method || "",
        tong_khach_tra: getPaidPayment(booking) ? getPaidAmount(booking) : 0,
        carego_thu: getPaidPayment(booking) ? getCareGoRevenue(booking) : 0,
        thu_nhap_companion: getPaidPayment(booking) ? getCompanionEarning(booking) : 0,
        ngay_thuc_hien: formatDateTime(booking.startTime),
        ngay_tao: formatDateTime(booking.createdAt),
      }));
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(bookingRows), "Bookings all");

      XLSX.writeFile(workbook, `admin-report-${dateRange.from}-to-${dateRange.to}.xlsx`);
    } catch (exportFailure) {
      setExportError(exportFailure.message);
    } finally {
      setExportLoading(false);
    }
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

  const dailyChartOptions = {
    ...chartOptions,
    scales: {
      ...chartOptions.scales,
      y: {
        beginAtZero: true,
        suggestedMax: 10,
        ticks: {
          precision: 0,
          stepSize: 1,
        },
        grid: { color: "#f1f5f9" },
      },
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

  const paymentMethodData = {
    labels: paymentMethods.map((item) => PAYMENT_METHOD_LABELS[item.method] || item.method),
    datasets: [
      {
        label: "Giao dịch paid",
        data: paymentMethods.map((item) => item.count),
        backgroundColor: ["#0f766e", "#2563eb", "#7c3aed", "#db2777", "#ea580c", "#64748b"],
        borderRadius: 6,
      },
    ],
  };

  const reviewRatingData = {
    labels: (reviewData.distribution || []).map((item) => `${item.rating} sao`),
    datasets: [
      {
        label: "Số đánh giá",
        data: (reviewData.distribution || []).map((item) => item.count),
        backgroundColor: ["#ef4444", "#f97316", "#f59e0b", "#14b8a6", "#0f766e"],
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
        tension: 0.2,
        fill: true,
      },
    ],
  };

  const statusShareData = {
    labels: statuses,
    datasets: [
      {
        data: statuses.map((status) => getStatusCount(status)),
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
  const comparisonMetrics = [
    {
      key: "totalBookings",
      label: "Tổng booking",
      current: totalBookings,
      previous: getSummaryNumber(previousSummary, "totalBookings"),
      format: (value) => String(value),
    },
    {
      key: "careGoRevenue",
      label: "CareGo thu",
      current: careGoRevenue,
      previous: getSummaryNumber(previousSummary, "careGoRevenue"),
      format: money,
    },
    {
      key: "averageBookingValue",
      label: "Giá trị booking TB",
      current: averageBookingValue,
      previous: getSummaryNumber(previousSummary, "averageBookingValue"),
      format: money,
    },
    {
      key: "cancellationRate",
      label: "Tỷ lệ hủy",
      current: cancellationRate,
      previous: getSummaryNumber(previousSummary, "cancellationRate"),
      format: (value) => `${value}%`,
      rate: true,
    },
    {
      key: "utilizationRate",
      label: "Utilization",
      current: utilizationRate,
      previous: getSummaryNumber(previousSummary, "utilizationRate"),
      format: (value) => `${value}%`,
      rate: true,
    },
  ];

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
          disabled={exportLoading || loading}
          className="inline-flex items-center justify-center rounded-xl border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-bold text-teal-700 transition hover:border-teal-300 hover:bg-teal-100"
        >
          {exportLoading ? "Đang xuất toàn bộ..." : "Xuất Excel toàn bộ"}
        </button>
      </div>

      {loading ? <p className="text-sm text-slate-500">Đang tải báo cáo...</p> : null}
      {error ? <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
      {exportError ? <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{exportError}</p> : null}

      <section className="overflow-hidden rounded-2xl border border-teal-100 bg-white shadow-xl shadow-teal-900/5">
        <div className="bg-gradient-to-r from-teal-700 via-teal-600 to-emerald-500 p-5 text-white">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-teal-100">
                Bộ lọc báo cáo
              </p>
              <h2 className="mt-1 text-xl font-black">Lọc dữ liệu theo ngày thực hiện booking</h2>
              <p className="mt-1 max-w-2xl text-sm font-medium text-teal-50">
                Doanh thu, biểu đồ, top dịch vụ, hiệu suất companion và file Excel sẽ tính theo khoảng ngày này.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDateRangeAndResetPage(getRecentRange(30))}
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
                  onClick={() => setDateRangeAndResetPage(getRecentRange(preset.days))}
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
                  onChange={(event) => updateDateRangeField("from", event.target.value)}
                  className="min-h-10 rounded-xl border border-white/20 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-white/60"
                />
              </label>
              <label className="grid gap-1 text-xs font-bold text-teal-50">
                Đến ngày
                <input
                  type="date"
                  value={dateRange.to}
                  onChange={(event) => updateDateRangeField("to", event.target.value)}
                  className="min-h-10 rounded-xl border border-white/20 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-white/60"
                />
              </label>
            </div>
          </div>

          <form className="mt-5 grid gap-3 rounded-2xl border border-white/20 bg-white/10 p-4 md:grid-cols-2 xl:grid-cols-5" onSubmit={applyFilters}>
            <label className="grid gap-1 text-xs font-bold text-teal-50">
              Trạng thái
              <select value={draftFilters.status} onChange={(event) => updateDraftFilter("status", event.target.value)} className="min-h-10 rounded-xl bg-white px-3 text-sm font-bold text-slate-800 outline-none">
                <option value="all">Tất cả trạng thái</option>
                {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-bold text-teal-50">
              Dịch vụ
              <select value={draftFilters.serviceId} onChange={(event) => updateDraftFilter("serviceId", event.target.value)} className="min-h-10 rounded-xl bg-white px-3 text-sm font-bold text-slate-800 outline-none">
                <option value="all">Tất cả dịch vụ</option>
                {(filterOptions.services || []).map((service) => <option key={service._id} value={service._id}>{service.name}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-bold text-teal-50">
              Companion
              <select value={draftFilters.companionId} onChange={(event) => updateDraftFilter("companionId", event.target.value)} className="min-h-10 rounded-xl bg-white px-3 text-sm font-bold text-slate-800 outline-none">
                <option value="all">Tất cả companion</option>
                {(filterOptions.companions || []).map((companion) => <option key={companion._id} value={companion._id}>{companion.name} · {companion.email}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-bold text-teal-50">
              Khách hàng
              <select value={draftFilters.customerId} onChange={(event) => updateDraftFilter("customerId", event.target.value)} className="min-h-10 rounded-xl bg-white px-3 text-sm font-bold text-slate-800 outline-none">
                <option value="all">Tất cả khách hàng</option>
                {(filterOptions.customers || []).map((customer) => <option key={customer._id} value={customer._id}>{customer.name} · {customer.email}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-bold text-teal-50">
              Mã booking
              <input value={draftFilters.bookingId} onChange={(event) => updateDraftFilter("bookingId", event.target.value.trim())} placeholder="24 ký tự ObjectId" className="min-h-10 rounded-xl bg-white px-3 text-sm font-bold text-slate-800 outline-none" />
            </label>
            <div className="flex flex-wrap items-center gap-2 md:col-span-2 xl:col-span-5">
              <button type="submit" className="rounded-full bg-white px-5 py-2 text-xs font-black text-teal-700">Áp dụng bộ lọc</button>
              <button type="button" onClick={clearFilters} className="rounded-full border border-white/30 px-5 py-2 text-xs font-black text-white">Xóa bộ lọc</button>
              <span className="text-xs font-bold text-teal-50">{activeFilterCount} bộ lọc đang áp dụng</span>
            </div>
          </form>
        </div>

        <div className="grid gap-4 p-5 md:grid-cols-3">
          <div className="rounded-2xl border border-teal-100 bg-teal-50 p-4">
            <p className="text-sm font-semibold text-teal-700">Booking trong khoảng</p>
            <strong className="mt-2 block text-3xl font-black text-teal-800">{totalBookings}</strong>
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

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="text-xs font-medium text-slate-400">Doanh thu paid</span>
          <p className="mt-2 text-xl font-bold text-teal-700">{money(paidRevenue)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="text-xs font-medium text-slate-400">CareGo thu</span>
          <p className="mt-2 text-xl font-bold text-emerald-700">{money(careGoRevenue)}</p>
          <p className="mt-1 text-[11px] text-slate-400">Phí nền tảng: {money(platformFee)}</p>
          <p className="mt-1 text-[11px] text-slate-400">Phí phạt: {money(penaltyRevenue)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="text-xs font-medium text-slate-400">Giá trị booking trung bình</span>
          <p className="mt-2 text-xl font-bold text-violet-700">{money(averageBookingValue)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="text-xs font-medium text-slate-400">Tỷ lệ hoàn thành</span>
          <p className="mt-2 text-xl font-bold text-blue-700">{completionRate}%</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="text-xs font-medium text-slate-400">Tỷ lệ hủy</span>
          <p className="mt-2 text-xl font-bold text-rose-700">{cancellationRate}%</p>
          <p className="mt-1 text-[11px] text-slate-400">{cancelledBookings} booking bị hủy</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="text-xs font-medium text-slate-400">Đánh giá khách hàng</span>
          <p className="mt-2 text-xl font-bold text-amber-600">{ratingAverage || 0} / 5</p>
          <p className="mt-1 text-[11px] text-slate-400">{reviewCount} đánh giá</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="text-xs font-medium text-slate-400">Utilization companion</span>
          <p className="mt-2 text-xl font-bold text-indigo-700">{utilizationRate}%</p>
          <p className="mt-1 text-[11px] text-slate-400">Giờ được gán / giờ khả dụng</p>
        </div>
        <div className="rounded-xl border-l-4 border-amber-500 bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <span className="text-xs font-medium text-amber-600">Thiếu GPS điểm đến</span>
          <p className="mt-2 text-xl font-bold text-slate-900">{missingGps}</p>
        </div>
      </div>

      <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-bold text-slate-900">So sánh với kỳ liền trước</h2>
            <p className="mt-1 text-xs text-slate-400">Kỳ trước: {previousRange.from || "-"} – {previousRange.to || "-"}, cùng độ dài và cùng bộ lọc.</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {comparisonMetrics.map((item) => {
            const change = item.rate
              ? Math.round((item.current - item.previous) * 10) / 10
              : getRelativeChange(item.current, item.previous);
            return (
              <div key={item.key} className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-100">
                <p className="text-xs font-semibold text-slate-500">{item.label}</p>
                <p className="mt-2 text-lg font-black text-slate-900">{item.format(item.current)}</p>
                <p className="mt-1 text-[11px] text-slate-400">Kỳ trước: {item.format(item.previous)}</p>
                <p className={`mt-2 text-xs font-black ${change > 0 ? "text-emerald-600" : change < 0 ? "text-rose-600" : "text-slate-500"}`}>
                  {formatChange(change, item.rate ? " điểm %" : "%")}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="rounded-2xl border border-teal-100 bg-white p-5 shadow-xl shadow-teal-900/5 xl:col-span-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="font-bold text-slate-900">Booking theo ngày</h2>
              <p className="mt-1 text-xs text-slate-400">
                Theo dõi số lịch chăm sóc theo ngày thực hiện trong khoảng đang lọc.
              </p>
            </div>
            <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-black text-teal-700">
              {totalBookings} booking
            </span>
          </div>
          <div className="mt-4 h-72">
            <Line data={dailyBookingData} options={dailyChartOptions} />
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
              Companion: {money(companionEarning)}
            </span>
          </div>
        </div>
        <div className="mt-4 h-80">
          <Bar data={moneySplitData} options={chartOptions} />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_2fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-bold text-slate-900">Doanh thu theo tháng</h2>
          <p className="mt-1 text-xs text-slate-400">Chỉ tính booking đã thanh toán.</p>
          <div className="mt-4 h-72">
            <Line data={revenueData} options={chartOptions} />
          </div>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-bold text-slate-900">Phương thức thanh toán</h2>
          <p className="mt-1 text-xs text-slate-400">Phân bổ các giao dịch đã thanh toán trong khoảng lọc.</p>
          <div className="mt-4 h-72">
            <Bar data={paymentMethodData} options={chartOptions} />
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
        <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
          <div>
            <h2 className="font-bold text-slate-900">Phân tích đánh giá khách hàng</h2>
            <p className="mt-1 text-xs text-slate-400">{reviewData.count || 0} đánh giá · trung bình {reviewData.average || 0}/5 · độ phủ {reviewData.coverage || 0}% số ca hoàn thành.</p>
            <div className="mt-4 h-72">
              <Bar data={reviewRatingData} options={dailyChartOptions} />
            </div>
          </div>
          <div>
            <h3 className="font-bold text-slate-900">Tag được nhắc nhiều</h3>
            <div className="mt-4 flex flex-wrap gap-2">
              {(reviewData.topTags || []).map((item) => (
                <span key={item.tag} className="rounded-full bg-amber-50 px-3 py-2 text-xs font-black text-amber-700">
                  {item.tag} · {item.count}
                </span>
              ))}
              {!(reviewData.topTags || []).length ? <p className="text-xs text-slate-400">Chưa có tag đánh giá.</p> : null}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_2fr]">
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
              {serviceStats.map((item) => (
                <tr key={item.name}>
                  <td className="p-4 font-semibold text-slate-800">{item.name}</td>
                  <td className="p-4">{item.count}</td>
                  <td className="p-4 text-right font-bold text-teal-700">{money(item.revenue)}</td>
                </tr>
              ))}
              {!serviceStats.length ? (
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
            <p className="mt-1 text-xs text-slate-400">Giờ được gán so với lịch làm việc khả dụng trong khoảng lọc.</p>
          </div>
          <div className="overflow-x-auto">
          <table className="min-w-[860px] w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400">
                <th className="p-4">Companion</th>
                <th className="p-4">Số ca</th>
                <th className="p-4">Paid</th>
                <th className="p-4">Giờ gán / khả dụng</th>
                <th className="p-4">Utilization</th>
                <th className="p-4">Giờ hoàn thành</th>
                <th className="p-4">Đánh giá</th>
                <th className="p-4 text-right">Thu nhập</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {companionRows.map((item) => (
                <tr key={item.id}>
                  <td className="p-4 font-semibold text-slate-800">{item.name}</td>
                  <td className="p-4">{item.count}</td>
                  <td className="p-4">{item.paid}</td>
                  <td className="p-4">{item.assignedHours} / {item.availableHours} giờ</td>
                  <td className="p-4 font-black text-indigo-700">{item.utilizationRate}%</td>
                  <td className="p-4">{item.completionHoursRate}%</td>
                  <td className="p-4">{item.ratingAverage || 0}/5 ({item.reviewCount || 0})</td>
                  <td className="p-4 text-right font-bold text-teal-700">{money(item.earning)}</td>
                </tr>
              ))}
              {!companionRows.length ? (
                <tr>
                  <td colSpan="8" className="p-6 text-center text-slate-400">Chưa có dữ liệu.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/70 p-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-bold text-slate-900">Chi tiết booking</h2>
            <p className="mt-1 text-xs text-slate-400">
              Dữ liệu chi tiết được phân trang, số liệu tổng quan phía trên vẫn tính toàn bộ khoảng lọc.
            </p>
          </div>
          <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-black text-teal-700">
            {detailStart}-{detailEnd} / {totalBookings}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400">
                <th className="p-4">Booking</th>
                <th className="p-4">Khách hàng</th>
                <th className="p-4">Companion</th>
                <th className="p-4">Dịch vụ</th>
                <th className="p-4">Trạng thái</th>
                <th className="p-4 text-right">Khách trả</th>
                <th className="p-4 text-right">CareGo thu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredBookings.map((booking) => (
                <tr key={booking._id}>
                  <td className="p-4">
                    <p className="font-bold text-slate-800">{booking._id}</p>
                    <p className="mt-1 text-slate-500">Thực hiện: {formatDateTime(booking.startTime)}</p>
                    <p className="mt-1 text-slate-400">Tạo: {formatDateTime(booking.createdAt)}</p>
                  </td>
                  <td className="p-4">
                    <p className="font-semibold text-slate-800">{booking.customerId?.name || ""}</p>
                    <p className="mt-1 text-slate-400">{booking.customerId?.email || ""}</p>
                  </td>
                  <td className="p-4 font-semibold text-slate-800">{booking.companionId?.name || ""}</td>
                  <td className="p-4 font-semibold text-teal-700">{booking.serviceId?.name || ""}</td>
                  <td className="p-4">
                    <StatusBadge status={booking.status} />
                    <p className="mt-2 text-[11px] font-semibold text-slate-400">
                      Payment: {booking.payment?.status || "none"}
                    </p>
                  </td>
                  <td className="p-4 text-right font-bold text-slate-900">{money(getPaidAmount(booking))}</td>
                  <td className="p-4 text-right font-bold text-teal-700">{money(getCareGoRevenue(booking))}</td>
                </tr>
              ))}
              {!filteredBookings.length && !loading ? (
                <tr>
                  <td colSpan="7" className="p-6 text-center text-slate-400">Chưa có booking trong trang này.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-semibold text-slate-400">
            Trang {currentPage} / {totalPages}, {pageSize} dòng mỗi trang
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={currentPage <= 1 || loading}
              onClick={() => setReportPage((page) => Math.max(1, page - 1))}
              className="rounded-full border border-teal-100 px-4 py-2 text-xs font-black text-teal-700 transition hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Trước
            </button>
            <button
              type="button"
              disabled={currentPage >= totalPages || loading}
              onClick={() => setReportPage((page) => Math.min(totalPages, page + 1))}
              className="rounded-full border border-teal-100 px-4 py-2 text-xs font-black text-teal-700 transition hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Sau
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5 shadow-sm">
        <h2 className="font-bold text-rose-800">Cảnh báo cần theo dõi</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl bg-white p-4 ring-1 ring-rose-100">
            <p className="text-sm font-semibold text-slate-800">Booking thiếu GPS điểm đến</p>
            <p className="mt-1 text-xs text-slate-500">{missingGps} booking trong khoảng lọc cần bổ sung vị trí.</p>
            <StatusBadge status={missingGps ? "pending" : "approved"} />
          </div>
          <div className="rounded-xl bg-white p-4 ring-1 ring-rose-100">
            <p className="text-sm font-semibold text-slate-800">Hồ sơ companion chờ duyệt hiện tại</p>
            <p className="mt-1 text-xs text-slate-500">{pendingCompanions} hồ sơ trên toàn hệ thống; chỉ số này không phụ thuộc khoảng ngày.</p>
            <StatusBadge status={pendingCompanions ? "pending" : "approved"} />
          </div>
          <div className="rounded-xl bg-white p-4 ring-1 ring-rose-100">
            <p className="text-sm font-semibold text-slate-800">Booking bị hủy</p>
            <p className="mt-1 text-xs text-slate-500">
              {cancelledBookings} booking đang cancelled.
            </p>
            <StatusBadge status={cancelledBookings ? "cancelled" : "approved"} />
          </div>
        </div>
      </section>
    </div>
  );
};

export default AdminReportsPage;
