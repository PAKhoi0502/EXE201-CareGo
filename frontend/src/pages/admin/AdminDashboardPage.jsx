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
      bucket.revenue += booking.totalAmount || 0;
    }
  });

  return months;
};

const getServiceShare = (bookings) => {
  const counts = bookings.reduce((acc, booking) => {
    const name = booking.serviceId?.name || "Khac";
    acc[name] = (acc[name] || 0) + 1;
    return acc;
  }, {});

  const entries = Object.entries(counts);
  if (!entries.length) {
    return [["Chua co booking", 1]];
  }

  return entries;
};

const StatCard = ({ label, value, accent = "teal", hint }) => {
  const accents = {
    teal: "bg-teal-50 text-teal-700",
    blue: "bg-blue-50 text-blue-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-700",
  };

  return (
    <Card className="flex items-center justify-between">
      <div>
        <span className="block text-sm font-medium text-slate-400">{label}</span>
        <span className="mt-1 block text-2xl font-bold text-slate-900">{value}</span>
        {hint ? <span className="mt-1 block text-xs text-slate-400">{hint}</span> : null}
      </div>
      <div className={`flex h-12 w-12 items-center justify-center rounded-lg font-bold ${accents[accent]}`}>
        {label.slice(0, 2).toUpperCase()}
      </div>
    </Card>
  );
};

const AdminDashboardPage = () => {
  const { data, loading, error } = useAsync(() => api.get("/admin/dashboard"), []);
  const { data: bookingsData } = useAsync(() => api.get("/admin/bookings"), []);
  const { data: companionsData, reload: reloadCompanions } = useAsync(
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

  const approveCompanion = async (id, vettingStatus) => {
    await api.patch(`/companions/${id}/status`, { vettingStatus });
    reloadCompanions();
  };

  const revenueChartData = {
    labels: monthlyStats.map((item) => item.label),
    datasets: [
      {
        label: "So ca",
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
        title: { display: true, text: "Trieu VND", font: { size: 10 } },
        grid: { color: "#f1f5f9" },
      },
      y1: {
        position: "right",
        title: { display: true, text: "So ca", font: { size: 10 } },
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

  if (loading) {
    return <p className="text-sm text-slate-500">Dang tai dashboard...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">He thong Quan ly CareGo</h1>
          <p className="mt-1 text-sm text-slate-500">
            Tong quan van hanh, kiem duyet companion va theo doi cac ca cham soc.
          </p>
        </div>
        <div className="rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-500 shadow-sm ring-1 ring-slate-200">
          Hom nay: {new Intl.DateTimeFormat("vi-VN").format(new Date())}
        </div>
      </div>

      {error ? <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Ca dang chay" value={`${runningBookings.length} ca`} accent="teal" />
        <StatCard label="Companion" value={`${data?.totalCompanions || 0}`} accent="blue" />
        <StatCard label="Doanh thu" value={compactMoney(data?.revenue?.revenue)} accent="emerald" />
        <StatCard label="Cho duyet" value={`${pendingCompanions.length} ho so`} accent="amber" />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-slate-900">Xu huong Doanh thu va San luong ca</h2>
              <p className="text-xs text-slate-400">Tong hop theo booking gan day trong he thong</p>
            </div>
            <span className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500">Realtime</span>
          </div>
          <div className="h-72">
            <Chart type="bar" data={revenueChartData} options={revenueChartOptions} />
          </div>
        </Card>

        <Card>
          <h2 className="font-bold text-slate-900">Ty trong goi dich vu</h2>
          <p className="mt-1 text-xs text-slate-400">Do luong nhu cau thuc te cua gia dinh</p>
          <div className="mt-4 h-56">
            <Doughnut data={serviceChartData} options={serviceChartOptions} />
          </div>
          <p className="mt-3 text-center text-xs text-slate-400">
            Dich vu co ty trong cao giup uu tien tuyen companion va thiet ke checklist.
          </p>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="overflow-hidden p-0 xl:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 p-5">
            <h2 className="flex items-center gap-2 font-bold text-slate-900">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              Cac ca lam dang dien ra
            </h2>
            <Link to="/admin/bookings" className="text-xs font-semibold text-teal-700 hover:underline">
              Xem tat ca
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-400">
                  <th className="p-4">Companion</th>
                  <th className="p-4">Nguoi than / Dich vu</th>
                  <th className="p-4">Trang thai</th>
                  <th className="p-4 text-right">Gia tri</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(runningBookings.length ? runningBookings : bookings.slice(0, 4)).map((booking) => (
                  <tr key={booking._id}>
                    <td className="p-4">
                      <p className="font-semibold text-slate-900">{booking.companionId?.name || "Chua co"}</p>
                      <p className="text-xs text-slate-400">{booking.companionId?.email}</p>
                    </td>
                    <td className="p-4">
                      <p className="font-medium text-slate-800">{booking.elderProfileId?.fullName}</p>
                      <span className="mt-1 inline-block rounded bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                        {booking.serviceId?.name || "Dich vu"}
                      </span>
                    </td>
                    <td className="p-4">
                      <StatusBadge status={booking.status} />
                      <p className="mt-1 text-xs text-slate-400">{dateTime(booking.startTime)}</p>
                    </td>
                    <td className="p-4 text-right font-semibold text-teal-700">
                      {money(booking.totalAmount)}
                    </td>
                  </tr>
                ))}
                {!bookings.length ? (
                  <tr>
                    <td className="p-6 text-center text-sm text-slate-400" colSpan="4">
                      Chua co booking nao.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <h2 className="font-bold text-slate-900">Cho duyet ho so companion</h2>
            <p className="mt-1 text-xs text-slate-400">Lop kiem duyet CCCD, the sinh vien va ho so co ban</p>
            <div className="mt-4 space-y-3">
              {pendingCompanions.slice(0, 4).map((companion) => (
                <div
                  key={companion._id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{companion.fullName}</p>
                    <p className="text-xs text-slate-400">
                      {companion.university || "Chua co truong"} - {companion.major || "Chua co nganh"}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      className="min-h-8 px-3"
                      onClick={() => approveCompanion(companion._id, "approved")}
                    >
                      Duyet
                    </Button>
                    <Button
                      variant="secondary"
                      className="min-h-8 px-3"
                      onClick={() => approveCompanion(companion._id, "rejected")}
                    >
                      Tu choi
                    </Button>
                  </div>
                </div>
              ))}
              {!pendingCompanions.length ? (
                <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">Khong co ho so cho duyet.</p>
              ) : null}
            </div>
          </Card>

          <Card className="border-rose-200 bg-rose-50">
            <h2 className="font-bold text-rose-800">Canh bao van hanh</h2>
            <p className="mt-3 text-sm leading-6 text-rose-700">
              Theo doi cac ca dang chay de phat hien companion khong cap nhat GPS, checklist bi tre hoac thay doi lo trinh
              ngoai dia chi da ghim.
            </p>
            <Link to="/admin/bookings">
              <Button variant="danger" className="mt-4 w-full">
                Kiem tra booking
              </Button>
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardPage;
