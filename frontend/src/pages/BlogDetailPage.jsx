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

const ArticleMetric = ({ label, value, tone = "teal" }) => {
  const tones = {
    teal: "bg-teal-50 text-teal-700",
    amber: "bg-amber-50 text-amber-700",
    sky: "bg-sky-50 text-sky-700",
  };

  return (
    <div className={`rounded-2xl px-4 py-3 ${tones[tone]}`}>
      <p className="text-xs font-black uppercase tracking-wide opacity-75">{label}</p>
      <strong className="mt-1 block text-lg font-black">{value}</strong>
    </div>
  );
};

const BlogHeroVisual = ({ category, imageUrl }) => (
  <div className="relative min-h-[280px] overflow-hidden rounded-[34px] bg-gradient-to-br from-teal-700 via-teal-500 to-sky-500 shadow-2xl shadow-teal-900/15">
    {imageUrl ? (
      <>
        <img src={imageUrl} alt={category || "CareGo blog"} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-slate-950/10 to-transparent" />
      </>
    ) : (
      <>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(255,255,255,0.35),transparent_28%),radial-gradient(circle_at_82%_16%,rgba(255,255,255,0.24),transparent_24%)]" />
        <div className="absolute -bottom-20 -right-12 h-64 w-64 rounded-full bg-white/20 blur-2xl" />
      </>
    )}
    <div className="absolute left-6 top-6 rounded-full border border-white/25 bg-white/20 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-white backdrop-blur">
      {category}
    </div>
    <div className="absolute bottom-6 left-6 right-6 rounded-[28px] border border-white/25 bg-white/92 p-6 backdrop-blur">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-700">CareGo Guide</p>
      <p className="mt-3 text-2xl font-black leading-tight text-slate-950">Chăm sóc người thân chủ động hơn mỗi ngày</p>
    </div>
  </div>
);

const COMMENTS_PER_PAGE = 5;

