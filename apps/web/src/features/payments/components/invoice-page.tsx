/* eslint-disable */
'use client';

import React from 'react';
import { Download, Mail, Printer, QrCode, ArrowLeft, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export default function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = React.use(params);
  // Mock data for the ticket
  const ticket = {
    code: resolvedParams.id || 'BW-888999',
    passenger: 'Nguyễn Văn Hùng',
    phone: '0912345678',
    route: 'TP. Hồ Chí Minh đi Đà Lạt',
    departure: '22:30 - 17/09/2026',
    seats: 'A01, A02',
    price: '670.000đ',
    busType: 'Limousine giường phòng 22 chỗ',
    pickup: 'Bến xe Miền Đông mới',
    dropoff: 'Bến xe Đà Lạt',
    luggage: {
      count: 1,
      type: 'Vali',
      weight: 25,
      category: 'normal', // normal, fragile, valuable
      fee: 30000,
    }
  };

  return (
    <div className="min-h-screen">
      <div className="min-h-screen bg-[#F4F7F9] py-12 font-sans flex flex-col items-center">
        <div className="w-full max-w-4xl px-4 sm:px-6 mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <Link href="/" className="inline-flex items-center gap-2 text-[15px] font-semibold text-slate-500 hover:text-slate-700 transition-colors">
            <ArrowLeft className="w-5 h-5" />
            Về trang chủ
          </Link>
          {/* Hành động */}
          <div className="flex gap-3">
            <button className="h-11 px-5 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-[15px] flex items-center gap-2 shadow-sm hover:bg-slate-50 transition-colors">
              <Mail className="w-4 h-4" />
              Gửi Email
            </button>
            <button className="h-11 px-5 rounded-xl bg-[#1D4ED8] text-white font-bold text-[15px] flex items-center gap-2 shadow-sm hover:bg-[#1e40af] transition-colors">
              <Download className="w-4 h-4" />
              Tải PDF
            </button>
          </div>
        </div>

        {/* Ticket Design */}
        <div className="w-full max-w-4xl px-4 sm:px-6">
          <div className="bg-white rounded-[2rem] shadow-sm overflow-hidden flex flex-col md:flex-row relative">
            
            {/* Main Info Section */}
            <div className="p-8 md:p-12 flex-1 border-b md:border-b-0 md:border-r-2 border-dashed border-slate-200 relative">
              <div className="flex justify-between items-start mb-10">
                <div>
                  <h1 className="text-[32px] font-black text-[#1D2939] mb-2 leading-tight">VÉ ĐIỆN TỬ (E-<br/>TICKET)</h1>
                  <p className="text-[#1D4ED8] font-bold text-xl">VexGo Transport</p>
                </div>
                <div className="flex items-start gap-1.5 text-[#059669] bg-[#ECFDF5] px-4 py-2.5 rounded-xl text-[15px] font-bold border border-[#D1FAE5] leading-tight">
                  <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0" />
                  <span>Đã thanh<br/>toán</span>
                </div>
              </div>

              <div className="space-y-8">
                <div className="bg-[#F8FAFC] rounded-2xl p-6 border border-slate-100">
                  <h2 className="font-black text-[22px] text-[#0F172A] mb-1.5">{ticket.route}</h2>
                  <p className="text-[17px] font-medium text-slate-500">{ticket.busType}</p>
                </div>

                <div className="grid grid-cols-2 gap-y-8 gap-x-6 text-base">
                  <div>
                    <p className="text-slate-500 font-semibold mb-1.5">Khách hàng</p>
                    <p className="font-bold text-[#0F172A] text-lg">{ticket.passenger}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 font-semibold mb-1.5">Số điện thoại</p>
                    <p className="font-bold text-[#0F172A] text-lg">{ticket.phone}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 font-semibold mb-1.5">Thời gian đi</p>
                    <p className="font-bold text-[#0F172A] text-lg">{ticket.departure}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 font-semibold mb-1.5">Số ghế</p>
                    <p className="font-bold text-[#0F172A] text-lg">{ticket.seats}</p>
                  </div>
                  <div className="col-span-2 pt-6 border-t border-slate-100">
                    <p className="text-slate-500 font-semibold mb-1.5">Điểm đón</p>
                    <p className="font-bold text-[#0F172A] text-lg">{ticket.pickup}</p>
                  </div>
                  <div className="col-span-2 pt-6 border-t border-slate-100">
                    <p className="text-slate-500 font-semibold mb-1.5">Hành lý</p>
                    {ticket.luggage ? (
                      <div className="font-bold text-[#0F172A] text-lg flex flex-col gap-1">
                        <p>{ticket.luggage.count} {ticket.luggage.type} - {ticket.luggage.weight}kg - {ticket.luggage.category === 'normal' ? 'Hàng thường' : ticket.luggage.category === 'fragile' ? 'Dễ vỡ' : 'Giá trị cao'}</p>
                        <p className="text-rose-600 text-base">Phụ phí: {ticket.luggage.fee > 0 ? `${ticket.luggage.fee.toLocaleString('vi-VN')}đ` : 'Miễn phí'}</p>
                      </div>
                    ) : (
                      <p className="font-bold text-[#0F172A] text-lg">Hành lý tiêu chuẩn</p>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Cutouts for realistic ticket look */}
              <div className="w-8 h-8 rounded-full bg-[#F4F7F9] absolute -right-4 -bottom-4 hidden md:block"></div>
              <div className="w-8 h-8 rounded-full bg-[#F4F7F9] absolute -right-4 -top-4 hidden md:block"></div>
            </div>

            {/* QR Code Section */}
            <div className="p-8 md:p-12 w-full md:w-[380px] flex flex-col items-center justify-center bg-white relative">
              <div className="text-center mb-8">
                <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Mã đặt chỗ</p>
                <p className="text-[28px] font-black text-[#0F172A] tracking-wider">{ticket.code.replace('-', ' - ')}</p>
              </div>
              
              <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-200 mb-8">
                {/* Fake QR using Lucide Icon */}
                <QrCode className="w-48 h-48 text-slate-800" strokeWidth={1.5} />
              </div>

              <p className="text-base text-center text-slate-500 font-medium px-4">
                Vui lòng xuất trình mã QR này khi lên xe
              </p>
            </div>
          </div>
          
          <p className="text-[15px] text-slate-400 text-center mt-10 font-medium">
            Hóa đơn điện tử (Bản thể hiện). Cần xuất hóa đơn GTGT, vui lòng liên hệ quầy vé.
          </p>
        </div>
      </div>
    </div>
  );
}
