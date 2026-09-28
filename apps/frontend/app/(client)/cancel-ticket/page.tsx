'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, Bus, CheckCircle2, Search, TicketX } from 'lucide-react';
import ClientLayout from '@/modules/client/common/layouts/ClientLayout';

export default function CancelTicketPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [ticketCode, setTicketCode] = useState('BW-12345678');
  const [phone, setPhone] = useState('0912345678');
  const [isConfirmed, setIsConfirmed] = useState(false);

  return (
    <ClientLayout>
      <div className="min-h-screen bg-[#F8FAF9] py-8 font-sans">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="mb-6">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-brand transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Về trang chủ
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 md:p-8 border-b border-slate-100 bg-[#F8FAFC]">
            <h1 className="text-2xl font-black text-[#1D2939]">Hủy Vé</h1>
          </div>

          <div className="p-6 md:p-10">
            {step === 1 && (
              <div className="max-w-xl mx-auto space-y-6">
                <div className="space-y-6">
                  <div>
                    <label className="block text-[15px] font-bold text-[#344054] mb-2">
                      Mã vé / Mã đơn hàng <span className="text-rose-600">*</span>
                    </label>
                    <input 
                      type="text" 
                      value={ticketCode}
                      onChange={(e) => setTicketCode(e.target.value)}
                      placeholder="VD: BW-12345678" 
                      className="w-full h-12 px-4 rounded-xl border border-slate-300 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand font-medium text-slate-800 placeholder:text-slate-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[15px] font-bold text-[#344054] mb-2">
                      Số điện thoại đặt vé <span className="text-rose-600">*</span>
                    </label>
                    <input 
                      type="text" 
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Nhập số điện thoại" 
                      className="w-full h-12 px-4 rounded-xl border border-slate-300 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand font-medium text-slate-800 placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <button 
                    type="button"
                    onClick={() => {
                      if (!ticketCode || !phone) {
                        alert("Vui lòng nhập đầy đủ thông tin!");
                        return;
                      }
                      setStep(2);
                    }}
                    className="w-full h-12 bg-[#E04115] text-white font-bold text-base rounded-xl hover:bg-[#c93a12] transition-colors shadow-sm"
                  >
                    Kiểm tra điều kiện hủy
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="max-w-xl mx-auto space-y-6">
                <div className="rounded-xl border border-[#D1FAE5] bg-[#F0FDF4] p-5 flex gap-4 items-start">
                  <CheckCircle2 className="w-6 h-6 text-[#059669] shrink-0" />
                  <div>
                    <h3 className="font-bold text-[#065F46] text-[15px]">Vé đủ điều kiện hủy tự động</h3>
                    <p className="text-[14px] text-[#065F46]/80 mt-1">Vé của bạn được phép hủy trước giờ khởi hành 12 tiếng.</p>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between p-5 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <Bus className="w-5 h-5 text-slate-400" />
                      <span className="font-bold text-[#1D2939]">TP. Hồ Chí Minh đi Đà Lạt</span>
                    </div>
                    <span className="text-xs font-semibold px-3 py-1 bg-slate-100 rounded-md text-slate-600">BW-12345678</span>
                  </div>
                  
                  <div className="p-5 space-y-4 text-[15px]">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Giờ khởi hành:</span>
                      <span className="font-bold text-[#1D2939]">22:30, 17/09/2026</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Số lượng ghế:</span>
                      <span className="font-bold text-[#1D2939]">2 ghế (A01, A02)</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Giá trị vé:</span>
                      <span className="font-bold text-rose-600">640.000đ</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <h3 className="font-bold text-slate-900 text-[15px] mb-4">Chính sách phí hủy vé</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center text-[15px]">
                      <span className="text-slate-600">Phí hủy (10%):</span>
                      <span className="font-bold text-rose-600">-64.000đ</span>
                    </div>
                    <div className="flex justify-between items-center text-base pt-4 border-t border-slate-200">
                      <span className="font-bold text-slate-900">Số tiền hoàn lại:</span>
                      <span className="font-black text-rose-600 text-lg">576.000đ</span>
                    </div>
                  </div>
                </div>

                <div className="text-[14px] text-slate-500 text-center">
                  Tiền sẽ được hoàn về <strong className="text-slate-700">MoMo (0912***678)</strong> trong vòng 1-3 ngày làm việc.
                </div>

                <label className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors">
                  <input 
                    type="checkbox" 
                    checked={isConfirmed}
                    onChange={(e) => setIsConfirmed(e.target.checked)}
                    className="mt-1 w-4 h-4 rounded border-slate-300 text-[#E04115] focus:ring-[#E04115]"
                  />
                  <span className="text-sm text-slate-700 font-medium">
                    Tôi đã đọc, hiểu và đồng ý với chính sách phí hủy vé của nhà xe.
                  </span>
                </label>

                <div className="flex gap-4 pt-2">
                  <button 
                    type="button"
                    onClick={() => setStep(1)}
                    className="flex-1 h-12 bg-white text-slate-700 font-bold rounded-xl border border-slate-300 hover:bg-slate-50 transition-colors"
                  >
                    Quay lại
                  </button>
                  <button 
                    type="button"
                    disabled={!isConfirmed}
                    onClick={() => setStep(3)}
                    className={`flex-1 h-12 font-bold rounded-xl transition-colors shadow-sm ${
                      isConfirmed 
                        ? 'bg-[#E04115] text-white hover:bg-[#c93a12]' 
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    Xác nhận hủy vé
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="text-center py-8 space-y-6">
                <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900">Hủy vé thành công!</h2>
                  <p className="text-slate-500 mt-2 max-w-md mx-auto">
                    Vé của bạn đã được hủy và hệ thống đã giải phóng ghế. Số tiền <strong className="text-slate-800">576.000đ</strong> đang được xử lý hoàn về phương thức thanh toán ban đầu.
                  </p>
                </div>
                <div className="pt-6">
                  <Link href="/" className="inline-block h-12 px-8 leading-10 bg-brand text-white font-black rounded-xl hover:bg-brand-hover transition-colors">
                    Trở về trang chủ
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </ClientLayout>
  );
}
