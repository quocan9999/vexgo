'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Bus, CheckCircle2 } from 'lucide-react';
import { LoginForm } from '../components/LoginForm';

export const LoginClientPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-white flex font-sans">
      {/* Left side - Decorative */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-brand overflow-hidden">
        {/* Background Image & Gradient overlay */}
        <div 
          className="absolute inset-0 bg-[url('/images/bg-login.jpg')] bg-cover bg-center opacity-30 mix-blend-overlay"
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
            <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-white text-brand text-sm font-bold shadow-lg shadow-black/10">
              <Bus className="w-5 h-5" />
              <span>BUSWAY</span>
            </div>
            
            <h1 className="text-4xl lg:text-5xl xl:text-6xl font-bold leading-[1.1] tracking-tight">
              Nền tảng đặt vé <br />
              <span className="text-brand-light">Xe Khách</span> hàng đầu.
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
                  <CheckCircle2 className="w-6 h-6 text-brand-light shrink-0" />
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


          <LoginForm />

          <p className="mt-10 text-center text-sm text-slate-600">
            Chưa có tài khoản?{' '}
            <Link href="/register" className="font-semibold text-brand hover:text-[#0e2a20] transition-colors underline underline-offset-4 decoration-2 decoration-emerald-200 hover:decoration-[#143D30]">
              Đăng ký ngay miễn phí
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginClientPage;
