import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router";
import { api } from "../api/client.js";
import LandingNavbar from "../components/landing/LandingNavbar.jsx";
import { LandingFooter } from "../components/landing/LandingSections.jsx";
import { useAsync } from "../hooks/useAsync.js";

const RatingStars = ({ value, onChange, disabled = false }) => (
  <div className="flex gap-1">
    {[1, 2, 3, 4, 5].map((star) => (
      <button
        key={star}
        type="button"
        disabled={disabled}
        onClick={() => onChange(star)}
        className={`text-3xl transition ${star <= value ? "text-amber-400" : "text-slate-300"} disabled:cursor-not-allowed`}
        aria-label={`${star} sao`}
      >
        ★
      </button>
    ))}
  </div>
);

const BlogDetailPage = () => {
  const { slug } = useParams();
  const { data, setData, loading, error } = useAsync(() => api.get(`/blogs/${slug}`), [slug]);
  const { data: postsData } = useAsync(() => api.get("/blogs"), []);
  const [rating, setRating] = useState(5);
  const [commentForm, setCommentForm] = useState({ name: "", content: "" });
  const [submitError, setSubmitError] = useState("");
  const [success, setSuccess] = useState("");

  const post = data?.post;
  const relatedPosts = useMemo(
    () => (postsData?.posts || []).filter((item) => item.slug !== slug).slice(0, 3),
    [postsData?.posts, slug],
  );

  useEffect(() => {
    let active = true;
    const trackView = async () => {
      try {
        const result = await api.post(`/blogs/${slug}/view`, {});
        if (active) setData(result);
      } catch {
        // View tracking should not block reading.
      }
    };
    trackView();
    return () => {
      active = false;
    };
  }, [slug, setData]);

  const submitRating = async () => {
    setSubmitError("");
    setSuccess("");
    try {
      const result = await api.post(`/blogs/${slug}/rating`, { rating });
      setData(result);
      setSuccess("Cảm ơn bạn đã đánh giá bài viết.");
    } catch (err) {
      setSubmitError(err.message);
    }
  };

  const submitComment = async (event) => {
    event.preventDefault();
    setSubmitError("");
    setSuccess("");
    try {
      const result = await api.post(`/blogs/${slug}/comments`, commentForm);
      setData(result);
      setCommentForm({ name: "", content: "" });
      setSuccess("Bình luận của bạn đã được ghi nhận.");
    } catch (err) {
      setSubmitError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5fbfa] text-[#12312f]">
        <LandingNavbar />
        <p className="mx-auto w-[min(960px,92%)] py-16 text-sm font-bold text-slate-500">Đang tải bài viết...</p>
      </div>
    );
  }

  if (error || !post) {
    return <Navigate to="/blog" replace />;
  }

  return (
    <div className="min-h-screen bg-[#f5fbfa] text-[#12312f]">
      <LandingNavbar />

      <main>
        <article>
          <section className="border-b border-teal-100 bg-gradient-to-b from-white to-teal-50/80 py-16">
            <div className="mx-auto w-[min(960px,92%)]">
              <Link to="/blog" className="text-sm font-black text-teal-700 hover:text-teal-900">
                Quay lại blog
              </Link>
              <div className="mt-6 flex flex-wrap items-center gap-3 text-xs font-black uppercase tracking-wide text-teal-700">
                <span className="rounded-full border border-teal-200 bg-white px-3 py-1.5">{post.category}</span>
                <span className="text-slate-400">{post.date}</span>
                <span className="text-slate-400">{post.readTime}</span>
              </div>
              <h1 className="mt-5 text-4xl font-black leading-tight sm:text-5xl">{post.title}</h1>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-500">{post.excerpt}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <span className="rounded-full bg-white px-4 py-2 text-sm font-black text-teal-700 shadow-sm">👁 {post.viewCount || 0} lượt xem</span>
                <span className="rounded-full bg-white px-4 py-2 text-sm font-black text-amber-600 shadow-sm">★ {post.ratingAverage || 0}/5 ({post.ratingCount || 0})</span>
                <span className="rounded-full bg-white px-4 py-2 text-sm font-black text-sky-700 shadow-sm">💬 {post.comments?.length || 0} bình luận</span>
              </div>
            </div>
          </section>

          <section className="py-14">
            <div className="mx-auto grid w-[min(960px,92%)] gap-8 lg:grid-cols-[1fr_280px]">
              <div className="rounded-[34px] border border-teal-100 bg-white p-7 shadow-xl shadow-teal-900/5 sm:p-10">
                <div className="rounded-[28px] bg-gradient-to-br from-teal-700 via-teal-500 to-sky-400 p-6 text-white">
                  <p className="text-sm font-bold text-white/75">Điểm chính</p>
                  <h2 className="mt-2 text-2xl font-black">{post.highlight}</h2>
                </div>

                <div className="mt-8 grid gap-8">
                  {post.content.map((section) => (
                    <section key={section.heading}>
                      <h2 className="text-2xl font-black text-[#12312f]">{section.heading}</h2>
                      <p className="mt-3 text-base leading-8 text-slate-600">{section.body}</p>
                    </section>
                  ))}
                </div>

                <div className="mt-10 rounded-[28px] border border-amber-100 bg-amber-50 p-6">
                  <h2 className="text-xl font-black">Đánh giá bài viết</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">Bạn thấy nội dung này hữu ích ở mức nào?</p>
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <RatingStars value={rating} onChange={setRating} />
                    <button
                      type="button"
                      onClick={submitRating}
                      className="min-h-11 rounded-full bg-teal-700 px-5 text-sm font-black text-white transition hover:bg-teal-800"
                    >
                      Gửi đánh giá
                    </button>
                  </div>
                </div>

                <div className="mt-8 rounded-[28px] border border-teal-100 bg-[#fbfffe] p-6">
                  <h2 className="text-xl font-black">Bình luận</h2>
                  <form className="mt-5 grid gap-4" onSubmit={submitComment}>
                    <input
                      value={commentForm.name}
                      onChange={(event) => setCommentForm({ ...commentForm, name: event.target.value })}
                      placeholder="Tên của bạn"
                      className="min-h-12 rounded-2xl border border-teal-100 bg-white px-4 text-sm outline-none focus:border-teal-500"
                    />
                    <textarea
                      value={commentForm.content}
                      onChange={(event) => setCommentForm({ ...commentForm, content: event.target.value })}
                      placeholder="Viết bình luận về bài viết..."
                      className="min-h-28 rounded-2xl border border-teal-100 bg-white px-4 py-3 text-sm outline-none focus:border-teal-500"
                    />
                    {submitError ? <p className="rounded-2xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{submitError}</p> : null}
                    {success ? <p className="rounded-2xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{success}</p> : null}
                    <button className="min-h-12 rounded-full bg-teal-700 px-5 text-sm font-black text-white transition hover:bg-teal-800">
                      Gửi bình luận
                    </button>
                  </form>

                  <div className="mt-6 grid gap-3">
                    {(post.comments || []).map((comment) => (
                      <div key={comment._id || comment.createdAt} className="rounded-2xl border border-teal-100 bg-white p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <strong className="text-sm text-[#12312f]">{comment.name}</strong>
                          <span className="text-xs font-semibold text-slate-400">
                            {comment.createdAt ? new Intl.DateTimeFormat("vi-VN").format(new Date(comment.createdAt)) : ""}
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{comment.content}</p>
                      </div>
                    ))}
                    {!post.comments?.length ? (
                      <p className="rounded-2xl bg-white p-4 text-sm font-semibold text-slate-500">
                        Chưa có bình luận nào. Hãy là người đầu tiên chia sẻ cảm nhận.
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="mt-10 rounded-[28px] border border-emerald-100 bg-emerald-50 p-6">
                  <h2 className="text-xl font-black">Gia đình cần hỗ trợ đặt lịch?</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    CareGo giúp bạn đặt người đồng hành theo giờ, theo dõi GPS, nhận ảnh xác nhận và báo cáo sau ca.
                  </p>
                  <Link
                    to="/register"
                    className="mt-5 inline-flex min-h-11 items-center rounded-full bg-teal-700 px-5 text-sm font-black text-white transition hover:bg-teal-800"
                  >
                    Bắt đầu đặt lịch
                  </Link>
                </div>
              </div>

              <aside className="space-y-4">
                <div className="rounded-[28px] border border-teal-100 bg-white p-5 shadow-xl shadow-teal-900/5">
                  <h2 className="font-black">Bài viết liên quan</h2>
                  <div className="mt-4 grid gap-3">
                    {relatedPosts.map((item) => (
                      <Link
                        key={item.slug}
                        to={`/blog/${item.slug}`}
                        className="rounded-2xl border border-teal-50 bg-[#f7fffe] p-4 transition hover:border-teal-200 hover:bg-teal-50"
                      >
                        <p className="text-xs font-bold text-teal-700">{item.category}</p>
                        <h3 className="mt-2 text-sm font-black leading-5">{item.title}</h3>
                        <p className="mt-2 text-xs font-semibold text-slate-400">👁 {item.viewCount || 0} • ★ {item.ratingAverage || 0}</p>
                      </Link>
                    ))}
                  </div>
                </div>
              </aside>
            </div>
          </section>
        </article>
      </main>

      <LandingFooter />
    </div>
  );
};

export default BlogDetailPage;
