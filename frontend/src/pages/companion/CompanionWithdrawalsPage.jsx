import { useMemo, useState } from "react";
import { api } from "../../api/client";
import { useAsync } from "../../hooks/useAsync";

const currency = (value) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const dateTime = (value) => {
  if (!value) return "-";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
};

const getNumber = (data, keys) => {
  for (const key of keys) {
    if (data?.[key] !== undefined && data?.[key] !== null) {
      return Number(data[key] || 0);
    }
  }
  return 0;
};

const getRequests = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.requests)) return data.requests;
  if (Array.isArray(data?.withdrawals)) return data.withdrawals;
  if (Array.isArray(data?.withdrawalRequests)) return data.withdrawalRequests;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

const getMaskedBankAccountNumber = (request) =>
  request.bankAccountNumberMasked || request.bankAccountNumber || "-";

const statusLabels = {
  pending: "Chá» xá»­ lÃ½",
  approved: "ÄÃ£ duyá»‡t",
  paid: "ÄÃ£ rÃºt",
  rejected: "Tá»« chá»‘i",
};

const statusClasses = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  approved: "bg-blue-50 text-blue-700 border-blue-200",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
};

export default function CompanionWithdrawalsPage() {
  const [form, setForm] = useState({
    amount: "",
    bankName: "",
    bankAccountNumber: "",
    bankAccountName: "",
    note: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const { data, loading, error, reload } = useAsync(() => api.get("/withdrawals/my"), []);

  const requests = useMemo(() => getRequests(data), [data]);
  const summary = useMemo(() => {
    const fallbackPending = requests
      .filter((item) => item.status === "pending")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const fallbackWithdrawn = requests
      .filter((item) => item.status === "approved" || item.status === "paid")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    return {
      availableBalance: getNumber(data, ["availableBalance", "available", "balance", "walletBalance", "canWithdraw"]),
      pendingAmount: getNumber(data, ["pendingAmount", "pending", "pendingBalance"]) || fallbackPending,
      withdrawnAmount: getNumber(data, ["withdrawnAmount", "withdrawn", "paidAmount"]) || fallbackWithdrawn,
      totalEarned: getNumber(data, ["totalEarned", "totalIncome", "earnings"]),
    };
  }, [data, requests]);

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage("");

    try {
      setSubmitting(true);
      await api.post("/withdrawals", {
        ...form,
        amount: Number(form.amount),
      });
      setForm({
        amount: "",
        bankName: "",
        bankAccountNumber: "",
        bankAccountName: "",
        note: "",
      });
      setMessage("ÄÃ£ gá»­i yÃªu cáº§u rÃºt tiá»n cho quáº£n trá»‹ viÃªn.");
      await reload();
    } catch (submitError) {
      setMessage(submitError?.message || "KhÃ´ng gá»­i Ä‘Æ°á»£c yÃªu cáº§u rÃºt tiá»n.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5fbfa] px-4 py-8 text-[#12312f] sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-[28px] border border-teal-100 bg-gradient-to-br from-teal-700 to-teal-400 p-6 text-white shadow-xl shadow-teal-100">
          <p className="text-sm font-black uppercase tracking-wide text-teal-100">VÃ­ ngÆ°á»i Ä‘á»“ng hÃ nh</p>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-black">RÃºt tiá»n</h1>
              <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-teal-50">
                Gá»­i yÃªu cáº§u rÃºt tiá»n tá»« vÃ­ thu nháº­p. Dá»¯ liá»‡u lÃ m cÄƒn cá»© váº«n Ä‘i tá»« sÃ³ cáº¡i `Payment`.
              </p>
            </div>
            <button
              type="button"
              onClick={reload}
              className="rounded-full bg-white px-5 py-3 text-sm font-black text-teal-700 shadow-lg shadow-teal-800/10 transition hover:-translate-y-0.5"
            >
              LÃ m má»›i
            </button>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-teal-100 bg-white p-5 shadow-lg shadow-teal-50">
            <p className="text-sm font-bold text-slate-500">CÃ³ thá»ƒ rÃºt</p>
            <p className="mt-2 text-3xl font-black text-teal-700">{currency(summary.availableBalance)}</p>
          </div>
          <div className="rounded-3xl border border-teal-100 bg-white p-5 shadow-lg shadow-teal-50">
            <p className="text-sm font-bold text-slate-500">Äang chá» xá»­ lÃ½</p>
            <p className="mt-2 text-3xl font-black text-amber-600">{currency(summary.pendingAmount)}</p>
          </div>
          <div className="rounded-3xl border border-teal-100 bg-white p-5 shadow-lg shadow-teal-50">
            <p className="text-sm font-bold text-slate-500">ÄÃ£ rÃºt</p>
            <p className="mt-2 text-3xl font-black text-slate-950">{currency(summary.withdrawnAmount)}</p>
          </div>
        </section>

        {summary.totalEarned > 0 ? (
          <div className="rounded-3xl border border-teal-100 bg-white px-5 py-4 text-sm font-bold text-slate-600 shadow-lg shadow-teal-50">
            Tá»•ng thu nháº­p Ä‘Ã£ ghi nháº­n: <span className="font-black text-teal-700">{currency(summary.totalEarned)}</span>
          </div>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[1fr_1.05fr]">
          <form onSubmit={handleSubmit} className="rounded-[28px] border border-teal-100 bg-white p-6 shadow-xl shadow-teal-50">
            <h2 className="text-2xl font-black text-slate-950">Táº¡o yÃªu cáº§u rÃºt tiá»n</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
              Nháº­p thÃ´ng tin ngÃ¢n hÃ ng chÃ­nh xÃ¡c Ä‘á»ƒ admin xá»­ lÃ½ chuyá»ƒn khoáº£n.
            </p>

            <div className="mt-5 grid gap-4">
              <label className="grid gap-2 text-sm font-extrabold text-slate-700">
                Sá»‘ tiá»n muá»‘n rÃºt
                <input type="number" min="1000" step="1000" value={form.amount} onChange={(event) => updateForm("amount", event.target.value)} placeholder="VD: 100000" className="min-h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100" required />
              </label>

              <label className="grid gap-2 text-sm font-extrabold text-slate-700">
                NgÃ¢n hÃ ng
                <input value={form.bankName} onChange={(event) => updateForm("bankName", event.target.value)} placeholder="VD: Vietcombank" className="min-h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100" required />
              </label>

              <label className="grid gap-2 text-sm font-extrabold text-slate-700">
                Sá»‘ tÃ i khoáº£n
                <input value={form.bankAccountNumber} onChange={(event) => updateForm("bankAccountNumber", event.target.value)} placeholder="Nháº­p sá»‘ tÃ i khoáº£n" className="min-h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100" required />
              </label>

              <label className="grid gap-2 text-sm font-extrabold text-slate-700">
                TÃªn chá»§ tÃ i khoáº£n
                <input value={form.bankAccountName} onChange={(event) => updateForm("bankAccountName", event.target.value)} placeholder="TÃªn Ä‘Ãºng trÃªn ngÃ¢n hÃ ng" className="min-h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100" required />
              </label>

              <label className="grid gap-2 text-sm font-extrabold text-slate-700">
                Ghi chÃº
                <textarea value={form.note} onChange={(event) => updateForm("note", event.target.value)} placeholder="CÃ³ thá»ƒ Ä‘á»ƒ trá»‘ng" className="min-h-28 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100" />
              </label>
            </div>

            {message || error ? (
              <div className="mt-4 rounded-2xl border border-teal-100 bg-teal-50 px-4 py-3 text-sm font-bold text-teal-700">
                {message || error}
              </div>
            ) : null}

            <button type="submit" disabled={submitting} className="mt-5 min-h-12 w-full rounded-2xl bg-gradient-to-r from-teal-700 to-teal-400 px-5 text-sm font-black text-white shadow-lg shadow-teal-100 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60">
              {submitting ? "Äang gá»­i..." : "Gá»­i yÃªu cáº§u rÃºt tiá»n"}
            </button>
          </form>

          <section className="rounded-[28px] border border-teal-100 bg-white p-6 shadow-xl shadow-teal-50">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-slate-950">Lá»‹ch sá»­ rÃºt tiá»n</h2>
                <p className="mt-2 text-sm font-semibold text-slate-500">Theo dÃµi cÃ¡c yÃªu cáº§u Ä‘Ã£ gá»­i cho admin.</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-4 py-2 text-xs font-black text-emerald-700">{requests.length} yÃªu cáº§u</span>
            </div>

            <div className="mt-5 space-y-3">
              {loading ? (
                <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center font-bold text-slate-500">Äang táº£i lá»‹ch sá»­ rÃºt tiá»n...</div>
              ) : requests.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center font-bold text-slate-500">ChÆ°a cÃ³ yÃªu cáº§u rÃºt tiá»n.</div>
              ) : (
                requests.map((request) => (
                  <article key={request._id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xl font-black text-slate-950">{currency(request.amount)}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-500">
                          {request.bankName || "-"} Â· {getMaskedBankAccountNumber(request)}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-slate-400">{dateTime(request.createdAt)}</p>
                      </div>
                      <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${statusClasses[request.status] || statusClasses.pending}`}>
                        {statusLabels[request.status] || "Chá» xá»­ lÃ½"}
                      </span>
                    </div>
                    {request.note ? (
                      <p className="mt-3 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-500">{request.note}</p>
                    ) : null}
                  </article>
                ))
              )}
            </div>
          </section>
        </section>
      </div>
    </div>
  );
}
