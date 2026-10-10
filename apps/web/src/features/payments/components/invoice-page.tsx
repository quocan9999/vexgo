'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import {
  Download,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Package,
  Armchair,
  Printer,
  MapPin,
  Calendar,
} from 'lucide-react';
import { bookingsApi } from '@/features/account/services/bookings.api';

interface InvoiceLeg {
  route: string;
  departureTime: string;
  seats: string[];
  pickup: string;
  dropoff: string;
  busCompanyName: string;
  vehicleType: string;
  fare?: number;
}

interface InvoiceModel {
  bookingCode: string;
  orderCode: string;
  tripType: 'one-way' | 'round-trip';
  busCompanyName: string;
  passengerName: string;
  passengerPhone: string;
  passengerEmail?: string;
  totalAmount: number;
  cargoFee: number;
  cargoItems: Array<{
    name: string;
    quantity: number;
    weight: number;
    category?: string;
    categoryName?: string;
  }>;
  legs: InvoiceLeg[];
  paymentStatus: string;
  paymentMethod: string;
  createdAt: string;
}

export default function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const rawId = resolvedParams?.id || 'BW-888999';
  const numericBookingId = Number(rawId);

  const [invoice, setInvoice] = useState<InvoiceModel | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    // Helper format datetime
    const formatTimeText = (timeStr?: string | null) => {
      if (!timeStr) return '20:00 • Hôm nay';
      try {
        const d = new Date(timeStr);
        if (!isNaN(d.getTime())) {
          return `${d.getHours().toString().padStart(2, '0')}:${d
            .getMinutes()
            .toString()
            .padStart(2, '0')} • ${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1)
            .toString()
            .padStart(2, '0')}/${d.getFullYear()}`;
        }
      } catch {}
      return timeStr;
    };

    // Helper search sessionStorage for drafts or completed payments
    const findDraftFromSessionStorage = (): InvoiceModel | null => {
      if (typeof window === 'undefined') return null;
      try {
        let raw = sessionStorage.getItem(`vexgo:invoice:${rawId}`);
        if (!raw) {
          raw = sessionStorage.getItem(`vexgo:payment-draft:${rawId}`);
        }
        if (!raw) {
          raw = sessionStorage.getItem('vexgo:last-completed-booking');
        }
        if (!raw) {
          for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (
              key &&
              (key.startsWith('vexgo:payment-draft:') ||
                key.startsWith('vexgo:invoice:'))
            ) {
              const val = sessionStorage.getItem(key);
              if (val) {
                try {
                  const parsed = JSON.parse(val);
                  if (
                    parsed.bookingCode === rawId ||
                    parsed.orderCode === rawId ||
                    parsed.id === rawId ||
                    (numericBookingId && parsed.bookingId === numericBookingId)
                  ) {
                    raw = val;
                    break;
                  }
                } catch {}
              }
            }
          }
        }
        if (!raw) {
          raw = sessionStorage.getItem('vexgo:last-completed-booking');
        }

        if (raw) {
          const parsed = JSON.parse(raw);
          const legs: InvoiceLeg[] = (parsed.legs || []).map((leg: any) => ({
            route: leg.route || 'Chuyến xe liên tỉnh',
            departureTime: formatTimeText(leg.departureTime),
            seats: Array.isArray(leg.seats) && leg.seats.length > 0 ? leg.seats : ['A01'],
            pickup: leg.pickup || 'Bến xe xuất phát',
            dropoff: leg.dropoff || 'Bến xe đến',
            busCompanyName:
              leg.busCompanyName ||
              parsed.legs?.[0]?.busCompanyName ||
              'VexGo Transport',
            vehicleType:
              leg.vehicleType ||
              parsed.legs?.[0]?.vehicleType ||
              'Xe khách chất lượng cao',
            fare: leg.subtotal || 0,
          }));

          const cargoItems = (parsed.luggage?.items || []).map((it: any) => ({
            name: it.type || it.name || 'Hành lý',
            quantity: it.quantity || 1,
            weight: it.weight || 0,
            categoryName: it.category || 'Hàng gửi kèm',
          }));

          const isRoundTrip =
            parsed.tripType === 'round-trip' || legs.length > 1;

          return {
            bookingCode: parsed.bookingCode || rawId || 'VG-888999',
            orderCode:
              parsed.orderCode ||
              `GD-${(rawId || '888999').replace(/[^A-Za-z0-9]/g, '')}`,
            tripType: isRoundTrip ? 'round-trip' : 'one-way',
            busCompanyName:
              legs[0]?.busCompanyName || 'VexGo Transport',
            passengerName: parsed.passenger?.fullName || 'Hành khách VexGo',
            passengerPhone: parsed.passenger?.phoneNumber || '0987 654 321',
            passengerEmail: parsed.passenger?.email || '',
            totalAmount: parsed.totalFare || 620000,
            cargoFee: parsed.luggage?.fee || 0,
            cargoItems,
            legs:
              legs.length > 0
                ? legs
                : [
                    {
                      route: 'TP. Hồ Chí Minh - Đà Lạt',
                      departureTime: '20:00 • Hôm nay',
                      seats: ['A02', 'A03'],
                      pickup: 'Bến xe Miền Đông mới - Quầy vé 42',
                      dropoff: 'Bến xe Liên tỉnh Đà Lạt',
                      busCompanyName: 'Phương Trang (FUTA Bus Lines)',
                      vehicleType: 'Limousine 34 Phòng VIP',
                      fare: parsed.totalFare || 620000,
                    },
                  ],
            paymentStatus: parsed.paymentStatus || 'Đã thanh toán',
            paymentMethod: parsed.paymentMethod || 'Chuyển khoản VietQR',
            createdAt: parsed.createdAt || new Date().toISOString(),
          };
        }
      } catch (err) {
        console.warn('Error retrieving invoice from storage:', err);
      }
      return null;
    };

    // Realistic fallback data when opened directly with empty sessionStorage
    const createFallbackModel = (): InvoiceModel => {
      const code = rawId || 'BW-888999';
      return {
        bookingCode: code,
        orderCode: `GD-${code.replace(/[^A-Za-z0-9]/g, '')}`,
        tripType: 'one-way',
        busCompanyName: 'Phương Trang (FUTA Bus Lines)',
        passengerName: 'Nguyễn Văn An',
        passengerPhone: '0987 654 321',
        passengerEmail: 'nguyenvanan@vexgo.vn',
        totalAmount: 620000,
        cargoFee: 0,
        cargoItems: [],
        legs: [
          {
            route: 'TP. Hồ Chí Minh - Đà Lạt',
            departureTime: '20:00 • 15/10/2026',
            seats: ['A02', 'A03'],
            pickup: 'Bến xe Miền Đông mới - Quầy vé 42',
            dropoff: 'Bến xe Liên tỉnh Đà Lạt',
            busCompanyName: 'Phương Trang (FUTA Bus Lines)',
            vehicleType: 'Limousine 34 Phòng VIP',
            fare: 620000,
          },
        ],
        paymentStatus: 'Đã thanh toán',
        paymentMethod: 'Chuyển khoản VietQR',
        createdAt: new Date().toISOString(),
      };
    };

    if (!isNaN(numericBookingId) && numericBookingId > 0) {
      bookingsApi
        .getPublicBookingDetail(numericBookingId)
        .then((res) => {
          if (!isMounted) return;
          const b = res.data;
          const cargo = (b.cargoItems || []).map((c: any) => ({
            name: c.name,
            quantity: c.quantity,
            weight: c.weight,
            category: c.category,
            categoryName: c.categoryName,
          }));

          setInvoice({
            bookingCode: b.bookingCode || rawId,
            orderCode: b.orderCode || `GD-${b.bookingCode || rawId}`,
            tripType: 'one-way',
            busCompanyName: b.busCompanyName || 'VexGo Transport',
            passengerName: b.passenger?.fullName || 'Hành khách VexGo',
            passengerPhone: b.passenger?.phoneNumber || '—',
            passengerEmail: b.passenger?.email || '',
            totalAmount: b.totalAmount || 0,
            cargoFee: b.cargoFee || 0,
            cargoItems: cargo,
            legs: [
              {
                route: b.route || 'Chuyến xe liên tỉnh',
                departureTime: formatTimeText(b.departureTime),
                seats: b.seatNumbers || [],
                pickup: b.pickup || b.origin || 'Bến xe xuất phát',
                dropoff: b.dropoff || b.destination || 'Bến xe đến',
                busCompanyName: b.busCompanyName || 'VexGo Transport',
                vehicleType: b.vehicleType || 'Xe khách chất lượng cao',
                fare: b.ticketSubtotal || b.totalAmount || 0,
              },
            ],
            paymentStatus: b.paymentStatus || 'Đã thanh toán',
            paymentMethod: b.paymentMethod || 'Chuyển khoản',
            createdAt: b.createdAt,
          });
          setLoading(false);
        })
        .catch(() => {
          if (!isMounted) return;
          const fromDraft = findDraftFromSessionStorage();
          setInvoice(fromDraft || createFallbackModel());
          setLoading(false);
        });
    } else {
      const fromDraft = findDraftFromSessionStorage();
      setInvoice(fromDraft || createFallbackModel());
      setLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [rawId, numericBookingId]);

  const handlePrint = () => {
    window.print();
  };

  if (loading || !invoice) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-600">Đang xuất vé điện tử...</p>
        </div>
      </div>
    );
  }

  const isRoundTrip = invoice.tripType === 'round-trip' || invoice.legs.length > 1;
  const qrData = encodeURIComponent(`https://vexgo.vn/tra-cuu-ve?code=${invoice.bookingCode}`);
  const qrImageSrc = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${qrData}`;

  return (
    <div className="min-h-screen bg-slate-100 py-10 font-sans print:py-0 print:bg-white">
      <div className="w-full max-w-4xl mx-auto px-4 sm:px-6">
        {/* Navigation & Action Bar (Hidden on Print) */}
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Về trang chủ
          </Link>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handlePrint}
              className="h-10 px-4 rounded-xl bg-white border border-slate-200 text-slate-800 font-bold text-sm flex items-center gap-2 shadow-2xs hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              In vé
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="h-10 px-4 rounded-xl bg-slate-900 text-white font-bold text-sm flex items-center gap-2 shadow-2xs hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Tải vé PDF
            </button>
          </div>
        </div>

        {/* E-Ticket Card */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col md:flex-row relative">
          {/* CỘT TRÁI: THÔNG TIN CHI TIẾT VÉ */}
          <div className="p-7 sm:p-9 flex-1 border-b md:border-b-0 md:border-r-2 border-dashed border-slate-200 relative">
            {/* Header Vé */}
            <div className="flex justify-between items-start mb-6 pb-5 border-b border-slate-100">
              <div>
                <span className="text-xs font-black tracking-widest text-slate-500 uppercase mb-1 block">
                  {isRoundTrip
                    ? 'Vé xe khứ hồi điện tử (Round-trip E-Ticket)'
                    : 'Vé xe điện tử (E-Ticket)'}
                </span>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                  {invoice.busCompanyName}
                </h1>
                <p className="text-xs font-semibold text-slate-500 mt-0.5">
                  Mã giao dịch: {invoice.orderCode}
                </p>
              </div>

              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold shrink-0">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Đã thanh toán</span>
              </div>
            </div>

            {/* Thông tin Hành khách chung nếu là vé khứ hồi */}
            {isRoundTrip && (
              <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-100 mb-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Hành khách
                  </span>
                  <p className="font-bold text-slate-900 text-base">
                    {invoice.passengerName}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Số điện thoại
                  </span>
                  <p className="font-bold text-slate-900 text-base">
                    {invoice.passengerPhone}
                  </p>
                </div>
                {invoice.passengerEmail && (
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      Email
                    </span>
                    <p className="font-medium text-slate-700 text-sm">
                      {invoice.passengerEmail}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* HIỂN THỊ CÁC CHẶNG XE */}
            {isRoundTrip ? (
              <div className="space-y-5 mb-6">
                {invoice.legs.map((leg, index) => {
                  const isOutbound = index === 0;
                  return (
                    <div
                      key={index}
                      className="rounded-2xl border border-slate-200 p-5 bg-white shadow-2xs relative overflow-hidden"
                    >
                      <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider ${
                              isOutbound
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {isOutbound ? 'LƯỢT ĐI' : 'LƯỢT VỀ'}
                          </span>
                          <span className="text-sm font-black text-slate-900">
                            {leg.route}
                          </span>
                        </div>
                        <span className="text-xs font-semibold text-slate-500">
                          {leg.vehicleType}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
                        <div>
                          <span className="text-xs font-medium text-slate-500 block mb-0.5">
                            Khởi hành
                          </span>
                          <p className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-slate-500 inline-block" />
                            {leg.departureTime}
                          </p>
                        </div>

                        <div>
                          <span className="text-xs font-medium text-slate-500 block mb-0.5">
                            Vị trí ghế ({leg.seats.length} ghế)
                          </span>
                          <p className="font-black text-slate-900 text-sm flex items-center gap-1.5">
                            <Armchair className="w-3.5 h-3.5 text-slate-500 inline-block" />
                            <span className="bg-slate-100 text-slate-900 px-2 py-0.5 rounded-md">
                              {leg.seats.join(', ')}
                            </span>
                          </p>
                        </div>

                        <div className="col-span-2 pt-2 border-t border-slate-100/80">
                          <span className="text-xs font-medium text-slate-500 block mb-0.5">
                            Điểm đón khách
                          </span>
                          <p className="font-bold text-slate-800 text-xs leading-relaxed flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            {leg.pickup}
                          </p>
                        </div>

                        {leg.dropoff && leg.dropoff !== leg.pickup && (
                          <div className="col-span-2">
                            <span className="text-xs font-medium text-slate-500 block mb-0.5">
                              Điểm trả khách
                            </span>
                            <p className="font-medium text-slate-700 text-xs leading-relaxed flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              {leg.dropoff}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Hiển thị Chuyến 1 chiều chuẩn */
              <>
                {/* Thông tin Chuyến xe */}
                <div className="bg-slate-50 rounded-2xl p-4 sm:p-5 border border-slate-100 mb-6">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Tuyến đường
                  </span>
                  <h2 className="text-xl font-black text-slate-900 mb-1 leading-snug">
                    {invoice.legs[0]?.route || 'Chuyến xe liên tỉnh'}
                  </h2>
                  <p className="text-xs font-semibold text-slate-600">
                    {invoice.legs[0]?.vehicleType || 'Xe khách chất lượng cao'}
                  </p>
                </div>

                {/* Grid Thông tin Hành khách & Thời gian */}
                <div className="grid grid-cols-2 gap-y-5 gap-x-4 text-sm mb-6">
                  <div>
                    <span className="text-xs font-medium text-slate-500 block mb-1">
                      Hành khách
                    </span>
                    <p className="font-bold text-slate-900 text-base">
                      {invoice.passengerName}
                    </p>
                  </div>

                  <div>
                    <span className="text-xs font-medium text-slate-500 block mb-1">
                      Số điện thoại
                    </span>
                    <p className="font-bold text-slate-900 text-base">
                      {invoice.passengerPhone}
                    </p>
                  </div>

                  <div>
                    <span className="text-xs font-medium text-slate-500 block mb-1">
                      Khởi hành
                    </span>
                    <p className="font-bold text-slate-900 text-base flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-slate-500 inline-block" />
                      {invoice.legs[0]?.departureTime}
                    </p>
                  </div>

                  <div>
                    <span className="text-xs font-medium text-slate-500 block mb-1">
                      Vị trí ghế ({invoice.legs[0]?.seats.length || 0} ghế)
                    </span>
                    <p className="font-black text-slate-900 text-base flex items-center gap-1.5">
                      <Armchair className="w-4 h-4 text-slate-500 inline-block" />
                      <span className="bg-slate-100 text-slate-900 px-2 py-0.5 rounded-md">
                        {invoice.legs[0]?.seats.join(', ')}
                      </span>
                    </p>
                  </div>

                  <div className="col-span-2 pt-3 border-t border-slate-100">
                    <span className="text-xs font-medium text-slate-500 block mb-1">
                      Điểm đón khách
                    </span>
                    <p className="font-bold text-slate-900 text-sm leading-relaxed">
                      {invoice.legs[0]?.pickup}
                    </p>
                  </div>

                  {invoice.legs[0]?.dropoff && (
                    <div className="col-span-2">
                      <span className="text-xs font-medium text-slate-500 block mb-1">
                        Điểm trả khách
                      </span>
                      <p className="font-medium text-slate-700 text-sm leading-relaxed">
                        {invoice.legs[0]?.dropoff}
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Mục Hàng gửi kèm hầm xe (Nếu có) */}
            {invoice.cargoItems.length > 0 && (
              <div className="pt-5 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-slate-500" />
                    Hàng gửi kèm hầm xe ({invoice.cargoItems.length} kiện)
                  </span>
                  <span className="text-xs font-black text-slate-900">
                    Cước:{' '}
                    {invoice.cargoFee > 0
                      ? `${invoice.cargoFee.toLocaleString('vi-VN')}đ`
                      : 'Miễn phí'}
                  </span>
                </div>

                <div className="space-y-1.5 bg-slate-50 rounded-xl p-3 border border-slate-100 text-xs">
                  {invoice.cargoItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between items-center text-slate-700"
                    >
                      <span className="font-semibold">
                        • {item.quantity}x {item.name} ({item.categoryName})
                      </span>
                      <span className="font-mono text-slate-600 font-bold">
                        {item.weight} kg
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tổng tiền thanh toán */}
            <div className="mt-6 pt-5 border-t border-slate-200 flex justify-between items-end">
              <div>
                <span className="text-xs font-medium text-slate-500 block">
                  Tổng số tiền đã thanh toán
                </span>
                <span className="text-xs text-slate-500">
                  {isRoundTrip
                    ? 'Bao gồm 2 lượt đi - về, VAT và cước hàng hóa'
                    : 'Đã bao gồm VAT và cước hàng hóa'}
                </span>
              </div>
              <div className="text-right">
                <span className="text-2xl font-black text-slate-900 tracking-tight">
                  {invoice.totalAmount.toLocaleString('vi-VN')}đ
                </span>
              </div>
            </div>

            {/* Cắt góc cuống vé (Ticket Cutout notches) */}
            <div className="w-7 h-7 rounded-full bg-slate-100 absolute -right-3.5 -bottom-3.5 hidden md:block" />
            <div className="w-7 h-7 rounded-full bg-slate-100 absolute -right-3.5 -top-3.5 hidden md:block" />
          </div>

          {/* CỘT PHẢI: MÃ ĐẶT CHỖ & MÃ QR */}
          <div className="p-7 sm:p-9 w-full md:w-[320px] shrink-0 flex flex-col items-center justify-between bg-white text-center">
            <div className="w-full">
              <span className="text-xs font-black tracking-widest text-slate-500 uppercase block mb-1">
                Mã đặt chỗ (Code)
              </span>
              <p className="text-2xl font-black text-slate-900 tracking-wider font-mono">
                {invoice.bookingCode}
              </p>
            </div>

            {/* QR Code */}
            <div className="my-6 p-3 bg-white rounded-2xl border-2 border-slate-200 shadow-2xs">
              <img
                src={qrImageSrc}
                alt={`Mã QR tra cứu vé ${invoice.bookingCode}`}
                className="w-44 h-44 object-contain"
              />
            </div>

            <div className="w-full">
              <p className="text-xs font-semibold text-slate-500 leading-relaxed mb-4">
                Vui lòng xuất trình mã QR này hoặc cung cấp mã đặt chỗ cho tài
                xế/phụ xe khi lên xe.
              </p>
              <div className="py-2 px-3 rounded-lg bg-slate-50 border border-slate-100 text-[11px] font-medium text-slate-600">
                Hỗ trợ 24/7: 1900 8888
              </div>
            </div>
          </div>
        </div>

        {/* Footer text */}
        <p className="text-xs text-slate-500 text-center mt-6 font-medium">
          Vé điện tử có giá trị như vé xe truyền thống. Cần hóa đơn GTGT, vui
          lòng liên hệ tổng đài trong vòng 24h.
        </p>
      </div>
    </div>
  );
}
