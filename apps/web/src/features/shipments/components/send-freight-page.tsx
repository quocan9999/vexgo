'use client';

import React, { useState, useEffect, Suspense } from "react";
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Package, MapPin, Calculator, ShieldAlert, ArrowRight, Truck, User, Users } from 'lucide-react';

function SendFreightContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [origin, setOrigin] = useState<string>('Bến xe Miền Đông, TP.HCM');
  const [destination, setDestination] = useState<string>('Bến xe trung tâm, Đà Lạt');
  const [date, setDate] = useState<string>('2026-09-26');

  const [selectedCompany, setSelectedCompany] = useState<string>('phuong-dong');
  
  const [senderName, setSenderName] = useState<string>('');
  const [senderPhone, setSenderPhone] = useState<string>('');
  const [receiverName, setReceiverName] = useState<string>('');
  const [receiverPhone, setReceiverPhone] = useState<string>('');
  
  const [freightType, setFreightType] = useState<string>('Hàng thường');
  const [quantity, setQuantity] = useState<number>(1);
  const [weight, setWeight] = useState<number>(5);
  const [length, setLength] = useState<number>(40);
  const [width, setWidth] = useState<number>(30);
  const [height, setHeight] = useState<number>(25);
  const [note, setNote] = useState<string>('');
  
  const [isFragile, setIsFragile] = useState<boolean>(false);
  const [isValuable, setIsValuable] = useState<boolean>(false);
  const [needsCare, setNeedsCare] = useState<boolean>(false);

  useEffect(() => {
    if (searchParams) {
      if (searchParams.get('origin')) setOrigin(searchParams.get('origin') as string);
      if (searchParams.get('destination')) setDestination(searchParams.get('destination') as string);
      if (searchParams.get('date')) setDate(searchParams.get('date') as string);
      if (searchParams.get('weight')) {
        const wStr = searchParams.get('weight');
        // If it comes from radio buttons (e.g., "Dưới 5kg", "5 - 10kg")
        if (wStr === 'Dưới 5kg') setWeight(5);
        else if (wStr === '5 - 10kg') setWeight(10);
        else if (wStr === '10 - 20kg') setWeight(20);
        else if (wStr === 'Trên 20kg') setWeight(25);
        else setWeight(Number(wStr) || 5);
      }
    }
  }, [searchParams]);

  const calculateFee = () => {
    let base = 50000; // 50k base
    if (weight > 5) base += (weight - 5) * 10000;
    if (freightType === 'Dễ vỡ' || isFragile) base += 20000;
    if (freightType === 'Giá trị cao' || isValuable) base += 50000;
    return base;
  };

  const fee = calculateFee();

  return (
    <div className="min-h-screen">
      <div className="min-h-screen bg-[#F8FAF9] py-8 font-sans">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="mb-6">
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 flex items-center gap-3">
              📦 Gửi hàng theo nhà xe
            </h1>
            <p className="text-sm text-slate-500 mt-2">BusWay kết nối khách hàng với các nhà xe có hỗ trợ nhận và vận chuyển hàng hóa.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              
              {/* Tuyến vận chuyển */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                <h2 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
                  <div className="bg-rose-100 p-1.5 rounded-full">
                    <MapPin className="w-5 h-5 text-rose-500" />
                  </div>
                  Tuyến vận chuyển
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1.5">Nơi gửi</label>
                    <input 
                      type="text" 
                      value={origin}
                      onChange={(e) => setOrigin(e.target.value)}
                      className="w-full h-11 px-4 rounded-xl border border-slate-300 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand font-semibold text-slate-800 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1.5">Nơi nhận</label>
                    <input 
                      type="text" 
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      className="w-full h-11 px-4 rounded-xl border border-slate-300 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand font-semibold text-slate-800 bg-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1.5">Ngày gửi</label>
                  <input 
                    type="date" 
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full h-11 px-4 rounded-xl border border-slate-300 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand font-semibold text-slate-800 bg-white"
                  />
                </div>

                <div className="mt-8 mb-4 flex justify-between items-end">
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">Chọn nhà xe & chuyến nhận hàng</h3>
                    <p className="text-xs text-slate-500 mt-1">Chỉ hiển thị các nhà xe có hỗ trợ nhận hàng trên tuyến và ngày bạn đã chọn.</p>
                  </div>
                  <span className="px-3 py-1 bg-blue-50 text-blue-600 font-bold text-xs rounded-full">3 chuyến</span>
                </div>

                <div className="space-y-4">
                  {/* Company 1 */}
                  <label className={`block p-4 rounded-xl border-2 cursor-pointer transition-colors ${selectedCompany === 'phuong-dong' ? 'border-blue-500 bg-blue-50/30' : 'border-slate-200 bg-white hover:border-blue-200'}`}>
                    <div className="flex items-start gap-3">
                      <div className="mt-1">
                        <input type="radio" name="company" checked={selectedCompany === 'phuong-dong'} onChange={() => setSelectedCompany('phuong-dong')} className="w-5 h-5 accent-blue-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-extrabold text-slate-900 text-base">Nhà xe Phương Đông</span>
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">Nhận gửi hàng</span>
                            </div>
                            <div className="font-bold text-slate-800 text-sm mb-1">
                              08:00 <ArrowRight className="w-3 h-3 inline text-slate-400 mx-1" /> 14:00
                            </div>
                            <div className="text-xs text-slate-500">
                              Điểm gửi: Bến xe Miền Đông • Điểm nhận: Bến xe Đà Lạt • Dự kiến nhận: 14:30
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-100 inline-block mb-1">Còn 45 kg</div>
                            <div className="text-xs text-slate-500">Cước từ 50.000đ</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </label>
                  
                  {/* Company 2 */}
                  <label className={`block p-4 rounded-xl border-2 cursor-pointer transition-colors ${selectedCompany === 'thanh-buoi' ? 'border-blue-500 bg-blue-50/30' : 'border-slate-200 bg-white hover:border-blue-200'}`}>
                    <div className="flex items-start gap-3">
                      <div className="mt-1">
                        <input type="radio" name="company" checked={selectedCompany === 'thanh-buoi'} onChange={() => setSelectedCompany('thanh-buoi')} className="w-5 h-5 accent-blue-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-extrabold text-slate-900 text-base">Nhà xe Thành Bưởi</span>
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">Nhận gửi hàng</span>
                            </div>
                            <div className="font-bold text-slate-800 text-sm mb-1">
                              14:30 <ArrowRight className="w-3 h-3 inline text-slate-400 mx-1" /> 20:30
                            </div>
                            <div className="text-xs text-slate-500">
                              Điểm gửi: Văn phòng Q1 • Điểm nhận: VP Đà Lạt • Dự kiến nhận: 21:00
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-100 inline-block mb-1">Còn 80 kg</div>
                            <div className="text-xs text-slate-500">Cước từ 60.000đ</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Thông tin người gửi */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                <h2 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
                  <div className="bg-blue-100 p-1.5 rounded-full">
                    <User className="w-5 h-5 text-blue-600" />
                  </div>
                  Thông tin người gửi
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1.5">Họ và tên</label>
                    <input 
                      type="text" 
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      placeholder="Nguyễn Văn A" 
                      className="w-full h-11 px-4 rounded-xl border border-slate-300 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand font-semibold text-slate-800 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1.5">Số điện thoại</label>
                    <input 
                      type="text" 
                      value={senderPhone}
                      onChange={(e) => setSenderPhone(e.target.value)}
                      placeholder="09xxxxxxxx" 
                      className="w-full h-11 px-4 rounded-xl border border-slate-300 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand font-semibold text-slate-800 bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Thông tin người nhận */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                <h2 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
                  <div className="bg-slate-100 p-1.5 rounded-full">
                    <Users className="w-5 h-5 text-slate-600" />
                  </div>
                  Thông tin người nhận
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1.5">Họ và tên</label>
                    <input 
                      type="text" 
                      value={receiverName}
                      onChange={(e) => setReceiverName(e.target.value)}
                      placeholder="Nguyễn Văn B" 
                      className="w-full h-11 px-4 rounded-xl border border-slate-300 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand font-semibold text-slate-800 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1.5">Số điện thoại</label>
                    <input 
                      type="text" 
                      value={receiverPhone}
                      onChange={(e) => setReceiverPhone(e.target.value)}
                      placeholder="09xxxxxxxx" 
                      className="w-full h-11 px-4 rounded-xl border border-slate-300 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand font-semibold text-slate-800 bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Thông tin kiện hàng */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                <h2 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
                  <div className="bg-amber-100 p-1.5 rounded-full">
                    <Package className="w-5 h-5 text-amber-600" />
                  </div>
                  Thông tin kiện hàng
                </h2>
                
                <div className="space-y-5">
                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-2">Loại hàng hóa</label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { id: 'Hàng thường', label: 'Hàng thường' },
                        { id: 'Dễ vỡ', label: 'Dễ vỡ' },
                        { id: 'Giá trị cao', label: 'Giá trị cao' }
                      ].map((type) => (
                        <button
                          key={type.id}
                          onClick={() => setFreightType(type.id)}
                          className={`h-11 rounded-xl text-sm font-bold border transition-colors ${
                            freightType === type.id 
                              ? 'bg-blue-50 border-blue-500 text-blue-700' 
                              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          {type.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="col-span-1 md:col-span-2">
                      <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1.5">Số kiện</label>
                      <input 
                        type="number" 
                        min="1"
                        value={quantity || ''}
                        onChange={(e) => setQuantity(Number(e.target.value))}
                        className="w-full h-11 px-4 rounded-xl border border-slate-300 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand font-semibold"
                      />
                    </div>
                    <div className="col-span-1 md:col-span-3">
                      <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1.5">Khối lượng ước tính (kg)</label>
                      <input 
                        type="number" 
                        min="1"
                        value={weight || ''}
                        onChange={(e) => setWeight(Number(e.target.value))}
                        className="w-full h-11 px-4 rounded-xl border border-slate-300 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand font-semibold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1.5">Dài (cm)</label>
                      <input 
                        type="number" 
                        min="1"
                        value={length || ''}
                        onChange={(e) => setLength(Number(e.target.value))}
                        className="w-full h-11 px-4 rounded-xl border border-slate-300 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1.5">Rộng (cm)</label>
                      <input 
                        type="number" 
                        min="1"
                        value={width || ''}
                        onChange={(e) => setWidth(Number(e.target.value))}
                        className="w-full h-11 px-4 rounded-xl border border-slate-300 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1.5">Cao (cm)</label>
                      <input 
                        type="number" 
                        min="1"
                        value={height || ''}
                        onChange={(e) => setHeight(Number(e.target.value))}
                        className="w-full h-11 px-4 rounded-xl border border-slate-300 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand font-semibold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1.5">Ghi chú</label>
                    <textarea 
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Ví dụ: hàng dễ vỡ, không chồng vật nặng lên trên..."
                      className="w-full p-4 rounded-xl border border-slate-300 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand text-sm resize-none h-24"
                    ></textarea>
                  </div>

                  <div className="flex flex-wrap items-center gap-6">
                    <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer hover:text-slate-900">
                      <input type="checkbox" checked={isFragile} onChange={(e) => setIsFragile(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-brand focus:ring-brand" />
                      Hàng dễ vỡ
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer hover:text-slate-900">
                      <input type="checkbox" checked={isValuable} onChange={(e) => setIsValuable(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-brand focus:ring-brand" />
                      Giá trị cao
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer hover:text-slate-900">
                      <input type="checkbox" checked={needsCare} onChange={(e) => setNeedsCare(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-brand focus:ring-brand" />
                      Cần xử lý cẩn thận
                    </label>
                  </div>

                  <div className="bg-amber-50 rounded-xl p-4 text-sm text-amber-800 border border-amber-100">
                    <strong>Lưu ý:</strong> Không nhận vận chuyển hàng thuộc danh mục cấm. Nhà xe có quyền kiểm tra kiện hàng trước khi tiếp nhận.
                  </div>
                </div>
              </div>
            </div>

            {/* Cột phải: Tính phí */}
            <div className="w-full lg:w-[380px] shrink-0">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sticky top-24">
                <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-brand" /> Dự tính cước phí
                </h2>

                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 font-semibold">Cước cơ bản (5kg đầu):</span>
                    <span className="font-bold text-slate-900">50.000đ</span>
                  </div>
                  {weight > 5 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500 font-semibold">Phụ phí vượt mức:</span>
                      <span className="font-bold text-slate-900">{((weight - 5) * 10000).toLocaleString('vi-VN')}đ</span>
                    </div>
                  )}
                  {(freightType === 'Dễ vỡ' || isFragile) && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500 font-semibold">Phụ phí hàng dễ vỡ:</span>
                      <span className="font-bold text-slate-900">20.000đ</span>
                    </div>
                  )}
                  {(freightType === 'Giá trị cao' || isValuable) && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500 font-semibold">Bảo hiểm hàng giá trị:</span>
                      <span className="font-bold text-slate-900">50.000đ</span>
                    </div>
                  )}
                  
                  <div className="pt-3 border-t border-slate-200 flex justify-between items-center">
                    <span className="text-base font-black text-slate-800">Tổng tiền</span>
                    <span className="text-2xl font-black text-rose-600">{fee.toLocaleString('vi-VN')}đ</span>
                  </div>
                </div>

                <button 
                  onClick={() => router.push('/payment')}
                  className="w-full h-12 bg-accent text-white font-black text-base rounded-xl hover:bg-accent-hover transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  Tạo mã vận đơn
                  <ArrowRight className="w-5 h-5" />
                </button>
                
                <p className="text-xs text-center text-slate-500 mt-4">
                  Mang kiện hàng và mã vận đơn ra bến xe để hoàn tất thủ tục gửi hàng.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SendFreightPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Gửi hàng theo nhà xe - Đang tải...</div>}>
      <SendFreightContent />
    </Suspense>
  );
}
