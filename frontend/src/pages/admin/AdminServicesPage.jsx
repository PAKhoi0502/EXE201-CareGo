import { useMemo, useState } from "react";
import { api } from "../../api/client.js";
import { Button, Input, Select, StatusBadge, Textarea } from "../../components/Ui.jsx";
import { useAsync } from "../../hooks/useAsync.js";
import { money } from "../../utils/format.js";

const emptyForm = { name: "", code: "", description: "", pricePerHour: 80000, checklistText: "" };

const serviceCategory = (code = "", name = "") => {
  const text = `${code} ${name}`.toLowerCase();
  if (text.includes("hospital") || text.includes("kham") || text.includes("vien")) return "hospital";
  if (text.includes("home") || text.includes("thuoc") || text.includes("nha")) return "home";
  if (text.includes("walk") || text.includes("dao")) return "walk";
  return "other";
};

const categoryLabel = {
  all: "Tat ca",
  hospital: "Di vien",
  home: "Tai nha",
  walk: "Di dao",
  other: "Khac",
};

const AdminServicesPage = () => {
  const { data, reload, error: loadError } = useAsync(() => api.get("/services"), []);
  const [form, setForm] = useState(emptyForm);
  const [submitError, setSubmitError] = useState("");
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const services = data?.services || [];

  const filteredServices = services.filter((service) => {
    const text = `${service.name} ${service.code} ${service.description}`.toLowerCase();
    const category = serviceCategory(service.code, service.name);
    return text.includes(query.toLowerCase()) && (categoryFilter === "all" || category === categoryFilter);
  });

  const averagePrice = useMemo(() => {
    if (!services.length) return 0;
    return services.reduce((sum, item) => sum + (item.pricePerHour || 0), 0) / services.length;
  }, [services]);

  const checklistCount = services.reduce((sum, item) => sum + (item.defaultChecklist?.length || 0), 0);

  const closeModal = () => {
    setIsModalOpen(false);
    setSubmitError("");
  };

  const submit = async (event) => {
    event.preventDefault();
    setSubmitError("");
    try {
      await api.post("/services", {
        name: form.name,
        code: form.code,
        description: form.description,
        pricePerHour: Number(form.pricePerHour),
        defaultChecklist: form.checklistText.split(",").map((item) => item.trim()).filter(Boolean),
      });
      setForm(emptyForm);
      closeModal();
      reload();
    } catch (err) {
      setSubmitError(err.message);
    }
  };

  const disable = async (id) => {
    await api.delete(`/services/${id}`);
    reload();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Quan ly Dich vu</h1>
          <p className="mt-1 text-sm text-slate-500">
            Thiet lap goi CareGo, gia theo gio va checklist van hanh mac dinh.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row xl:w-auto">
          <Button className="whitespace-nowrap" onClick={() => setIsModalOpen(true)}>
            Tao dich vu
          </Button>
          <div className="relative w-full xl:w-96">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tim dich vu, ma, mo ta..."
              className="min-h-11 w-full rounded-xl border border-transparent bg-slate-100 px-4 pl-10 text-sm outline-none transition focus:border-teal-300 focus:bg-white focus:ring-2 focus:ring-teal-100"
            />
            <span className="absolute left-3 top-2.5 text-slate-400">⌕</span>
          </div>
        </div>
      </div>

      {loadError ? <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{loadError}</p> : null}

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="block text-xs font-medium text-slate-400">Tong dich vu</span>
          <p className="mt-2 text-2xl font-bold text-slate-900">{services.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="block text-xs font-medium text-slate-400">Gia trung binh</span>
          <p className="mt-2 text-2xl font-bold text-teal-700">{money(averagePrice)}</p>
        </div>
        <div className="rounded-xl border-l-4 border-amber-500 bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <span className="block text-xs font-medium text-amber-600">Tong checklist</span>
          <p className="mt-2 text-2xl font-bold text-slate-900">{checklistCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="block text-xs font-medium text-slate-400">Dich vu hien thi</span>
          <p className="mt-2 text-2xl font-bold text-blue-700">{filteredServices.length}</p>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 bg-slate-50/70 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-bold text-slate-900">Danh sach goi dich vu</h2>
            <p className="mt-1 text-xs text-slate-400">
              Gia dich vu la co so tinh tong tien booking va phi nen tang.
            </p>
          </div>
          <Select
            label="Phan loai"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className="sm:w-48"
          >
            {Object.entries(categoryLabel).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50 text-xs font-semibold uppercase text-slate-400">
                <th className="p-4">Dich vu</th>
                <th className="p-4">Phan loai</th>
                <th className="p-4">Gia theo gio</th>
                <th className="p-4">Checklist mac dinh</th>
                <th className="p-4">Trang thai</th>
                <th className="p-4 text-right">Thao tac</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredServices.map((service) => {
                const category = serviceCategory(service.code, service.name);

                return (
                  <tr key={service._id} className="hover:bg-slate-50/80">
                    <td className="p-4">
                      <p className="text-sm font-bold text-slate-800">{service.name}</p>
                      <p className="mt-1 text-[11px] font-semibold text-slate-400">{service.code}</p>
                      <p className="mt-2 max-w-md text-xs text-slate-500">{service.description || "Chua co mo ta"}</p>
                    </td>
                    <td className="p-4">
                      <span className="rounded bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                        {categoryLabel[category]}
                      </span>
                    </td>
                    <td className="p-4">
                      <p className="text-sm font-bold text-teal-700">{money(service.pricePerHour)}</p>
                      <p className="text-[11px] text-slate-400">moi gio</p>
                    </td>
                    <td className="p-4">
                      <div className="flex max-w-lg flex-wrap gap-1">
                        {(service.defaultChecklist?.length ? service.defaultChecklist : ["Chua co checklist"]).slice(0, 6).map((item) => (
                          <span key={item} className="rounded bg-teal-50 px-2 py-0.5 text-[10px] font-medium text-teal-700">
                            {item}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-4">
                      <StatusBadge status={service.isActive ? "approved" : "suspended"} />
                    </td>
                    <td className="p-4 text-right">
                      <Button variant="danger" className="min-h-8 px-2.5 text-xs" onClick={() => disable(service._id)}>
                        An dich vu
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {!filteredServices.length ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-sm text-slate-400">
                    Khong tim thay dich vu phu hop.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white p-5">
              <div>
                <h2 className="font-bold text-slate-900">Tao dich vu CareGo</h2>
                <p className="mt-1 text-xs text-slate-400">
                  Checklist se duoc copy vao ca lam khi khach hang dat dich vu nay.
                </p>
              </div>
              <button
                className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200"
                onClick={closeModal}
                type="button"
              >
                Dong
              </button>
            </div>

            <form className="grid gap-4 p-5" onSubmit={submit}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Ten dich vu" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                <Input label="Ma dich vu" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
              </div>
              <Input label="Gia theo gio" type="number" value={form.pricePerHour} onChange={(e) => setForm({ ...form, pricePerHour: e.target.value })} />
              <Textarea label="Mo ta" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <Input
                label="Checklist mac dinh, cach nhau bang dau phay"
                value={form.checklistText}
                onChange={(e) => setForm({ ...form, checklistText: e.target.value })}
              />
              {submitError ? <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{submitError}</p> : null}
              <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                <Button type="button" variant="secondary" onClick={closeModal}>
                  Huy
                </Button>
                <Button>Tao dich vu</Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AdminServicesPage;
