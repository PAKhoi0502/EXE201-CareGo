const mobileServices = [
  ["Hospital", "Xếp hàng, lấy thuốc, ghi chú bác sĩ"],
  ["Home", "Nhắc thuốc, đo chỉ số, trò chuyện"],
  ["Walk", "Công viên, CLB, hoạt động ngoài trời"],
];

const HeroPhonePreview = () => (
  <div className="relative mx-auto flex min-h-[620px] w-full max-w-[520px] items-center justify-center lg:mx-0">
    <div className="absolute right-0 top-10 hidden w-48 rounded-3xl border border-teal-100 bg-white p-4 shadow-xl shadow-teal-900/10 sm:block">
      <strong className="block text-sm text-teal-800">Đã xác nhận</strong>
      <small className="mt-1 block leading-5 text-slate-500">Người đồng hành đang trên đường đến nhà.</small>
    </div>

    <div className="absolute bottom-16 left-0 hidden w-56 overflow-hidden rounded-3xl border border-teal-100 bg-white shadow-xl shadow-teal-900/10 sm:block">
      <img
        src="https://images.unsplash.com/photo-1576765608622-067973a79f53?auto=format&fit=crop&w=500&q=80"
        alt="Người đồng hành hỗ trợ người cao tuổi"
        className="h-28 w-full object-cover"
      />
      <div className="p-4">
        <strong className="block text-sm text-teal-800">Báo cáo ca làm</strong>
        <small className="mt-1 block leading-5 text-slate-500">Đã nhắc thuốc, huyết áp ổn định.</small>
      </div>
    </div>

    <div className="relative w-[330px] rounded-[44px] bg-[#102826] p-3 shadow-2xl shadow-teal-900/20">
      <div className="min-h-[600px] rounded-[35px] bg-[#f7fffe] p-5">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <strong className="text-sm text-slate-900">Xin chào, anh/chị</strong>
            <p className="mt-1 text-xs text-slate-500">Ba mẹ cần hỗ trợ gì hôm nay?</p>
          </div>
          <button className="rounded-full bg-rose-100 px-3 py-2 text-xs font-black text-rose-600 shadow-sm" type="button">
            SOS
          </button>
        </div>

        <div className="mb-4 rounded-3xl border border-teal-50 bg-white p-4 shadow-lg shadow-teal-900/5">
          <h4 className="mb-3 text-sm font-black text-slate-900">Chọn dịch vụ</h4>
          <div className="space-y-2.5">
            {mobileServices.map(([title, body], index) => (
              <div key={title} className="flex items-center gap-3 rounded-2xl bg-teal-50 p-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-teal-100 text-sm font-black text-teal-800">
                  {index + 1}
                </div>
                <div>
                  <strong className="block text-xs text-slate-900">{title}</strong>
                  <small className="mt-0.5 block text-[11px] text-slate-500">{body}</small>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-teal-50 bg-white p-4 shadow-lg shadow-teal-900/5">
          <h4 className="mb-3 text-sm font-black text-slate-900">Theo dõi GPS</h4>
          <div className="relative h-36 overflow-hidden rounded-3xl bg-[#e9fffb]">
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(15,118,110,0.09)_1px,transparent_1px),linear-gradient(rgba(15,118,110,0.09)_1px,transparent_1px)] bg-[length:24px_24px]" />
            <div className="absolute left-9 top-20 h-1 w-44 -rotate-12 rounded-full bg-teal-700" />
            <div className="absolute right-14 top-16 h-6 w-6 rounded-full border-4 border-white bg-rose-500 shadow-[0_0_0_9px_rgba(244,63,94,0.16)]" />
            <div className="absolute bottom-4 left-4 rounded-full bg-white px-3 py-1 text-[11px] font-bold text-teal-800 shadow-sm">
              GPS đang bật
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default HeroPhonePreview;
