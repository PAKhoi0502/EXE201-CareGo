import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { Chart, Doughnut } from "react-chartjs-2";
import { Link } from "react-router";
import { api } from "../../api/client.js";
import { Button, Card, StatusBadge } from "../../components/Ui.jsx";
import { useAsync } from "../../hooks/useAsync.js";
import { dateTime, money } from "../../utils/format.js";

ChartJS.register(
  ArcElement,
  BarElement,
  CategoryScale,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
);

const monthLabel = (date) =>
  new Intl.DateTimeFormat("vi-VN", { month: "short" }).format(new Date(date));

const compactMoney = (value) => {
  const amount = Number(value || 0);
  if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(1)}M`;
  }

  return money(amount);
};

const getBaseAmount = (booking) => Number(booking.payment?.baseAmount ?? booking.totalAmount ?? 0);
const getPenaltyAmount = (booking) => Number(booking.payment?.penaltyAmount ?? 0);
const getPaidAmount = (booking) => Number(booking.payment?.paidAmount ?? booking.payment?.amount ?? getBaseAmount(booking));
const getDisplayAmount = (booking) => (booking.status === "paid" ? getPaidAmount(booking) : getBaseAmount(booking));

const getMonthlyStats = (bookings) => {
  const months = Array.from({ length: 5 }, (_, index) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (4 - index));
    return {
      key: `${date.getFullYear()}-${date.getMonth()}`,
      label: monthLabel(date),
      revenue: 0,
      count: 0,
    };
  });

  bookings.forEach((booking) => {
    const date = new Date(booking.createdAt);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    const bucket = months.find((item) => item.key === key);
    if (!bucket) return;

    bucket.count += 1;
    if (booking.status === "paid") {
      bucket.revenue += getPaidAmount(booking);
    }
  });

  return months;
};

const getServiceShare = (bookings) => {
  const counts = bookings.reduce((acc, booking) => {
    const name = booking.serviceId?.name || "Khác";
    acc[name] = (acc[name] || 0) + 1;
    return acc;
  }, {});

  const entries = Object.entries(counts);
  if (!entries.length) {
    return [["Chưa có booking", 1]];
  }

  return entries;
};

const StatCard = ({ label, value, accent = "teal", hint, icon }) => {
  const accents = {
    teal: "bg-teal-50 text-teal-700",
    blue: "bg-blue-50 text-blue-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-700",
  };

  return (
    <Card className="flex items-center justify-between border-teal-100 bg-white/95 shadow-xl shadow-teal-900/5">
      <div>
        <span className="block text-sm font-medium text-slate-400">{label}</span>
        <span className="mt-1 block text-2xl font-bold text-slate-900">{value}</span>
        {hint ? <span className="mt-1 block text-xs text-slate-400">{hint}</span> : null}
      </div>
      <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${accents[accent]}`}>
        {icon}
      </div>
    </Card>
  );
};

