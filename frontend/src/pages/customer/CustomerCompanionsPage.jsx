import { api } from "../../api/client.js";
import { Card, EmptyState, PageHeader, StatusBadge } from "../../components/Ui.jsx";
import { useAsync } from "../../hooks/useAsync.js";

const CustomerCompanionsPage = () => {
  const { data, loading, error } = useAsync(() => api.get("/companions"), []);
  const companions = data?.companions || [];

  return (
    <>
      <PageHeader title="Nguoi dong hanh" subtitle="Chi hien thi cac ho so da duoc admin duyet." />
      {loading ? <p>Dang tai...</p> : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {!loading && companions.length === 0 ? <EmptyState title="Chua co nguoi dong hanh da duyet" /> : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {companions.map((item) => (
          <Card key={item._id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-bold text-slate-950">{item.fullName}</h2>
                <p className="text-sm text-slate-500">{item.university}</p>
                <p className="text-sm text-slate-500">{item.major}</p>
              </div>
              <StatusBadge status={item.vettingStatus} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {item.skills?.map((skill) => (
                <span key={skill} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                  {skill}
                </span>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </>
  );
};

export default CustomerCompanionsPage;
