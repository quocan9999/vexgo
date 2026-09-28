'use client';

import React from 'react';
import { Award, ChevronRight, History, Star, Shield, Gift } from 'lucide-react';
import Link from 'next/link';
import ClientLayout from '@/modules/client/common/layouts/ClientLayout';

export default function LoyaltyPage() {
  const currentPoints = 12500;
  const targetPoints = 20000;
  const progressPercent = (currentPoints / targetPoints) * 100;

  const history = [
    { id: 1, date: '15/09/2026', type: 'EARN', points: '+500', desc: 'Chuyến đi Vũng Tàu - TP.HCM' },
    { id: 2, date: '10/09/2026', type: 'SPEND', points: '-2000', desc: 'Đổi mã giảm giá 50k' },
    { id: 3, date: '01/09/2026', type: 'EARN', points: '+1200', desc: 'Chuyến đi Đà Lạt - TP.HCM' },
  ];

  return (
    <ClientLayout>
      <div className="min-h-screen bg-[#F8FAF9] py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-6">
          <Link href="/" className="hover:text-brand transition-colors">Trang chủ</Link>
          <ChevronRight className="w-4 h-4" />
          <span className="font-semibold text-slate-800">Thành viên BusWay</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Cột trái: Thẻ thành viên */}
          <div className="md:col-span-1 space-y-6">
            <div className="bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-20">
                <Shield className="w-24 h-24" />
              </div>
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <p className="text-amber-100 text-sm font-semibold uppercase tracking-wider mb-1">Hạng hiện tại</p>
                    <h2 className="text-3xl font-black">VÀNG</h2>
                  </div>
                  <Star className="w-8 h-8 text-amber-200 fill-amber-200" />
                </div>
                
                <div className="mb-2">
                  <p className="text-amber-100 text-xs font-semibold mb-1">Điểm tích lũy</p>
                  <p className="text-3xl font-black">{currentPoints.toLocaleString('vi-VN')}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Award className="w-5 h-5 text-brand" />
                Tiến trình thăng hạng
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm font-semibold text-slate-600">
                  <span>Hạng Vàng</span>
                  <span>Hạng Kim Cương</span>
                </div>
                <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-brand rounded-full transition-all duration-1000" 
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 text-right mt-1">
                  Cần thêm <strong className="text-brand">{(targetPoints - currentPoints).toLocaleString('vi-VN')} điểm</strong>
                </p>
              </div>
            </div>
          </div>

          {/* Cột phải: Lịch sử & Đặc quyền */}
          <div className="md:col-span-2 space-y-6">
            {/* Lịch sử */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <History className="w-5 h-5 text-brand" />
                Lịch sử điểm thưởng
              </h3>
              <div className="space-y-4">
                {history.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${item.type === 'EARN' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                        {item.type === 'EARN' ? <Star className="w-5 h-5" /> : <Gift className="w-5 h-5" />}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800 text-sm">{item.desc}</p>
                        <p className="text-xs text-slate-500">{item.date}</p>
                      </div>
                    </div>
                    <span className={`font-black text-sm ${item.type === 'EARN' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {item.points}
                    </span>
                  </div>
                ))}
              </div>
              <button className="w-full mt-4 py-2.5 text-sm font-bold text-brand hover:bg-brand/5 rounded-lg transition-colors">
                Xem tất cả lịch sử
              </button>
            </div>
            
            {/* Đặc quyền */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Gift className="w-5 h-5 text-brand" />
                Đặc quyền hạng Vàng
              </h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-2">
                  <div className="mt-0.5 w-1.5 h-1.5 rounded-full bg-brand shrink-0" />
                  <span className="text-sm text-slate-600">Hệ số tích lũy: <strong className="text-slate-800">1.5x</strong> điểm thưởng sau mỗi chuyến đi.</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="mt-0.5 w-1.5 h-1.5 rounded-full bg-brand shrink-0" />
                  <span className="text-sm text-slate-600">Ưu tiên xếp chỗ ngồi trên tất cả các tuyến.</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="mt-0.5 w-1.5 h-1.5 rounded-full bg-brand shrink-0" />
                  <span className="text-sm text-slate-600">Miễn phí đổi trả vé trước 12 tiếng.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
    </ClientLayout>
  );
}
