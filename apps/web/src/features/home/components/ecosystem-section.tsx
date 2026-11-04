'use client';

import React from 'react';
import Link from 'next/link';
import {
  BusFront,
  TicketCheck,
  PackageCheck,
  ClipboardCheck,
  ArrowRight,
} from 'lucide-react';

export const EcosystemSection: React.FC = () => {
  const ecosystemItems = [
    {
      id: 'network',
      icon: BusFront,
      title: 'Kết nối nhiều nhà xe',
      desc: 'Mạng lưới đối tác xe khách rộng khắp, đa dạng tuyến đường liên tỉnh và nhiều khung giờ di chuyển mỗi ngày.',
      linkText: 'Xem lịch trình',
      href: '/trips',
      iconBg: 'bg-red-50 text-[#E60012] border-red-100',
      actionColor: 'text-[#E60012]',
    },
    {
      id: 'booking',
      icon: TicketCheck,
      title: 'Đặt vé dễ dàng',
      desc: 'Tra cứu giờ xe, chọn vị trí ngồi thực tế trên sơ đồ xe, thanh toán an toàn và nhận vé điện tử tức thì.',
      linkText: 'Tìm chuyến ngay',
      href: '/trips',
      iconBg: 'bg-orange-50 text-[#FF5722] border-orange-100',
      actionColor: 'text-[#FF5722]',
    },
    {
      id: 'shipping',
      icon: PackageCheck,
      title: 'Gửi hàng liên tỉnh',
      desc: 'Vận chuyển bưu phẩm, hàng hóa siêu tốc theo các tuyến xe khách chạy liên tục, giao nhận ngay trong ngày.',
      linkText: 'Tạo đơn gửi hàng',
      href: '/shipments/new',
      iconBg: 'bg-amber-50 text-amber-600 border-amber-100',
      actionColor: 'text-amber-600',
    },
    {
      id: 'tracking',
      icon: ClipboardCheck,
      title: 'Tra cứu và quản lý',
      desc: 'Kiểm tra thông tin vé, theo dõi mã vận đơn bưu kiện và chủ động hủy vé hoàn tiền trực tuyến minh bạch.',
      linkText: 'Tra cứu vé',
      href: '/tickets/lookup',
      iconBg: 'bg-blue-50 text-blue-600 border-blue-100',
      actionColor: 'text-blue-600',
    },
  ];

  const steps = [
    { number: '01', title: 'Tìm chuyến xe', subtitle: 'Chọn điểm đi & ngày đi', color: 'bg-red-100 text-[#E60012]' },
    { number: '02', title: 'Chọn chỗ ngồi', subtitle: 'Sơ đồ tầng trên & dưới', color: 'bg-orange-100 text-[#FF5722]' },
    { number: '03', title: 'Thanh toán vé', subtitle: 'QR chuyển khoản / Ví', color: 'bg-amber-100 text-amber-700' },
    { number: '04', title: 'Lên xe an toàn', subtitle: 'Xuất trình vé điện tử', color: 'bg-emerald-100 text-emerald-700' },
  ];

  return (
    <section
      aria-label="Hệ sinh thái VexGo"
      className="py-12 md:py-16 bg-[#F8FAFC] border-t border-slate-200/70"
    >
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 text-[#E60012] border border-red-100 text-[11px] font-bold uppercase tracking-wider mb-2.5">
            <BusFront className="w-3.5 h-3.5 text-[#E60012]" />
            Hệ sinh thái dịch vụ VexGo
          </div>
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
            Không chỉ là đặt vé. Cả hành trình trong tay bạn.
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
            VexGo kết nối hành khách với các nhà xe liên tỉnh uy tín, giúp việc tìm chuyến, đặt vé và gửi hàng trở nên đơn giản, tiện lợi trên cùng một nền tảng.
          </p>
        </div>

        {/* 4 Feature Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {ecosystemItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.id}
                href={item.href}
                className="group bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs hover:shadow-lg hover:border-slate-300 transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between focus:outline-none focus:ring-2 focus:ring-[#FF5722]"
              >
                <div>
                  <div
                    className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-300 ${item.iconBg}`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>

                  <h3 className="text-[15px] sm:text-base font-bold text-slate-900 group-hover:text-brand transition-colors mt-4">
                    {item.title}
                  </h3>
                  <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                    {item.desc}
                  </p>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className={`text-xs font-bold inline-flex items-center gap-1 ${item.actionColor}`}>
                    {item.linkText}
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Hành trình kết nối 4 bước đơn giản */}
        <div className="mt-8 rounded-2xl bg-white border border-slate-200/90 p-5 sm:p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 pb-4 border-b border-slate-100">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#E60012]">
                Quy trình trải nghiệm
              </span>
              <h3 className="text-sm font-bold text-slate-800 mt-0.5">
                4 bước thuận tiện cho chuyến đi trọn vẹn
              </h3>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              Hỗ trợ khách hàng trực tuyến 24/7
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
            {steps.map((step) => (
              <div key={step.number} className="flex items-center gap-3">
                <span
                  className={`w-7 h-7 rounded-full font-black text-xs flex items-center justify-center shrink-0 ${step.color}`}
                >
                  {step.number}
                </span>
                <div>
                  <p className="text-xs sm:text-sm font-bold text-slate-800">{step.title}</p>
                  <p className="text-[11px] text-slate-500">{step.subtitle}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default EcosystemSection;