const BlogDetailPage = () => {
  const { slug } = useParams();
  const { data, setData, loading, error } = useAsync(() => api.get(`/blogs/${slug}`), [slug]);
  const { data: postsData } = useAsync(() => api.get("/blogs"), []);
  const [rating, setRating] = useState(5);
  const [commentForm, setCommentForm] = useState({ name: "", content: "", rating: 5 });
  const [commentPagination, setCommentPagination] = useState({ slug: "", page: 1 });
  const [submitError, setSubmitError] = useState("");
  const [success, setSuccess] = useState("");

  const post = data?.post;
  const relatedPosts = useMemo(
    () => (postsData?.posts || []).filter((item) => item.slug !== slug).slice(0, 3),
    [postsData?.posts, slug],
  );
  const comments = post?.comments || [];
  const totalCommentPages = Math.max(1, Math.ceil(comments.length / COMMENTS_PER_PAGE));
  const rawCommentPage = commentPagination.slug === slug ? commentPagination.page : 1;
  const commentPage = Math.min(rawCommentPage, totalCommentPages);
  const pagedComments = comments.slice(
    (commentPage - 1) * COMMENTS_PER_PAGE,
    commentPage * COMMENTS_PER_PAGE,
  );
  const setCommentPage = (pageOrUpdater) => {
    setCommentPagination((current) => {
      const currentPage = current.slug === slug ? current.page : 1;
      const nextPage =
        typeof pageOrUpdater === "function" ? pageOrUpdater(currentPage) : pageOrUpdater;

      return {
        slug,
        page: Math.min(Math.max(1, nextPage), totalCommentPages),
      };
    });
  };

  useEffect(() => {
    let active = true;
    const trackView = async () => {
      try {
        const result = await api.post(`/blogs/${slug}/view`, {});
        if (active) {
          setData((current) => ({
            ...result,
            post: result?.post
              ? {
                  ...result.post,
                  comments: result.post.comments || current?.post?.comments || [],
                }
              : result?.post,
          }));
        }
      } catch {
        // View tracking should not block reading.
      }
    };
    trackView();
    return () => {
      active = false;
    };
  }, [slug, setData]);

  const submitComment = async (event) => {
    event.preventDefault();
    setSubmitError("");
    setSuccess("");
    try {
      const result = await api.post(`/blogs/${slug}/comments`, { ...commentForm, rating });
      setData(result);
      setCommentForm({ name: "", content: "", rating: 5 });
      setRating(5);
      setCommentPage(1);
      setSuccess("Bình luận và đánh giá của bạn đã được ghi nhận.");
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
          <section className="relative overflow-hidden border-b border-teal-100 bg-gradient-to-b from-white via-teal-50/70 to-[#f5fbfa] py-12 sm:py-16">
            <div className="mx-auto grid w-[min(1180px,92%)] gap-10 lg:grid-cols-[1fr_420px] lg:items-center">
              <div>
                <Link to="/blog" className="inline-flex items-center gap-2 text-sm font-black text-teal-700 hover:text-teal-900">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
                    <path d="M19 12H5m6-6-6 6 6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  </svg>
                  Quay lại Blog
                </Link>
                <div className="mt-6 flex flex-wrap items-center gap-3 text-xs font-black uppercase tracking-wide text-teal-700">
                  <span className="rounded-full border border-teal-200 bg-white px-3 py-1.5">{post.category}</span>
                  <span className="text-slate-400">{post.date}</span>
                  <span className="text-slate-400">{post.readTime}</span>
                </div>
                <h1 className="mt-5 text-4xl font-black leading-tight tracking-tight sm:text-6xl">{post.title}</h1>
                <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-500">{post.excerpt}</p>
                <div className="mt-7 grid gap-3 sm:grid-cols-3">
                  <ArticleMetric label="Lượt xem" value={post.viewCount || 0} />
                  <ArticleMetric label="Đánh giá" value={`${post.ratingAverage || 0}/5`} tone="amber" />
                  <ArticleMetric label="Bình luận" value={post.comments?.length ?? post.commentCount ?? 0} tone="sky" />
                </div>
              </div>
              <BlogHeroVisual category={post.category} imageUrl={post.imageUrl} />
            </div>
          </section>

          <section className="py-12 sm:py-14">
            <div className="mx-auto grid w-[min(1180px,92%)] gap-8 lg:grid-cols-[1fr_320px]">
              <div className="rounded-[34px] border border-teal-100 bg-white p-7 shadow-xl shadow-teal-900/5 sm:p-10">
                <div className="rounded-[28px] bg-gradient-to-br from-teal-700 via-teal-500 to-sky-400 p-6 text-white">
                  <p className="text-sm font-bold text-white/75">Điểm chính</p>
                  <h2 className="mt-2 text-2xl font-black">{post.highlight}</h2>
                </div>

                <div className="mt-9 grid gap-9">
                  {post.content.map((section) => (
                    <section key={section.heading} className="relative border-b border-teal-50 pb-8 last:border-b-0 last:pb-0">
                      <div className="mb-4 flex items-center gap-3">
                        <h2 className="text-2xl font-black text-[#12312f]">{section.heading}</h2>
                      </div>
                      <p className="whitespace-pre-line text-base leading-8 text-slate-600">{section.body}</p>
                    </section>
                  ))}
                </div>

                <div className="mt-10 rounded-[28px] border border-teal-100 bg-[#fbfffe] p-6">
                  <h2 className="text-xl font-black">Bình luận và đánh giá</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Chọn số sao và để lại cảm nhận của bạn về bài viết.
                  </p>
                  <form className="mt-5 grid gap-4" onSubmit={submitComment}>
                    <div className="rounded-[24px] border border-amber-100 bg-amber-50 p-4">
                      <p className="mb-2 text-sm font-black text-slate-800">Đánh giá của bạn</p>
                      <RatingStars value={rating} onChange={setRating} />
                    </div>
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
                    {pagedComments.map((comment) => (
                      <div key={comment._id || comment.createdAt} className="rounded-2xl border border-teal-100 bg-white p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <strong className="text-sm text-[#12312f]">{comment.name}</strong>
                            <div className="mt-1 text-sm font-black text-amber-400">
                              {"★".repeat(comment.rating || 5)}
                              <span className="text-slate-300">{"★".repeat(5 - (comment.rating || 5))}</span>
                            </div>
                          </div>
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
                    {comments.length > COMMENTS_PER_PAGE ? (
                      <div className="mt-2 flex flex-col gap-3 rounded-2xl border border-teal-100 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs font-bold text-slate-500">
                          Hiển thị {(commentPage - 1) * COMMENTS_PER_PAGE + 1}-
                          {Math.min(commentPage * COMMENTS_PER_PAGE, comments.length)} trong {comments.length} bình luận
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            disabled={commentPage === 1}
                            onClick={() => setCommentPage((page) => Math.max(1, page - 1))}
                            className="rounded-full border border-teal-100 px-4 py-2 text-xs font-black text-teal-700 transition hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Trước
                          </button>
                          {Array.from({ length: totalCommentPages }, (_, index) => index + 1).map((page) => (
                            <button
                              key={page}
                              type="button"
                              onClick={() => setCommentPage(page)}
                              className={`grid h-9 w-9 place-items-center rounded-full text-xs font-black transition ${
                                page === commentPage
                                  ? "bg-teal-700 text-white"
                                  : "border border-teal-100 text-teal-700 hover:bg-teal-50"
                              }`}
                            >
                              {page}
                            </button>
                          ))}
                          <button
                            type="button"
                            disabled={commentPage === totalCommentPages}
                            onClick={() => setCommentPage((page) => Math.min(totalCommentPages, page + 1))}
                            className="rounded-full border border-teal-100 px-4 py-2 text-xs font-black text-teal-700 transition hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Sau
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <aside className="space-y-5">
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
                        <p className="mt-2 text-xs font-semibold text-slate-400">
                          {item.viewCount || 0} lượt xem • ★ {item.ratingAverage || 0}
                        </p>
                      </Link>
                    ))}
                  </div>
                </div>

                <div className="rounded-[28px] border border-emerald-100 bg-emerald-50 p-5 shadow-xl shadow-teal-900/5">
                  <h2 className="text-lg font-black text-slate-950">Gia đình cần hỗ trợ đặt lịch?</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    CareGo giúp bạn đặt người đồng hành, theo dõi GPS và nhận báo cáo sau mỗi ca chăm sóc.
                  </p>
                  <Link
                    to="/register"
                    className="mt-5 inline-flex min-h-11 items-center rounded-full bg-teal-700 px-5 text-sm font-black text-white transition hover:bg-teal-800"
                  >
                    Bắt đầu đặt lịch
                  </Link>
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