const AdminDashboardPage = () => {
  const { data, loading, error } = useAsync(() => api.get("/admin/dashboard"), []);
  const { data: bookingsData } = useAsync(() => api.get("/admin/bookings"), []);
  const { data: companionsData } = useAsync(
    () => api.get("/companions/admin/all"),
    [],
  );

  const bookings = bookingsData?.bookings || [];
  const companions = companionsData?.companions || [];
  const runningBookings = bookings.filter((booking) =>
    ["accepted", "in_progress"].includes(booking.status),
  );
  const pendingCompanions = companions.filter((item) => item.vettingStatus === "pending");
  const monthlyStats = getMonthlyStats(bookings);
  const serviceShare = getServiceShare(bookings);
  const blogStats = data?.blogStats || [];

  const revenueChartData = {
    labels: monthlyStats.map((item) => item.label),
    datasets: [
      {
        label: "Số ca",
        type: "line",
        data: monthlyStats.map((item) => item.count),
        borderColor: "#0f766e",
        backgroundColor: "#0f766e",
        borderWidth: 3,
        tension: 0.35,
        yAxisID: "y1",
      },
      {
        label: "Doanh thu",
        type: "bar",
        data: monthlyStats.map((item) => item.revenue / 1000000),
        backgroundColor: "rgba(37, 99, 235, 0.72)",
        borderRadius: 6,
        yAxisID: "y",
      },
    ],
  };

  const revenueChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
        labels: { boxWidth: 12, font: { size: 11 } },
      },
    },
    scales: {
      y: {
        position: "left",
        title: { display: true, text: "Triệu VND", font: { size: 10 } },
        grid: { color: "#f1f5f9" },
      },
      y1: {
        position: "right",
        title: { display: true, text: "Số ca", font: { size: 10 } },
        grid: { drawOnChartArea: false },
      },
    },
  };

  const serviceChartData = {
    labels: serviceShare.map(([label]) => label),
    datasets: [
      {
        data: serviceShare.map(([, count]) => count),
        backgroundColor: ["#2563eb", "#0f766e", "#f59e0b", "#64748b", "#dc2626"],
        borderWidth: 2,
        hoverOffset: 4,
      },
    ],
  };

  const serviceChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
        labels: { boxWidth: 10, padding: 10, font: { size: 11 } },
      },
    },
    cutout: "65%",
  };

  const blogViewsChartData = {
    labels: blogStats.map((item) =>
      item.title?.length > 24 ? `${item.title.slice(0, 24)}...` : item.title,
    ),
    datasets: [
      {
        label: "Lượt xem",
        data: blogStats.map((item) => item.viewCount || 0),
        backgroundColor: "rgba(15, 118, 110, 0.78)",
        borderRadius: 8,
      },
    ],
  };

  const blogViewsChartOptions = {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => `${context.raw || 0} lượt xem`,
        },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        ticks: { precision: 0 },
        grid: { color: "#f1f5f9" },
      },
      y: {
        grid: { display: false },
      },
    },
  };

  if (loading) {
    return <p className="text-sm text-slate-500">Đang tải dashboard...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">Hệ thống quản lý CareGo</h1>
          <p className="mt-1 text-sm text-slate-500">
            Tổng quan vận hành, kiểm duyệt companion và theo dõi các ca chăm sóc.
          </p>
        </div>
        <div className="rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-500 shadow-sm ring-1 ring-slate-200">
          Hôm nay: {new Intl.DateTimeFormat("vi-VN").format(new Date())}
        </div>
      </div>

      {error ? <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Ca đang chạy"
          value={`${runningBookings.length} ca`}
          accent="teal"
          icon={
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 13h4l2-6 4 12 2-6h4" />
            </svg>
          }
        />
        <StatCard
          label="Companion"
          value={`${data?.totalCompanions || 0}`}
          accent="blue"
          icon={
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 11a4 4 0 1 0-8 0" />
              <path d="M12 15c-4.418 0-8 2.239-8 5v1h16v-1c0-2.761-3.582-5-8-5z" />
              <path d="M20 8a3 3 0 1 1-6 0" />
            </svg>
          }
        />
        <StatCard
          label="Doanh thu"
          value={compactMoney(data?.revenue?.revenue)}
          hint={`CareGo thu: ${compactMoney(data?.revenue?.caregoRevenue)} | Phí phạt: ${compactMoney(data?.revenue?.penaltyAmount)}`}
          accent="emerald"
          icon={
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 3v18" />
              <path d="M16 7H9a3 3 0 0 0 0 6h6a3 3 0 0 1 0 6H8" />
            </svg>
          }
        />
        <StatCard
          label="Chờ duyệt"
          value={`${pendingCompanions.length} hồ sơ`}
          accent="amber"
          icon={
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 8v5l3 2" />
              <path d="M12 22a10 10 0 1 0-10-10" />
            </svg>
          }
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2 border-teal-100 bg-white/95 shadow-xl shadow-teal-900/5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-slate-900">Xu hướng doanh thu và sản lượng ca</h2>
              <p className="text-xs text-slate-400">Tổng hợp theo booking gần đây trong hệ thống</p>
            </div>
            <span className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500">Realtime</span>
          </div>
          <div className="h-72">
            <Chart type="bar" data={revenueChartData} options={revenueChartOptions} />
          </div>
        </Card>

        <Card className="border-teal-100 bg-white/95 shadow-xl shadow-teal-900/5">
          <h2 className="font-bold text-slate-900">Tỷ trọng gói dịch vụ</h2>
          <p className="mt-1 text-xs text-slate-400">Đo lường nhu cầu thực tế của gia đình</p>
          <div className="mt-4 h-56">
            <Doughnut data={serviceChartData} options={serviceChartOptions} />
          </div>
          <p className="mt-3 text-center text-xs text-slate-400">
            Dịch vụ có tỷ trọng cao giúp ưu tiên tuyển companion và thiết kế checklist.
          </p>
        </Card>
      </div>

      <Card className="border-teal-100 bg-white/95 shadow-xl shadow-teal-900/5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-bold text-slate-900">Lượt xem blog</h2>
            <p className="text-xs text-slate-400">
              Mỗi lượt mở bài viết sẽ được ghi nhận để admin theo dõi nội dung được quan tâm nhất.
            </p>
          </div>
          <Link to="/blog" className="text-xs font-semibold text-teal-700 hover:underline">
            Xem trang blog
          </Link>
        </div>
        <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
          <div className="h-72">
            <Chart type="bar" data={blogViewsChartData} options={blogViewsChartOptions} />
          </div>
          <div className="grid content-start gap-3">
            {blogStats.slice(0, 4).map((item, index) => (
              <div key={item.slug} className="rounded-2xl border border-teal-100 bg-[#f7fffe] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black text-teal-700">#{index + 1} • {item.category}</p>
                    <h3 className="mt-1 text-sm font-black leading-5 text-slate-900">{item.title}</h3>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-teal-700">
                    👁 {item.viewCount || 0}
                  </span>
                </div>
                <p className="mt-3 text-xs font-semibold text-slate-500">
                  ★ {item.ratingAverage || 0}/5 • {item.ratingCount || 0} đánh giá • {item.commentCount || 0} bình luận
                </p>
              </div>
            ))}
            {!blogStats.length ? (
              <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Chưa có dữ liệu blog.</p>
            ) : null}
          </div>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="overflow-hidden p-0 xl:col-span-2 border-teal-100 bg-white/95 shadow-xl shadow-teal-900/5">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 p-5">
            <h2 className="flex items-center gap-2 font-bold text-slate-900">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              Các ca làm đang diễn ra
            </h2>
            <Link to="/admin/bookings" className="text-xs font-semibold text-teal-700 hover:underline">
              Xem tất cả
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-400">
                  <th className="p-4">Companion</th>
                  <th className="p-4">Người thân / Dịch vụ</th>
                  <th className="p-4">Trạng thái</th>
                  <th className="p-4 text-right">Giá trị</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(runningBookings.length ? runningBookings : bookings.slice(0, 4)).map((booking) => (
                  <tr key={booking._id}>
                    <td className="p-4">
                      <p className="font-semibold text-slate-900">{booking.companionId?.name || "Chưa có"}</p>
                      <p className="text-xs text-slate-400">{booking.companionId?.email}</p>
                    </td>
                    <td className="p-4">
                      <p className="font-medium text-slate-800">{booking.elderProfileId?.fullName}</p>
                      <span className="mt-1 inline-block rounded bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                        {booking.serviceId?.name || "Dịch vụ"}
                      </span>
                    </td>
                    <td className="p-4">
                      <StatusBadge status={booking.status} />
                      <p className="mt-1 text-xs text-slate-400">{dateTime(booking.startTime)}</p>
                    </td>
                    <td className="p-4 text-right font-semibold text-teal-700">
                      {money(getDisplayAmount(booking))}
                      {getPenaltyAmount(booking) > 0 ? (
                        <p className="mt-1 text-[11px] font-medium text-rose-600">Phí phạt: {money(getPenaltyAmount(booking))}</p>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {!bookings.length ? (
                  <tr>
                    <td className="p-6 text-center text-sm text-slate-400" colSpan="4">
                      Chưa có booking nào.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="border-teal-100 bg-white/95 shadow-xl shadow-teal-900/5">
            <h2 className="font-bold text-slate-900">Chờ duyệt hồ sơ companion</h2>
            <p className="mt-1 text-xs text-slate-400">Lớp kiểm duyệt CCCD, thẻ sinh viên và hồ sơ cơ bản</p>
            <div className="mt-4 space-y-3">
              {pendingCompanions.slice(0, 4).map((companion) => (
                <div
                  key={companion._id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{companion.fullName}</p>
                    <p className="text-xs text-slate-400">
                      {companion.university || "Chưa có trường"} - {companion.major || "Chưa có ngành"}
                    </p>
                  </div>
                  <Link
                    to="/admin/companions"
                    className="inline-flex min-h-8 items-center justify-center rounded-md bg-teal-700 px-3 text-xs font-semibold text-white transition hover:bg-teal-800"
                  >
                    Mở hồ sơ
                  </Link>
                </div>
              ))}
              {!pendingCompanions.length ? (
                <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">Không có hồ sơ chờ duyệt.</p>
              ) : null}
            </div>
          </Card>

          <Card className="border-rose-200 bg-rose-50">
            <h2 className="font-bold text-rose-800">Cảnh báo vận hành</h2>
            <p className="mt-3 text-sm leading-6 text-rose-700">
              Theo dõi các ca đang chạy để phát hiện companion không cập nhật GPS, checklist bị trễ hoặc thay đổi lộ trình
              ngoài địa chỉ đã ghim.
            </p>
            <Link to="/admin/bookings">
              <Button variant="danger" className="mt-4 w-full">
                Kiểm tra booking
              </Button>
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardPage;
