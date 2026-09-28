// frontend/src/modules/client/home/components/CTASection.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { Search, ArrowRight } from 'lucide-react';

export const CTASection: React.FC = () => {
  return (
    <section className="py-10 bg-brand-dark text-white">
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-lg border border-white/15 bg-white/10 p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div>
            <h2 className="text-2xl font-black tracking-normal">
              Sẵn sàng đặt chuyến đi tiếp theo?
            </h2>
            <p className="mt-2 text-sm text-slate-300 max-w-2xl leading-relaxed">
              Tìm tuyến phù hợp, chọn ghế, áp dụng mã giảm giá, thanh toán online và nhận vé điện tử ngay sau khi xác nhận.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <Link href="/posts?needType=BUY">
              <button
                type="button"
                className="w-full sm:w-auto h-11 px-5 rounded-lg bg-accent hover:bg-accent-hover text-white font-black text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <Search className="w-4 h-4" />
                Tìm chuyến xe
              </button>
            </Link>

            <Link href="/register">
              <button
                type="button"
                className="w-full sm:w-auto h-11 px-5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-sm border border-white/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                Đăng ký tích điểm
                <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};
