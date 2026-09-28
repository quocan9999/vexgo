// frontend/src/modules/client/home/components/CategoryClient.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import {
  Bus,
  CalendarCheck,
  MapPinned,
  PackageCheck,
  Route,
  WalletCards,
} from 'lucide-react';

export const CategoryClient: React.FC = () => {
  const popularRoutes = [
    {
      id: 'hcm-dalat',
      title: 'TP. Hồ Chí Minh → Đà Lạt',
      desc: 'Từ 320.000đ · 12 chuyến/ngày',
    },
    {
      id: 'hcm-nhatrang',
      title: 'TP. Hồ Chí Minh → Nha Trang',
      desc: 'Từ 260.000đ · xe đêm',
    },
    {
      id: 'hanoi-danang',
      title: 'Hà Nội → Đà Nẵng',
      desc: 'Từ 550.000đ · limousine',
    },
    {
      id: 'hcm-vungtau',
      title: 'TP. Hồ Chí Minh → Vũng Tàu',
      desc: 'Từ 180.000đ · đón nội thành',
    },
  ];

  const steps = [
    {
      title: 'Chọn tuyến',
      desc: 'Nhập điểm đi, điểm đến, ngày đi và số vé.',
      icon: <Route className="w-5 h-5" />,
    },
    {
      title: 'Chọn chuyến',
      desc: 'So sánh giờ đi, loại xe, giá và số ghế trống.',
      icon: <Bus className="w-5 h-5" />,
    },
    {
      title: 'Chọn ghế',
      desc: 'Chọn vị trí, điểm đón trả và nhập thông tin khách.',
      icon: <MapPinned className="w-5 h-5" />,
    },
    {
      title: 'Thanh toán',
      desc: 'Nhận vé điện tử hoặc mã vận đơn sau khi thanh toán.',
      icon: <WalletCards className="w-5 h-5" />,
    },
  ];

  return (
    <section className="py-12 bg-[#F8FAF9]">
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3 mb-6">
          <div>
            <h2 className="text-2xl font-black text-slate-950 tracking-normal">
              Tuyến phổ biến
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Gợi ý tuyến có nhiều khách đặt và còn chuyến trong ngày.
            </p>
          </div>
          <Link href="/posts" className="text-sm font-black text-brand hover:text-[#0e2a20]">
            Xem tất cả tuyến
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {popularRoutes.map((route) => (
            <Link
              key={route.id}
              href="/posts?needType=BUY"
              className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm hover:shadow-md hover:border-brand/40 transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-black text-slate-950 text-sm">{route.title}</h3>
                  <p className="text-xs text-slate-500 font-semibold mt-1">{route.desc}</p>
                </div>
                <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-100 text-brand flex items-center justify-center">
                  <Bus className="w-5 h-5" />
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-10 bg-white rounded-lg border border-slate-200 p-4 md:p-5 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="text-xl font-black text-slate-950">Quy trình đặt vé</h2>
              <p className="text-sm text-slate-500 mt-1">Tối ưu cho thao tác nhanh trên mobile và desktop.</p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-xs font-black text-amber-800 w-fit">
              <CalendarCheck className="w-4 h-4" />
              Giữ ghế 10 phút
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {steps.map((step, idx) => (
              <div key={step.title} className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
                <div className="w-9 h-9 rounded-lg bg-brand text-white flex items-center justify-center mb-3">
                  {step.icon}
                </div>
                <p className="text-[11px] font-black text-amber-700">Bước {idx + 1}</p>
                <h3 className="text-sm font-black text-slate-950 mt-1">{step.title}</h3>
                <p className="text-xs text-slate-500 font-medium leading-relaxed mt-1">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            ['Tra cứu vé', 'Tìm bằng mã vé hoặc số điện thoại.'],
            ['Gửi hàng hóa', 'Tạo vận đơn theo tuyến xe đang chạy.'],
            ['Thông báo chủ động', 'Nhắc lịch và cảnh báo khi chuyến thay đổi.'],
          ].map(([title, desc]) => (
            <div key={title} className="rounded-lg border border-slate-200 bg-white p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 text-brand flex items-center justify-center">
                <PackageCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-950">{title}</h3>
                <p className="text-xs text-slate-500 mt-1 font-medium">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
