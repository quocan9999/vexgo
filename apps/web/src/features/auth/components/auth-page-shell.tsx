/* eslint-disable */
import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Bus, CheckCircle2 } from 'lucide-react';

export function AuthPageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white flex font-sans">
      {/* Left side - Decorative */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-emerald-700 overflow-hidden">
        {/* Background Image & Gradient overlay */}
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-30 mix-blend-overlay"
          style={{ backgroundImage: "url('/images/bg-login.jpg')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#091f18] via-[#143D30]/80 to-transparent" />
        
        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 h-full text-white w-full">
          <div>
            <Link href="/" className="inline-flex items-center gap-2 text-emerald-100 hover:text-white transition-colors bg-white/10 hover:bg-white/20 px-4 py-2 rounded-full backdrop-blur-sm border border-white/10 w-fit">
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm font-medium">Quay lại trang chủ</span>
            </Link>
          </div>
          
          <div className="space-y-8 max-w-xl">
            <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-white text-emerald-700 text-sm font-bold shadow-lg shadow-black/10">
              <Bus className="w-5 h-5" />
              <span>VEXGO</span>
            </div>
            
            <h1 className="text-4xl lg:text-5xl xl:text-6xl font-bold leading-[1.1] tracking-tight">
              Nền tảng đặt vé <br />
              <span className="text-emerald-300">Xe Khách</span> hàng đầu.
            </h1>
            
            <p className="text-lg text-emerald-100/90 leading-relaxed font-medium">
              Đặt vé xe khách trực tuyến dễ dàng, an toàn và tiện lợi. Hàng ngàn chuyến đi với nhiều sự lựa chọn đang chờ đón bạn.
            </p>
            
            <div className="pt-6 space-y-4">
              {[
                'Hàng ngàn chuyến xe được cập nhật mỗi ngày',
                'Đặt vé nhanh chóng, giữ chỗ tức thì',
                'Thanh toán an toàn, đa dạng hình thức'
              ].map((feature, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-300 shrink-0" />
                  <span className="text-emerald-50 font-medium text-lg">{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-6 sm:px-12 lg:px-20 xl:px-32 bg-white relative">
        <div className="lg:hidden absolute top-6 left-6">
          <Link href="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors bg-slate-50 hover:bg-slate-100 px-4 py-2 rounded-full">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Trang chủ</span>
          </Link>
        </div>

        <div className="w-full max-w-md mx-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
