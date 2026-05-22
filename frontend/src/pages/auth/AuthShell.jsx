import { Link } from "react-router";

const features = [
  ["GPS realtime", "Xem vị trí người thân và người đồng hành trong quá trình thực hiện dịch vụ."],
  ["Ghi chú ca làm", "Cập nhật hình ảnh, tình trạng sức khỏe và nội dung hỗ trợ sau mỗi ca."],
  ["Người đồng hành", "Hồ sơ được xác thực, ưu tiên sinh viên ngành sức khỏe và chăm sóc."],
  ["Hỗ trợ SOS", "Nút hỗ trợ nhanh trong tình huống khẩn cấp khi đang thực hiện dịch vụ."],
];

const AuthShell = ({ title, subtitle, children, footer, badge = "Đăng nhập an toàn" }) => (
  <main className="grid min-h-screen bg-[#f4fbfa] text-[#12312f] lg:grid-cols-[1.05fr_0.95fr]">
    <section className="flex flex-col justify-between px-5 py-8 sm:px-10 lg:px-[7%] lg:py-11">
      <div>
        <Link to="/" className="flex items-center gap-3 text-2xl font-black text-teal-800">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-teal-700 text-2xl font-black text-white shadow-lg shadow-teal-700/25">
            +
          </span>
          CareGo
        </Link>

        <div className="mt-12 max-w-2xl lg:mt-20">
          <div className="mb-6 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-extrabold text-emerald-700">
            {badge}
          </div>
          <h1 className="text-4xl font-black leading-tight text-[#12312f] sm:text-5xl xl:text-6xl">
            Chào mừng bạn quay lại <span className="text-teal-800">CareGo</span>
          </h1>
          <p className="mt-6 text-lg leading-8 text-slate-500">
            Đăng nhập để đặt lịch chăm sóc cho ba mẹ, theo dõi GPS, xem ghi chú ca làm hoặc quản lý hoạt động
            dịch vụ trên hệ thống.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {features.map(([featureTitle, body]) => (
              <div key={featureTitle} className="rounded-3xl border border-teal-100 bg-white/80 p-5 shadow-xl shadow-teal-900/5">
                <div className="mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-teal-100 text-sm font-black text-teal-800">
                  CG
                </div>
                <strong className="block text-base font-black text-[#12312f]">{featureTitle}</strong>
                <p className="mt-2 text-sm leading-6 text-slate-500">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-10 text-sm text-slate-500">© 2026 CareGo. Cần chăm sóc là có ngay.</p>
    </section>

    <section className="flex items-center justify-center px-5 py-8 sm:px-10 lg:px-[7%]">
      <div className="w-full max-w-[470px] rounded-[34px] border border-teal-100 bg-white/90 p-6 shadow-2xl shadow-teal-900/10 backdrop-blur-xl sm:p-8">
        <h2 className="text-3xl font-black text-[#12312f]">{title}</h2>
        <p className="mt-2 leading-7 text-slate-500">{subtitle}</p>
        <div className="mt-6">{children}</div>
        {footer ? <div className="mt-6 text-center text-sm text-slate-600">{footer}</div> : null}
      </div>
    </section>
  </main>
);

export default AuthShell;
