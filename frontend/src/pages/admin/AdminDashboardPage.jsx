import { api } from "../../api/client.js";
import { Card, PageHeader } from "../../components/Ui.jsx";
import { useAsync } from "../../hooks/useAsync.js";
import { money } from "../../utils/format.js";

const AdminDashboardPage = () => {
  const { data, loading, error } = useAsync(() => api.get("/admin/dashboard"), []);

  return (
    <>
      <PageHeader title="Admin dashboard" subtitle="Tong quan van hanh CareGo." />
      {loading ? <p>Dang tai...</p> : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {data ? (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card><p className="text-sm text-slate-500">Users</p><p className="mt-2 text-2xl font-bold">{data.totalUsers}</p></Card>
            <Card><p className="text-sm text-slate-500">Companions</p><p className="mt-2 text-2xl font-bold">{data.totalCompanions}</p></Card>
            <Card><p className="text-sm text-slate-500">Services</p><p className="mt-2 text-2xl font-bold">{data.totalServices}</p></Card>
            <Card><p className="text-sm text-slate-500">Bookings</p><p className="mt-2 text-2xl font-bold">{data.totalBookings}</p></Card>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <Card><p className="text-sm text-slate-500">Doanh thu</p><p className="mt-2 text-xl font-bold text-teal-700">{money(data.revenue?.revenue)}</p></Card>
            <Card><p className="text-sm text-slate-500">Phi nen tang</p><p className="mt-2 text-xl font-bold text-teal-700">{money(data.revenue?.platformFee)}</p></Card>
            <Card><p className="text-sm text-slate-500">Tien companion</p><p className="mt-2 text-xl font-bold text-teal-700">{money(data.revenue?.companionEarning)}</p></Card>
          </div>
        </>
      ) : null}
    </>
  );
};

export default AdminDashboardPage;
