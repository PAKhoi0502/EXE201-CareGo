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
import { Link } from "react-router";
import { api } from "../../api/client.js";
import BlogManagementPanel from "../../components/admin/BlogManagementPanel.jsx";
import { Card } from "../../components/Ui.jsx";
import { useAsync } from "../../hooks/useAsync.js";

ChartJS.register(ArcElement, BarElement, CategoryScale, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip);

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

const rangePresets = [
  { label: "Hôm nay", days: 1 },
  { label: "7 ngày gần nhất", days: 7 },
  { label: "30 ngày gần nhất", days: 30 },
  { label: "90 ngày gần nhất", days: 90 },
];

const commentStatusLabels = {
  pending: "Chờ duyệt",
  visible: "Đang hiển thị",
  hidden: "Đã ẩn",
};

const commentStatusStyles = {
  pending: "bg-amber-50 text-amber-700 ring-amber-200",
  visible: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  hidden: "bg-slate-100 text-slate-600 ring-slate-200",
};

const dateTime = (value) => (value ? new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "short",
  timeStyle: "short",
}).format(new Date(value)) : "");

const AdminBlogsPage = () => {
  const [dateRange, setDateRange] = useState(() => getRecentRange(7));
  const [commentBlog, setCommentBlog] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState("");
  const [commentActionId, setCommentActionId] = useState("");
  const { data, loading, error, reload } = useAsync(
    () => api.get(`/blogs/admin/stats?from=${dateRange.from}&to=${dateRange.to}`),
    [dateRange.from, dateRange.to],
  );

  const statsData = error ? null : data;
  const blogStats = statsData?.blogStats || [];
  const dailyViews = statsData?.dailyViews || [];
  const categoryViews = statsData?.categoryViews || [];
  const totalViews = blogStats.reduce((sum, item) => sum + Number(item.viewCount || 0), 0);
  const totalRatings = blogStats.reduce((sum, item) => sum + Number(item.ratingCount || 0), 0);
  const totalComments = blogStats.reduce(
    (sum, item) => sum + Number(item.comments?.length || item.commentCount || 0),
    0,
  );
  const bestPost = blogStats[0];

  const openComments = async (blog) => {
    setCommentBlog(blog);
    setComments([]);
    setCommentsLoading(true);
    setCommentsError("");
    try {
      const result = await api.get(`/admin/blogs/${blog._id}/comments`);
      setComments(result.comments || []);
    } catch (err) {
      setCommentsError(err.message);
    } finally {
      setCommentsLoading(false);
    }
  };

  const closeComments = () => {
    setCommentBlog(null);
    setComments([]);
    setCommentsError("");
  };

  const updateCommentStatus = async (comment, status) => {
    if (!commentBlog) return;
    const message = status === "visible"
      ? "Duyệt và hiển thị bình luận này?"
      : "Ẩn bình luận này khỏi người dùng?";
    if (!window.confirm(message)) return;

    setCommentsError("");
    setCommentActionId(`${comment._id}:${status}`);
    try {
      const result = await api.patch(`/admin/blogs/${commentBlog._id}/comments/${comment._id}`, { status });
      setComments((current) => current.map((item) => (item._id === comment._id ? result.comment : item)));
      reload();
    } catch (err) {
      setCommentsError(err.message);
    } finally {
      setCommentActionId("");
    }
  };

  const deleteComment = async (comment) => {
    if (!commentBlog) return;
    if (!window.confirm("Xóa vĩnh viễn bình luận này? Thao tác này không thể hoàn tác.")) return;

    setCommentsError("");
    setCommentActionId(`${comment._id}:delete`);
    try {
      await api.delete(`/admin/blogs/${commentBlog._id}/comments/${comment._id}`);
      setComments((current) => current.filter((item) => item._id !== comment._id));
      reload();
    } catch (err) {
      setCommentsError(err.message);
    } finally {
      setCommentActionId("");
    }
  };

  const trendData = {
    labels: dailyViews.map((item) => item.label),
    datasets: [
      {
        label: "Lượt xem",
        data: dailyViews.map((item) => item.views || 0),
        borderColor: "#0f766e",
        backgroundColor: "rgba(20, 184, 166, 0.18)",
        pointBackgroundColor: "#0f766e",
        pointBorderColor: "#ffffff",
        pointBorderWidth: 2,
        pointRadius: 4,
        tension: 0.38,
        fill: true,
      },
    ],
  };

  const rankingData = {
    labels: blogStats.map((item) =>
      item.title?.length > 34 ? `${item.title.slice(0, 34)}...` : item.title,
    ),
    datasets: [
      {
        label: "Lượt xem",
        data: blogStats.map((item) => item.viewCount || 0),
        backgroundColor: blogStats.map((_, index) =>
          index === 0 ? "rgba(15, 118, 110, 0.95)" : "rgba(20, 184, 166, 0.56)",
        ),
        borderColor: blogStats.map((_, index) =>
          index === 0 ? "rgba(13, 148, 136, 1)" : "rgba(153, 246, 228, 1)",
        ),
        borderRadius: 10,
        borderWidth: 1,
        barThickness: 24,
      },
    ],
  };

  const categoryData = {
    labels: categoryViews.map((item) => item.category),
    datasets: [
      {
        data: categoryViews.map((item) => item.views || 0),
        backgroundColor: ["#0f766e", "#2563eb", "#f59e0b", "#e11d48", "#64748b", "#14b8a6"],
        borderColor: "#ffffff",
        borderWidth: 3,
        hoverOffset: 8,
      },
    ],
  };

  const trendOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#0f172a",
        titleFont: { weight: "700" },
        bodyFont: { weight: "700" },
        padding: 12,
        cornerRadius: 12,
        callbacks: {
          label: (context) => `${context.raw || 0} lượt xem`,
        },
      },
    },
    scales: {
      x: {
        border: { display: false },
        grid: { display: false },
        ticks: { color: "#64748b", font: { size: 10, weight: "700" } },
      },
      y: {
        beginAtZero: true,
        ticks: { precision: 0 },
        border: { display: false },
        grid: { color: "#e2f7f3" },
      },
    },
  };

  const rankingOptions = {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#0f172a",
        titleFont: { weight: "700" },
        bodyFont: { weight: "700" },
        padding: 12,
        cornerRadius: 12,
        callbacks: {
          label: (context) => `${context.raw || 0} lượt xem`,
        },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        ticks: { precision: 0 },
        border: { display: false },
        grid: { color: "#e2f7f3" },
      },
      y: {
        ticks: {
          color: "#475569",
          font: { size: 11, weight: "700" },
        },
        border: { display: false },
        grid: { display: false },
      },
    },
  };

  const categoryOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
        labels: { boxWidth: 10, padding: 12, font: { size: 11, weight: "700" } },
      },
      tooltip: {
        backgroundColor: "#0f172a",
        padding: 12,
        cornerRadius: 12,
        callbacks: {
          label: (context) => `${context.label}: ${context.raw || 0} lượt xem`,
        },
      },
    },
    cutout: "66%",
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

      <BlogManagementPanel onChanged={reload} />

      <Card className="overflow-hidden border-teal-100 bg-white/95 p-0 shadow-xl shadow-teal-900/5">
        <div className="bg-gradient-to-r from-teal-700 via-teal-600 to-emerald-500 p-5 text-white">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-teal-100">
                Bộ lọc thời gian
              </p>
              <h2 className="mt-1 text-xl font-black">Phân tích nội dung Blog</h2>
              <p className="mt-1 max-w-2xl text-sm font-medium text-teal-50">
                Lọc theo ngày để xem xu hướng đọc, danh mục được quan tâm và top bài viết hiệu quả.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDateRange(getRecentRange(7))}
              className="inline-flex min-h-10 items-center justify-center rounded-full bg-white px-5 text-sm font-black text-teal-700 shadow-sm transition hover:bg-teal-50"
            >
              Đặt lại 7 ngày
            </button>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_auto] xl:items-end">
            <div className="flex flex-wrap gap-2">
              {rangePresets.map((preset) => (
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

        <div className="grid gap-5 p-5 md:grid-cols-3">
          <div className="rounded-2xl border border-teal-100 bg-teal-50 p-4">
            <p className="text-sm font-semibold text-teal-700">Lượt xem trong khoảng</p>
            <strong className="mt-2 block text-3xl font-black text-teal-800">{totalViews}</strong>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-700">Bài nổi bật</p>
            <strong className="mt-2 block truncate text-lg font-black text-amber-800">
              {bestPost?.title || "Chưa có dữ liệu"}
            </strong>
          </div>
          <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4">
            <p className="text-sm font-semibold text-sky-700">Khoảng lọc</p>
            <strong className="mt-2 block text-sm font-black text-sky-800">
              {dateRange.from} - {dateRange.to}
            </strong>
          </div>
        </div>
      </Card>

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

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="border-teal-100 bg-white/95 shadow-xl shadow-teal-900/5 xl:col-span-2">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-700">Xu hướng đọc blog</p>
              <h2 className="mt-1 font-black text-slate-900">Lượt xem theo ngày</h2>
              <p className="mt-1 text-xs font-semibold text-slate-400">
                Theo dõi nhịp tăng giảm lượt đọc trong khoảng thời gian đang lọc.
              </p>
            </div>
            <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-black text-teal-700">
              {totalViews} lượt xem
            </span>
          </div>
          <div className="h-80 rounded-3xl border border-teal-50 bg-gradient-to-b from-white to-teal-50/40 p-4">
            {loading ? (
              <div className="flex h-full items-center justify-center text-sm font-bold text-slate-400">
                Đang tải biểu đồ blog...
              </div>
            ) : (
              <Line data={trendData} options={trendOptions} />
            )}
          </div>
        </Card>

        <Card className="border-teal-100 bg-white/95 shadow-xl shadow-teal-900/5">
          <div className="mb-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-700">Danh mục</p>
            <h2 className="mt-1 font-black text-slate-900">Tỷ trọng lượt xem</h2>
            <p className="mt-1 text-xs font-semibold text-slate-400">
              Xem nhóm nội dung nào đang được quan tâm.
            </p>
          </div>
          <div className="h-80">
            {loading ? (
              <div className="flex h-full items-center justify-center text-sm font-bold text-slate-400">
                Đang tải danh mục...
              </div>
            ) : (
              <Doughnut data={categoryData} options={categoryOptions} />
            )}
          </div>
        </Card>
      </div>

      <Card className="border-teal-100 bg-white/95 shadow-xl shadow-teal-900/5">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-700">Bảng xếp hạng</p>
            <h2 className="mt-1 font-black text-slate-900">Top bài viết theo lượt xem</h2>
            <p className="mt-1 text-xs font-semibold text-slate-400">
              Mỗi lần người dùng click mở chi tiết bài viết sẽ tăng một lượt xem.
            </p>
          </div>
          <Link to="/blog" className="text-xs font-black text-teal-700 hover:underline">
            Xem trang blog
          </Link>
        </div>
        <div className="h-80 rounded-3xl border border-teal-50 bg-gradient-to-b from-white to-teal-50/40 p-4">
          {loading ? (
            <div className="flex h-full items-center justify-center text-sm font-bold text-slate-400">
              Đang tải bảng xếp hạng...
            </div>
          ) : (
            <Bar data={rankingData} options={rankingOptions} />
          )}
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
                <th className="p-4 text-right">Quản lý</th>
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
                    <div>{item.visibleCommentCount ?? item.commentCount ?? 0}/{item.commentCount || 0}</div>
                    {item.pendingCommentCount ? (
                      <div className="mt-1 text-xs text-amber-600">{item.pendingCommentCount} chờ duyệt</div>
                    ) : null}
                  </td>
                  <td className="p-4 text-right">
                    <Link className="font-black text-teal-700 hover:underline" to={`/blog/${item.slug}`}>
                      Xem
                    </Link>
                  </td>
                  <td className="p-4 text-right">
                    <button
                      type="button"
                      onClick={() => openComments(item)}
                      className="rounded-full border border-teal-100 px-3 py-2 text-xs font-black text-teal-700 transition hover:bg-teal-50"
                    >
                      Bình luận
                    </button>
                  </td>
                </tr>
              ))}
              {!blogStats.length && !loading ? (
                <tr>
                  <td colSpan="7" className="p-6 text-center text-sm font-semibold text-slate-400">
                    Chưa có dữ liệu blog trong khoảng ngày này.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      {commentBlog ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4">
          <div className="max-h-[86vh] w-full max-w-3xl overflow-y-auto rounded-[28px] bg-white p-6 shadow-2xl">
            <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-700">Duyệt bình luận</p>
                <h2 className="mt-1 text-xl font-black text-slate-950">{commentBlog.title}</h2>
                <p className="mt-1 text-xs font-semibold text-slate-400">{commentBlog.slug}</p>
              </div>
              <button
                type="button"
                onClick={closeComments}
                className="rounded-full border border-slate-200 px-4 py-2 text-xs font-black text-slate-600 transition hover:bg-slate-50"
              >
                Đóng
              </button>
            </div>

            {commentsError ? (
              <p className="mt-4 rounded-2xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{commentsError}</p>
            ) : null}
            {commentsLoading ? (
              <p className="mt-4 text-sm font-semibold text-slate-500">Đang tải bình luận...</p>
            ) : null}
            {!commentsLoading && !comments.length ? (
              <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">
                Chưa có bình luận nào cho bài viết này.
              </p>
            ) : null}

            <div className="mt-4 grid gap-3">
              {comments.map((comment) => (
                <article key={comment._id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-black text-slate-900">{comment.userId?.name || comment.name}</p>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${commentStatusStyles[comment.status]}`}>
                          {commentStatusLabels[comment.status] || "Không rõ"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs font-semibold text-slate-400">
                        {comment.userId?.email || "Dữ liệu cũ"} • {dateTime(comment.createdAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {comment.status !== "visible" ? (
                        <button
                          type="button"
                          onClick={() => updateCommentStatus(comment, "visible")}
                          disabled={commentActionId.startsWith(`${comment._id}:`)}
                          className="rounded-full bg-emerald-600 px-3 py-2 text-xs font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {commentActionId === `${comment._id}:visible` ? "Đang duyệt..." : "Duyệt"}
                        </button>
                      ) : null}
                      {comment.status !== "hidden" ? (
                        <button
                          type="button"
                          onClick={() => updateCommentStatus(comment, "hidden")}
                          disabled={commentActionId.startsWith(`${comment._id}:`)}
                          className="rounded-full bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {commentActionId === `${comment._id}:hidden` ? "Đang ẩn..." : "Ẩn"}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => deleteComment(comment)}
                        disabled={commentActionId.startsWith(`${comment._id}:`)}
                        className="rounded-full bg-rose-50 px-3 py-2 text-xs font-black text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {commentActionId === `${comment._id}:delete` ? "Đang xóa..." : "Xóa"}
                      </button>
                    </div>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">{comment.content || comment.body}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AdminBlogsPage;
