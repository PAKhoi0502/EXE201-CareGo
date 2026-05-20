import { Link, Navigate } from "react-router";
import { Button, Card } from "../components/Ui.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const LandingPage = () => {
  const { user } = useAuth();

  if (user) {
    return <Navigate to={`/${user.role}`} replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">CareGo</p>
          <h1 className="mt-3 text-4xl font-bold leading-tight text-slate-950 sm:text-5xl">
            Can cham soc la co ngay
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
            Nen tang ket noi gia dinh voi nguoi dong hanh tre, duoc xac thuc va theo doi qua
            tung ca cham soc.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/login">
              <Button>Dang nhap</Button>
            </Link>
            <Link to="/register">
              <Button variant="secondary">Dang ky cho gia dinh</Button>
            </Link>
            <Link to="/companion-register">
              <Button variant="muted">Dang ky nguoi dong hanh</Button>
            </Link>
          </div>
        </div>
        <Card className="grid gap-4">
          {[
            ["Mate-Hospital", "Dua di kham, xep hang, ghi chu loi dan bac si."],
            ["Mate-Home", "Tro chuyen, nhac thuoc, cap nhat chi so suc khoe."],
            ["Mate-Walk", "Dong hanh di dao, tham gia cau lac bo va hoat dong ngoai troi."],
          ].map(([title, body]) => (
            <div key={title} className="rounded-md border border-slate-200 p-4">
              <p className="font-semibold text-slate-950">{title}</p>
              <p className="mt-1 text-sm text-slate-500">{body}</p>
            </div>
          ))}
        </Card>
      </section>
    </div>
  );
};

export default LandingPage;
