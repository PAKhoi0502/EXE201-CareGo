import { Link, useParams } from "react-router";
import { api } from "../../api/client.js";
import CareGoLogo from "../../components/CareGoLogo.jsx";
import { useAsync } from "../../hooks/useAsync.js";

const LegalDocumentPage = () => {
  const { slug } = useParams();
  const { data, loading, error } = useAsync(() => api.get(`/legal/documents/${slug}`), [slug]);
  const document = data?.document;

  return (
    <div className="min-h-screen bg-[#f5fbfa] text-slate-900">
      <header className="border-b border-teal-900/10 bg-white/90 backdrop-blur">
        <div className="mx-auto flex min-h-20 w-[min(980px,92%)] items-center justify-between gap-4 py-3">
          <Link to="/">
            <CareGoLogo subtitle="Tài liệu pháp lý" />
          </Link>
          <Link to="/" className="rounded-full border border-teal-200 bg-white px-4 py-2 text-sm font-black text-teal-700">
            Về trang chủ
          </Link>
        </div>
      </header>

      <main className="mx-auto w-[min(900px,92%)] py-10">
        {loading ? <p className="text-sm font-semibold text-slate-500">Đang tải tài liệu...</p> : null}
        {error ? <p className="rounded-2xl bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</p> : null}
        {document ? (
          <article className="overflow-hidden rounded-[32px] border border-teal-100 bg-white shadow-xl shadow-teal-900/5">
            <div className="bg-gradient-to-br from-teal-700 to-cyan-500 p-7 text-white sm:p-10">
              <p className="text-xs font-black uppercase tracking-wide text-teal-100">Phiên bản {document.version}</p>
              <h1 className="mt-3 text-3xl font-black sm:text-4xl">{document.title}</h1>
              <p className="mt-4 max-w-3xl leading-7 text-white/85">{document.summary}</p>
            </div>
            <div className="grid gap-8 p-7 sm:p-10">
              {document.sections?.map((section, index) => (
                <section key={section.title}>
                  <div className="flex items-start gap-4">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-teal-50 text-xs font-black text-teal-700">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <h2 className="text-lg font-black text-[#12312f]">{section.title}</h2>
                      <div className="mt-2 grid gap-3 text-sm leading-7 text-slate-600">
                        {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                      </div>
                    </div>
                  </div>
                </section>
              ))}
            </div>
          </article>
        ) : null}
      </main>
    </div>
  );
};

export default LegalDocumentPage;
