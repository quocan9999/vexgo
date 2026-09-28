'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Info, ScanLine, Smartphone } from 'lucide-react';

function PaymentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [selectedMethod, setSelectedMethod] = useState('momo');
  const [isProcessing, setIsProcessing] = useState(false);
  const [timeLeft, setTimeLeft] = useState(599); // 9:59

  const totalFareParam = searchParams.get('totalFare') || '640000';
  const totalFare = parseInt(totalFareParam, 10) || 640000;
  const totalFareText = totalFare.toLocaleString('vi-VN') + 'đ';

  const seats = searchParams.get('seats') || 'A01, A02';
  const count = searchParams.get('count') || '2';
  const routeName = searchParams.get('route') || 'TP. Hồ Chí Minh - Đà Lạt';
  const departureTime = searchParams.get('departureTime') || '22:30 17/09/2026';
  const pickup = searchParams.get('pickup') || 'Bến xe Miền Đông mới';
  const dropoff = searchParams.get('dropoff') || 'Bến xe trung tâm Đà Lạt';
  
  const luggageFeeParam = searchParams.get('luggageFee') || '0';
  const luggageFee = parseInt(luggageFeeParam, 10) || 0;
  const luggageWeight = searchParams.get('luggageWeight') || '0';
  const baseFareParam = searchParams.get('baseFare') || '320000';
  const baseFare = parseInt(baseFareParam, 10) || 320000;

  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handlePayment = () => {
    setIsProcessing(true);
    setTimeout(() => {
      router.push('/invoice/BW-888999');
    }, 2000);
  };

  const methods = [
    { id: 'momo', name: 'MoMo', extra: 'Nhập mã BUSMOMO giảm ngay 20k cho đơn từ 300k.' },
    { id: 'vnpay', name: 'VNPay', extra: 'Quét mã VNPAY-QR tiện lợi, nhanh chóng.' },
    { id: 'atm', name: 'Thẻ ATM nội địa', extra: 'Hỗ trợ tất cả ngân hàng nội địa tại Việt Nam.' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 py-8 font-sans">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        <div className="mb-6">
          <button onClick={() => router.back()} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-brand transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Quay lại
          </button>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* Cột 1: Chọn phương thức thanh toán */}
          <div className="w-full lg:w-[320px] shrink-0">
            <h2 className="text-lg font-bold text-slate-900 mb-6">Chọn phương thức thanh toán</h2>
            <div className="space-y-1">
              {methods.map(method => (
                <label 
                  key={method.id} 
                  className="flex items-start gap-4 p-3 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors"
                >
                  <div className="pt-1 shrink-0">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      selectedMethod === method.id ? 'border-brand bg-white' : 'border-slate-300 bg-white'
                    }`}>
                      {selectedMethod === method.id && <div className="w-2.5 h-2.5 rounded-full bg-brand" />}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-slate-200 rounded-md shrink-0 flex items-center justify-center overflow-hidden">
                        {/* Mock Icons for payment methods */}
                        <div className={`w-full h-full flex items-center justify-center text-xs font-black text-white ${
                          method.id === 'momo' ? 'bg-[#A50064]' : 
                          method.id === 'vnpay' ? 'bg-[#005BAA]' : 'bg-slate-700'
                        }`}>
                          {method.name.charAt(0)}
                        </div>
                      </div>
                      <span className="font-semibold text-slate-800 text-[15px]">{method.name}</span>
                    </div>
                    {method.extra && (
                      <p className="text-[11px] mt-1.5 font-medium leading-relaxed text-rose-600">
                        {method.extra}
                      </p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Cột 2: QR Code */}
          <div className="flex-1 flex flex-col items-center">
            <p className="text-sm font-semibold text-slate-500 mb-1">Tổng thanh toán</p>
            <h1 className="text-5xl font-bold text-rose-500 mb-8 tracking-tight">{totalFareText}</h1>

            <div className="w-full max-w-[360px] bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col items-center">
              <p className="text-sm font-semibold text-amber-600 mb-4">
                Thời gian giữ chỗ còn lại {formatTime(timeLeft)}
              </p>
              
              <div className="w-64 h-64 border-[3px] border-slate-900 rounded-3xl p-4 mb-6 relative">
                 <div className="w-full h-full grid grid-cols-4 grid-rows-4 gap-1">
                    {[...Array(16)].map((_, i) => (
                      <div key={i} className={`bg-slate-900 rounded-sm ${i % 3 === 0 ? 'opacity-0' : ''}`} />
                    ))}
                 </div>
                 <div className="absolute inset-0 m-auto w-12 h-12 bg-white rounded-xl flex items-center justify-center p-1">
                    <div className="w-full h-full bg-brand rounded-lg flex items-center justify-center text-white font-black text-xl">B</div>
                 </div>
              </div>

              <div className="w-full text-center">
                <p className="text-sm font-bold text-slate-800 mb-4">Hướng dẫn thanh toán bằng {methods.find(m => m.id === selectedMethod)?.name}</p>
                <ul className="text-left text-[13px] text-slate-700 space-y-3 mb-6">
                  <li className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-slate-400 text-white flex items-center justify-center font-bold text-xs shrink-0">1</span>
                    Mở ứng dụng {methods.find(m => m.id === selectedMethod)?.name} trên điện thoại
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-slate-400 text-white flex items-center justify-center font-bold text-xs shrink-0">2</span>
                    Dùng biểu tượng <ScanLine className="w-4 h-4 inline-block" /> để quét mã QR
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-slate-400 text-white flex items-center justify-center font-bold text-xs shrink-0">3</span>
                    Quét mã ở trang này và thanh toán
                  </li>
                </ul>
                
                <button
                  onClick={handlePayment}
                  disabled={isProcessing}
                  className="w-full h-11 bg-brand text-white font-bold rounded-xl hover:bg-brand-hover transition-colors flex items-center justify-center gap-2 disabled:opacity-70 text-sm"
                >
                  {isProcessing ? 'Đang xử lý...' : 'Xác nhận đã thanh toán'}
                </button>
              </div>
            </div>
          </div>

          {/* Cột 3: Thông tin chi tiết */}
          <div className="w-full lg:w-[360px] shrink-0 space-y-4">
            
            {/* Thông tin hành khách */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="font-bold text-slate-900 text-base mb-4">Thông tin hành khách</h3>
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Họ và tên</span>
                  <span className="font-bold text-slate-800">Nguyễn Văn Hùng</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Số điện thoại</span>
                  <span className="font-bold text-slate-800">0912345678</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Email</span>
                  <span className="font-bold text-slate-800">nguyenhung@gmail.com</span>
                </div>
              </div>
            </div>

            {/* Thông tin chuyến đi */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  Thông tin chuyến đi
                  <Info className="w-4 h-4 text-rose-500" />
                </h3>
                <a href="#" className="text-xs text-rose-500 font-bold underline">Chi tiết</a>
              </div>
              
              <div className="space-y-2.5 text-[13px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Tuyến xe</span>
                  <span className="font-bold text-slate-800 text-right">{routeName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Thời gian xuất bến</span>
                  <span className="font-bold text-brand text-right">{departureTime}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Số lượng ghế</span>
                  <span className="font-bold text-slate-800 text-right">{count} Ghế</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Số ghế</span>
                  <span className="font-bold text-brand text-right">{seats}</span>
                </div>
                
                <div className="pt-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Điểm lên xe</span>
                    <span className="font-bold text-slate-800 text-right">{pickup}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 text-right mt-1">Đường Hoàng Hữu Nam, TP Thủ Đức, TP.HCM</p>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-500">Thời gian tới điểm lên xe</span>
                  <span className="font-bold text-rose-500 text-right">Trước 22:00<br/>17/09/2026</span>
                </div>
                
                <div className="pt-2 border-b border-slate-100 pb-3">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Điểm trả khách</span>
                    <span className="font-bold text-slate-800 text-right">{dropoff}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 text-right mt-1">01 Tô Hiến Thành, Phường 3, Đà Lạt</p>
                </div>

                <div className="flex justify-between pt-1">
                  <span className="text-slate-500">Tổng tiền lượt đi</span>
                  <span className="font-bold text-brand text-right">{totalFareText}</span>
                </div>
              </div>
            </div>

            {/* Chi tiết giá */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="font-bold text-slate-900 text-base mb-4 flex items-center gap-2">
                Chi tiết giá
                <Info className="w-4 h-4 text-rose-500" />
              </h3>
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Giá vé lượt đi ({count} ghế)</span>
                  <span className="font-bold text-slate-800">{(baseFare * parseInt(count)).toLocaleString('vi-VN')}đ</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Phí thanh toán</span>
                  <span className="font-bold text-slate-800">0đ</span>
                </div>
                {luggageFee > 0 ? (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Phụ phí hành lý ({luggageWeight}kg)</span>
                    <span className="font-bold text-slate-800">{luggageFee.toLocaleString('vi-VN')}đ</span>
                  </div>
                ) : (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Hành lý ({luggageWeight}kg)</span>
                    <span className="font-bold text-slate-800">Miễn phí</span>
                  </div>
                )}
                <div className="flex justify-between pt-3 border-t border-slate-200 text-base">
                  <span className="text-slate-500">Tổng tiền</span>
                  <span className="font-bold text-rose-500">{totalFareText}</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

export default function PaymentPage() {
  return (
    <div className="min-h-screen">
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-50">Tổng thanh toán...</div>}>
        <PaymentContent />
      </Suspense>
    </div>
  );
}
