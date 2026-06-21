import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { Link } from "react-router";
import { api } from "../../api/client.js";
import { Card } from "../../components/Ui.jsx";
import { useAsync } from "../../hooks/useAsync.js";

ChartJS.register(BarElement, CategoryScale, Legend, LinearScale, Tooltip);

const AdminBlogsPage = () => {
  const { data, loading, error } = useAsync(() => api.get("/blogs/admin/stats"), []);
  const blogStats = data?.blogStats || [];

  const totalViews = blogStats.reduce((sum, item) => sum + Number(item.viewCount || 0), 0);
  const totalRatings = blogStats.reduce((sum, item) => sum + Number(item.ratingCount || 0), 0);
  const totalComments = blogStats.reduce(
    (sum, item) => sum + Number(item.comments?.length || item.commentCount || 0),
    0
  );

  const chartData = {
    labels: blogStats.map((item) =>
      item.title?.length > 28 ? `${item.title.slice(0, 28)}...` : item.title
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

  const chartOptions = {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 border-b border-teal-100 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-950">Quản lý Blog</h1>
          <p className="mt-1 text-sm text-slate-500">
            Theo dõi lượt xem, đánh giá và bình luận của từng bài viết CareGo.
          </p>
        </div>
        <Link
          to="/blog"
          className="inline-flex min-h-10 items-center justify-center rounded-full border border-teal-100 bg-white px-5 text-sm font-black text-teal-700 shadow-sm transition hover:bg-teal-50"
        >
          Xem trang blog
        </Link>
      </div>

      {loading ? <p className="text-sm font-semibold text-slate-500">Đang tải blog...</p> : null}
      {error ? <p className="rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</p> : null}

      <div className="grid gap-5 md:grid-cols-3">
        <Card className="border-teal-100 bg-white/95 shadow-xl shadow-teal-900/5">
          <p className="text-sm font-semibold text-slate-400">Tổng lượt xem</p>
          <strong className="mt-2 block text-3xl font-black text-teal-700">{totalViews}</strong>
        </Card>
        <Card className="border-teal-100 bg-white/95 shadow-xl shadow-teal-900/5">
          <p className="text-sm font-semibold text-slate-400">Lượt đánh giá</p>
          <strong className="mt-2 block text-3xl font-black text-amber-500">{totalRatings}</strong>
        </Card>
        <Card className="border-teal-100 bg-white/95 shadow-xl shadow-teal-900/5">
          <p className="text-sm font-semibold text-slate-400">Bình luận</p>
          <strong className="mt-2 block text-3xl font-black text-sky-600">{totalComments}</strong>
        </Card>
      </div>

      <Card className="border-teal-100 bg-white/95 shadow-xl shadow-teal-900/5">
        <div className="mb-4">
          <h2 className="font-black text-slate-900">Biểu đồ lượt xem từng blog</h2>
          <p className="mt-1 text-xs font-semibold text-slate-400">
            Mỗi lần người dùng click mở chi tiết bài viết sẽ tăng một lượt xem.
          </p>
        </div>
        <div className="h-80">
          <Bar data={chartData} options={chartOptions} />
        </div>
      </Card>

      <Card className="overflow-hidden border-teal-100 bg-white/95 p-0 shadow-xl shadow-teal-900/5">
        <div className="border-b border-teal-50 bg-teal-50/60 p-5">
          <h2 className="font-black text-slate-900">Chi tiết từng bài viết</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase text-slate-400">
                <th className="p-4">Bài viết</th>
                <th className="p-4">Danh mục</th>
                <th className="p-4 text-right">Lượt xem</th>
                <th className="p-4 text-right">Đánh giá</th>
                <th className="p-4 text-right">Bình luận</th>
                <th className="p-4 text-right">Mở bài</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {blogStats.map((item) => (
                <tr key={item.slug}>
                  <td className="max-w-md p-4">
                    <p className="font-black text-slate-900">{item.title}</p>
                    <p className="mt-1 text-xs text-slate-400">{item.slug}</p>
                  </td>
                  <td className="p-4 font-semibold text-teal-700">{item.category}</td>
                  <td className="p-4 text-right font-black text-slate-900">{item.viewCount || 0}</td>
                  <td className="p-4 text-right font-black text-amber-500">
                    ★ {item.ratingAverage || 0} ({item.ratingCount || 0})
                  </td>
                  <td className="p-4 text-right font-black text-sky-600">
                    {item.comments?.length || item.commentCount || 0}
                  </td>
                  <td className="p-4 text-right">
                    <Link className="font-black text-teal-700 hover:underline" to={`/blog/${item.slug}`}>
                      Xem
                    </Link>
                  </td>
                </tr>
              ))}
              {!blogStats.length && !loading ? (
                <tr>
                  <td colSpan="6" className="p-6 text-center text-sm font-semibold text-slate-400">
                    Chưa có dữ liệu blog.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default AdminBlogsPage;
