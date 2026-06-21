import { useMemo, useState } from "react";
import { Link } from "react-router";
import { api } from "../api/client.js";
import LandingNavbar from "../components/landing/LandingNavbar.jsx";
import { LandingFooter } from "../components/landing/LandingSections.jsx";
import { useAsync } from "../hooks/useAsync.js";

const categoryStyles = {
  "Đi khám": "from-sky-500 to-teal-500",
  "Gia đình": "from-emerald-500 to-teal-500",
  "An toàn": "from-amber-500 to-rose-500",
  "Người đồng hành": "from-teal-600 to-blue-600",
};

const BlogArtwork = ({ category, large = false }) => {
  const gradient = categoryStyles[category] || "from-teal-600 to-sky-500";

  return (
    <div className={`relative overflow-hidden rounded-[30px] bg-gradient-to-br ${gradient} ${large ? "min-h-[340px]" : "h-56"}`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(255,255,255,0.38),transparent_28%),radial-gradient(circle_at_82%_18%,rgba(255,255,255,0.24),transparent_24%)]" />
      <div className="absolute -bottom-16 -right-10 h-52 w-52 rounded-full bg-white/20 blur-2xl" />
      <div className="absolute left-5 top-5 rounded-full border border-white/25 bg-white/20 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-white backdrop-blur">
        {category}
      </div>
      <div className="absolute bottom-5 left-5 right-5 rounded-[26px] border border-white/25 bg-white/92 p-5 shadow-2xl shadow-slate-950/15 backdrop-blur">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-teal-50 text-teal-700">
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" aria-hidden="true">
            <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
              <path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Z" />
              <path d="M8 8h7M8 12h8M8 16h5" />
            </g>
          </svg>
        </div>
        <p className="mt-4 text-sm font-black text-slate-900">CareGo Insights</p>
        <p className="mt-1 text-xs font-semibold text-slate-500">Kiến thức chăm sóc dễ đọc, dễ áp dụng.</p>
      </div>
    </div>
  );
};

