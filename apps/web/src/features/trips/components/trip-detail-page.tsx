'use client';

import React, { useEffect, useState } from 'react';
import { Trip, getTripDetailsMock } from '../services/trips.mock';
import { MapPin, Clock, Info, CheckCircle2, Star, BusFront, ShieldCheck, CreditCard } from 'lucide-react';
import Link from 'next/link';

export const TripDetailPage = ({ tripId }: { tripId: string }) => {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTrip = async () => {
      setLoading(true);
      try {
        const result = await getTripDetailsMock(Number(tripId));
        setTrip(result);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchTrip();
  }, [tripId]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  const formatTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="bg-[#f5f5f5] min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand"></div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="bg-[#f5f5f5] min-h-screen flex flex-col items-center justify-center">
        <h1 className="text-2xl font-black text-slate-800 mb-4">Không tìm thấy chuyến xe</h1>
        <Link href="/trips" className="bg-brand text-white px-6 py-2 rounded-lg font-bold">Quay lại tìm kiếm</Link>
      </div>
    );
  }

  return (
    <div className="bg-[#f5f5f5] min-h-screen pb-12">
      {/* Header */}
      <div className="bg-brand text-white py-8">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="flex items-center gap-4 text-sm font-medium text-brand-100 mb-4">
            <Link href="/" className="hover:text-white">Trang chủ</Link>
            <span>/</span>
            <Link href="/trips" className="hover:text-white">Tìm chuyến</Link>
            <span>/</span>
            <span className="text-white">Chi tiết chuyến xe</span>
          </div>
          <h1 className="text-3xl font-black mb-2">{trip.route.origin} đi {trip.route.destination}</h1>
          <p className="text-brand-50 text-lg">{formatDate(trip.departureTime)}</p>
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-6xl mt-8 flex flex-col lg:flex-row gap-6">
        {/* Left Column: Details */}
        <div className="w-full lg:w-2/3 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-slate-100 rounded-xl flex items-center justify-center font-bold text-slate-400">
                  LOGO
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900">{trip.busCompany.name}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex items-center text-amber-500 text-sm font-bold">
                      <Star className="w-4 h-4 fill-current mr-1" /> {trip.busCompany.rating}
                    </div>
                    <span className="text-slate-300">•</span>
                    <span className="text-sm font-medium text-slate-500">{trip.busCompany.reviewsCount} đánh giá</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-6 p-6 bg-slate-50 rounded-xl border border-slate-100">
              <div className="flex gap-4">
                <div className="w-16 text-right pt-0.5">
                  <div className="text-lg font-black text-slate-900">{formatTime(trip.departureTime)}</div>
                  <div className="text-xs font-medium text-slate-500 mt-1">{formatDate(trip.departureTime)}</div>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-4 h-4 rounded-full bg-brand border-4 border-brand-100 shadow-sm relative z-10"></div>
                  <div className="w-px h-full bg-slate-300 border-l-2 border-dashed border-slate-300 -my-2 relative z-0"></div>
                </div>
                <div className="flex-1 pb-8 pt-0.5">
                  <div className="font-bold text-slate-900">{trip.route.origin}</div>
                  <div className="text-sm text-slate-500 mt-1">Văn phòng chính (Dự kiến)</div>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-16 text-right pt-0.5">
                  <div className="text-lg font-black text-slate-900">{formatTime(trip.arrivalTime)}</div>
                  <div className="text-xs font-medium text-slate-500 mt-1">{formatDate(trip.arrivalTime)}</div>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-4 h-4 rounded-full border-4 border-rose-100 bg-rose-500 shadow-sm relative z-10"></div>
                </div>
                <div className="flex-1 pt-0.5">
                  <div className="font-bold text-slate-900">{trip.route.destination}</div>
                  <div className="text-sm text-slate-500 mt-1">Bến xe trung tâm (Dự kiến)</div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
            <h3 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2">
              <BusFront className="w-5 h-5 text-brand" /> Thông tin xe
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                <div className="text-sm text-slate-500 font-medium mb-1">Loại xe</div>
                <div className="font-bold text-slate-900">{trip.vehicle.type}</div>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                <div className="text-sm text-slate-500 font-medium mb-1">Tiện ích</div>
                <div className="font-bold text-slate-900 flex flex-wrap gap-2 mt-1">
                  {trip.vehicle.amenities.map(a => (
                    <span key={a} className="bg-white px-2 py-1 rounded text-xs border border-slate-200">{a}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Checkout / Booking Mock */}
        <div className="w-full lg:w-1/3">
          <div className="bg-white rounded-xl shadow-lg border border-brand/10 p-6 sticky top-6">
            <h3 className="text-lg font-black text-slate-900 mb-6 pb-4 border-b border-slate-100">Chi tiết đặt vé</h3>
            
            <div className="space-y-4 mb-6">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Giá vé</span>
                <span className="font-bold text-slate-900">{formatCurrency(trip.price)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Số lượng ghế trống</span>
                <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">{trip.availableSeats} ghế</span>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 mb-6">
              <div className="flex items-start gap-3 mb-3 text-sm text-slate-600 font-medium">
                <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
                <span>Thanh toán an toàn, bảo mật qua VNPay/Momo</span>
              </div>
              <div className="flex items-start gap-3 text-sm text-slate-600 font-medium">
                <Info className="w-5 h-5 text-amber-500 shrink-0" />
                <span>Bạn cần chọn ghế trước khi thanh toán. Sơ đồ ghế sẽ được hiển thị ở bước tiếp theo.</span>
              </div>
            </div>

            <button 
              className="w-full bg-brand hover:bg-[#b3000e] text-white font-black py-4 rounded-xl shadow-md transition-colors text-lg"
              onClick={() => alert('Sơ đồ ghế đang được phát triển!')}
            >
              Chọn chỗ ngồi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
