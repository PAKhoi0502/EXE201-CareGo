import { Link, Navigate, useParams } from "react-router";
import { getBlogPostBySlug, blogPosts } from "../components/blog/blogData.js";
import LandingNavbar from "../components/landing/LandingNavbar.jsx";
import { LandingFooter } from "../components/landing/LandingSections.jsx";

const BlogDetailPage = () => {
  const { slug } = useParams();
  const post = getBlogPostBySlug(slug);
  const relatedPosts = blogPosts.filter((item) => item.slug !== slug).slice(0, 3);

  if (!post) {
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