const Metric = ({ children, tone = "teal" }) => {
  const tones = {
    teal: "bg-teal-50 text-teal-700",
    amber: "bg-amber-50 text-amber-700",
    sky: "bg-sky-50 text-sky-700",
  };

  return <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-black ${tones[tone]}`}>{children}</span>;
};

const BlogCard = ({ post }) => (
  <Link
    to={`/blog/${post.slug}`}
    className="group flex h-full flex-col rounded-[32px] border border-teal-100 bg-white p-4 shadow-xl shadow-teal-900/5 transition duration-300 hover:-translate-y-1 hover:border-teal-200 hover:shadow-2xl hover:shadow-teal-900/10"
  >
    <BlogArtwork category={post.category} />
    <div className="flex flex-1 flex-col p-3">
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-400">
        <span>{post.date}</span>
        <span>•</span>
        <span>{post.readTime}</span>
      </div>
      <h2 className="mt-3 text-xl font-black leading-snug text-[#12312f] transition group-hover:text-teal-700">
        {post.title}
      </h2>
      <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-500">{post.excerpt}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Metric>{post.viewCount || 0} lượt xem</Metric>
        <Metric tone="amber">★ {post.ratingAverage || 0}</Metric>
        <Metric tone="sky">{post.comments?.length || post.commentCount || 0} bình luận</Metric>
      </div>
      <span className="mt-6 inline-flex items-center gap-2 text-sm font-black text-teal-700">
        Đọc bài viết
        <svg viewBox="0 0 24 24" className="h-4 w-4 transition group-hover:translate-x-1" fill="none" aria-hidden="true">
          <path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
        </svg>
      </span>
    </div>
  </Link>
);

const BlogPage = () => {
  const { data, loading, error } = useAsync(() => api.get("/blogs"), []);
  const [activeCategory, setActiveCategory] = useState("Tất cả");
  const posts = data?.posts || [];
  const categories = useMemo(() => ["Tất cả", ...new Set(posts.map((post) => post.category).filter(Boolean))], [posts]);
  const filteredPosts = activeCategory === "Tất cả" ? posts : posts.filter((post) => post.category === activeCategory);
  const featuredPost = filteredPosts[0] || posts[0];
  const remainingPosts = featuredPost ? filteredPosts.filter((post) => post.slug !== featuredPost.slug) : filteredPosts;

  return (
    <div className="min-h-screen bg-[#f5fbfa] text-[#12312f]">
      <LandingNavbar />

      <main>
        <section className="relative overflow-hidden border-b border-teal-100 bg-gradient-to-b from-white via-teal-50/70 to-[#f5fbfa] py-16 sm:py-20">
          <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_20%_20%,rgba(20,184,166,0.18),transparent_34%),radial-gradient(circle_at_86%_12%,rgba(56,189,248,0.14),transparent_28%)]" />
          <div className="relative mx-auto grid w-[min(1180px,92%)] gap-10 lg:grid-cols-[1fr_420px] lg:items-center">
            <div>
              <span className="inline-flex rounded-full border border-emerald-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-emerald-700 shadow-sm">
                Góc chăm sóc CareGo
              </span>
              <h1 className="mt-6 max-w-3xl text-4xl font-black leading-tight tracking-tight sm:text-6xl">
                Kiến thức chăm sóc ba mẹ, viết cho gia đình bận rộn
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-500 sm:text-lg">
                Những bài viết ngắn, dễ hiểu về đi khám, chăm sóc tại nhà, an toàn ca làm và cách theo dõi người thân qua CareGo.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href="#blog-list" className="inline-flex min-h-12 items-center rounded-full bg-teal-700 px-6 text-sm font-black text-white shadow-lg shadow-teal-900/20 transition hover:bg-teal-800">
                  Khám phá bài viết
                </a>
                <Link to="/register" className="inline-flex min-h-12 items-center rounded-full border border-teal-100 bg-white px-6 text-sm font-black text-teal-700 transition hover:bg-teal-50">
                  Đặt lịch chăm sóc
                </Link>
              </div>
            </div>
            <div className="rounded-[36px] border border-teal-100 bg-white/80 p-4 shadow-2xl shadow-teal-900/10 backdrop-blur">
              <BlogArtwork category={featuredPost?.category || "CareGo"} large />
            </div>
          </div>
        </section>

        <section id="blog-list" className="py-14 sm:py-16">
          <div className="mx-auto w-[min(1180px,92%)]">
            <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-3xl font-black text-slate-950">Bài viết mới nhất</h2>
                <p className="mt-2 text-sm font-semibold text-slate-500">Lọc theo chủ đề để tìm nội dung phù hợp với nhu cầu của gia đình.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setActiveCategory(category)}
                    className={`rounded-full px-4 py-2 text-xs font-black transition ${
                      activeCategory === category
                        ? "bg-teal-700 text-white shadow-lg shadow-teal-900/15"
                        : "border border-teal-100 bg-white text-teal-700 hover:bg-teal-50"
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>

            {loading ? <p className="text-sm font-bold text-slate-500">Đang tải blog...</p> : null}
            {error ? <p className="rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</p> : null}

            {featuredPost ? (
              <Link
                to={`/blog/${featuredPost.slug}`}
                className="group mb-8 grid overflow-hidden rounded-[36px] border border-teal-100 bg-white shadow-2xl shadow-teal-900/8 transition hover:-translate-y-1 hover:shadow-teal-900/12 lg:grid-cols-[0.9fr_1.1fr]"
              >
                <div className="p-4">
                  <BlogArtwork category={featuredPost.category} large />
                </div>
                <div className="flex flex-col justify-center p-6 sm:p-9">
                  <span className="inline-flex w-fit rounded-full bg-amber-50 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-amber-700">
                    Bài nổi bật
                  </span>
                  <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-400">
                    <span>{featuredPost.category}</span>
                    <span>•</span>
                    <span>{featuredPost.date}</span>
                    <span>•</span>
                    <span>{featuredPost.readTime}</span>
                  </div>
                  <h3 className="mt-4 text-3xl font-black leading-tight text-slate-950 transition group-hover:text-teal-700">
                    {featuredPost.title}
                  </h3>
                  <p className="mt-4 text-base leading-8 text-slate-500">{featuredPost.excerpt}</p>
                  <div className="mt-6 flex flex-wrap gap-2">
                    <Metric>{featuredPost.viewCount || 0} lượt xem</Metric>
                    <Metric tone="amber">★ {featuredPost.ratingAverage || 0}</Metric>
                    <Metric tone="sky">{featuredPost.comments?.length || featuredPost.commentCount || 0} bình luận</Metric>
                  </div>
                </div>
              </Link>
            ) : null}

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {remainingPosts.map((post) => (
                <BlogCard key={post.slug} post={post} />
              ))}
            </div>

            {!filteredPosts.length && !loading ? (
              <div className="rounded-[30px] border border-teal-100 bg-white p-8 text-center shadow-xl shadow-teal-900/5">
                <p className="text-sm font-bold text-slate-500">Chưa có bài viết trong danh mục này.</p>
              </div>
            ) : null}
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
};

export default BlogPage;
