import { Link } from "react-router";

const AuthShell = ({ title, subtitle, children, footer }) => (
  <div className="min-h-screen bg-slate-50 px-4 py-10">
    <div className="mx-auto max-w-md">
      <Link to="/" className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-teal-700 font-bold text-white">
          CG
        </div>
        <div>
          <p className="font-bold text-slate-950">CareGo</p>
          <p className="text-xs text-slate-500">Can cham soc la co ngay</p>
        </div>
      </Link>
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-950">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        <div className="mt-6">{children}</div>
      </div>
      {footer ? <div className="mt-4 text-center text-sm text-slate-600">{footer}</div> : null}
    </div>
  </div>
);

export default AuthShell;
