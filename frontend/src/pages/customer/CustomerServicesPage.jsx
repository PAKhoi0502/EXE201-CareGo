import { api } from "../../api/client.js";
import { Card, EmptyState, PageHeader } from "../../components/Ui.jsx";
import { useAsync } from "../../hooks/useAsync.js";
import { money } from "../../utils/format.js";

const CustomerServicesPage = () => {
  const { data, loading, error } = useAsync(() => api.get("/services"), []);
  const services = data?.services || [];

  return (
    <>
      <PageHeader title="Dich vu CareGo" subtitle="Cac goi cham soc theo gio dang hoat dong." />
      {loading ? <p>Dang tai...</p> : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {!loading && services.length === 0 ? <EmptyState title="Chua co dich vu" /> : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {services.map((service) => (
          <Card key={service._id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-bold text-slate-950">{service.name}</h2>
                <p className="mt-1 text-sm text-slate-500">{service.description}</p>
              </div>
              <p className="whitespace-nowrap text-sm font-bold text-teal-700">{money(service.pricePerHour)}/h</p>
            </div>
            {service.defaultChecklist?.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {service.defaultChecklist.map((item) => (
                  <span key={item} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                    {item}
                  </span>
                ))}
              </div>
            ) : null}
          </Card>
        ))}
      </div>
    </>
  );
};

export default CustomerServicesPage;
