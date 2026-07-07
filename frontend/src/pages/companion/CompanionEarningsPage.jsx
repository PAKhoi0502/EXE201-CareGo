import { Link } from "react-router";
import { api } from "../../api/client.js";
import { Button, Card, EmptyState, PageHeader, StatusBadge } from "../../components/Ui.jsx";
import { useAsync } from "../../hooks/useAsync.js";
import { dateTime, money } from "../../utils/format.js";

const StatCard = ({ label, value, tone = "emerald" }) => {
  const tones = {
    emerald: "border-emerald-100 bg-emerald-50 text-emerald-700",
    sky: "border-sky-100 bg-sky-50 text-sky-700",
    teal: "border-teal-100 bg-teal-50 text-teal-700",
    slate: "border-slate-100 bg-slate-50 text-slate-800",
  };

  return (
    <div className={`rounded-[22px] border p-4 ${tones[tone] || tones.emerald}`}>
      <p className="text-xs font-black uppercase opacity-70">{label}</p>
      <p className="mt-2 text-xl font-black">{value}</p>
    </div>
  );
};

const CompanionEarningsPage = () => {
  const { data, loading, error } = useAsync(() => api.get("/withdrawals/earnings?limit=50"), []);
  const summary = data?.summary || {};
  const entries = data?.entries || data?.items || data?.earnings || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Thu nháº­p cá»§a tÃ´i"
        subtitle="Theo dÃµi thu nháº­p Ä‘Ã£ Ä‘Æ°á»£c thanh toÃ¡n theo Payment.paidAt Ä‘á»ƒ Ä‘á»“ng bá»™ vá»›i vÃ­ rÃºt tiá»n."
        action={(
          <Link to="/companion/bookings">
            <Button variant="secondary">Quay láº¡i ca lÃ m</Button>
          </Link>
        )}
      />

      <section className="rounded-[32px] border border-teal-100 bg-white/95 p-6 shadow-xl shadow-teal-900/10">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="HÃ´m nay" value={money(summary.today || 0)} />
          <StatCard label="Tuáº§n nÃ y" value={money(summary.week || 0)} tone="sky" />
          <StatCard label="ThÃ¡ng nÃ y" value={money(summary.month || 0)} tone="teal" />
          <StatCard label="Tá»•ng Ä‘Ã£ nháº­n" value={money(summary.total || 0)} tone="slate" />
        </div>
      </section>

      <section className="rounded-[32px] border border-teal-100 bg-white/95 p-6 shadow-xl shadow-teal-900/10">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-950">Lá»‹ch sá»­ thu nháº­p</h2>
            <p className="mt-1 text-sm text-slate-500">Chá»‰ hiá»ƒn thá»‹ cÃ¡c khoáº£n Ä‘Ã£ paid vÃ  láº¥y ngÃ y thanh toÃ¡n tá»« ledger.</p>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
            {entries.length} khoáº£n thu nháº­p
          </span>
        </div>

        {loading ? <p className="mt-5 text-sm text-slate-500">Äang táº£i...</p> : null}
        {error ? <p className="mt-5 text-sm text-rose-600">{error}</p> : null}
        {!loading && entries.length === 0 ? <EmptyState title="ChÆ°a cÃ³ thu nháº­p" /> : null}

        <div className="mt-5 grid gap-4">
          {entries.map((entry) => (
            <Card key={entry._id} className="border-emerald-100 bg-white/95 shadow-lg shadow-emerald-900/5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-slate-950">{entry.booking?.serviceId?.name || "Ca chÄƒm sÃ³c"}</h3>
                    <StatusBadge status={entry.booking?.status || "paid"} />
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {entry.booking?.elderProfileId?.fullName || "KhÃ´ng rÃµ ngÆ°á»i thÃ¢n"} â€¢ {dateTime(entry.booking?.startTime)}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-400">
                    Thanh toÃ¡n: {dateTime(entry.paidAt)}
                  </p>
                </div>
                <div className="text-left md:text-right">
                  <p className="text-lg font-black text-emerald-700">{money(entry.amount || 0)}</p>
                  {entry.bookingId ? (
                    <Link to={`/companion/bookings/${entry.bookingId}`}>
                      <Button variant="secondary" className="mt-2 min-h-9 px-3 text-xs">Xem chi tiáº¿t</Button>
                    </Link>
                  ) : null}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
};

export default CompanionEarningsPage;
