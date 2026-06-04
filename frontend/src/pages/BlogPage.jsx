import { Link } from "react-router";
import { blogPosts } from "../components/blog/blogData.js";
import LandingNavbar from "../components/landing/LandingNavbar.jsx";
import { LandingFooter } from "../components/landing/LandingSections.jsx";

const BlogVisual = ({ category }) => (
  <div className="relative h-44 overflow-hidden rounded-[28px] bg-gradient-to-br from-teal-700 via-teal-500 to-sky-400">
    <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/25 blur-2xl" />
    <div className="absolute -bottom-12 left-8 h-36 w-36 rounded-full bg-emerald-200/30 blur-2xl" />
    <div className="absolute inset-x-5 bottom-5 rounded-3xl border border-white/25 bg-white/90 p-4 shadow-xl shadow-teal-950/15">
      <p className="text-xs font-black uppercase tracking-wide text-teal-700">{category}</p>
      <div className="mt-3 grid h-12 w-12 place-items-center rounded-2xl bg-teal-50 text-teal-800">
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
          <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
            <path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Z" />
            <path d="M8 8h7M8 12h8M8 16h5" />
          </g>
        </svg>
      </div>
    </div>
  </div>
);

const BlogPage = () => (
  <div className="min-h-screen bg-[#f5fbfa] text-[#12312f]">
    <LandingNavbar />

    <main>
      <section className="border-b border-teal-100 bg-gradient-to-b from-white to-teal-50/70 py-16">
        <div className="mx-auto w-[min(1180px,92%)]">
          <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-black uppercase tracking-wide text-emerald-700">
            Góc chăm sóc CareGo
          </span>
          <h1 className="mt-5 max-w-3xl text-4xl font-black leading-tight sm:text-5xl">
            Kiến thức chăm sóc người cao tuổi cho gia đình bận rộn
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-500">
            Các bài viết ngắn giúp gia đình chuẩn bị tốt hơn khi đặt lịch chăm sóc, đi khám và theo dõi ca làm.
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto grid w-[min(1180px,92%)] gap-6 md:grid-cols-2 xl:grid-cols-3">
          {blogPosts.map((post) => (
            <Link
              key={post.slug}
              to={`/blog/${post.slug}`}
              className="group rounded-[32px] border border-teal-100 bg-white p-4 shadow-xl shadow-teal-900/5 transition hover:-translate-y-1 hover:shadow-2xl hover:shadow-teal-900/10"
            >
              <BlogVisual category={post.category} />
              <div className="p-3">
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-400">
                  <span>{post.date}</span>
                  <span>•</span>
                  <span>{post.readTime}</span>
                </div>
                <h2 className="mt-3 text-xl font-black leading-snug text-[#12312f] group-hover:text-teal-800">
                  {post.title}
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-500">{post.excerpt}</p>
                <span className="mt-5 inline-flex text-sm font-black text-teal-700">
                  Đọc bài viết
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>

    <LandingFooter />
  </div>
);

export default BlogPage;
