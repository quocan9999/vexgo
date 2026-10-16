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
} from 'lucide-react';
import { bookingsApi } from '@/features/account/services/bookings.api';
import { useAuthSession } from '@/features/auth/auth-session';
import { PAYMENT_DRAFT_STORAGE_PREFIX } from '@/features/booking/services/payment-draft';

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
  promotionCode: string | null;
  originalTicketSubtotal: number;
  discountAmount: number;
  ticketSubtotal: number;
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
  const { isAuthenticated, isHydrated, executeWithAuth } = useAuthSession();
  const rawId = resolvedParams?.id || '';
  const numericBookingId = Number(rawId);

  const [invoice, setInvoice] = useState<InvoiceModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loadKey = `${rawId}:${isAuthenticated}:${isHydrated}`;

  useEffect(() => {
    if (!isHydrated) return;
    const controller = new AbortController();

    const formatTimeText = (timeStr?: string | null) => {
      if (!timeStr) return '—';
      const date = new Date(timeStr);
      if (Number.isNaN(date.getTime())) return '—';
      return `${date.getHours().toString().padStart(2, '0')}:${date
        .getMinutes()
        .toString()
        .padStart(2, '0')} • ${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1)
        .toString()
        .padStart(2, '0')}/${date.getFullYear()}`;
    };

    const loadInvoice = async () => {
      if (!Number.isSafeInteger(numericBookingId) || numericBookingId <= 0) {
        setError('Mã đặt vé không hợp lệ nên chưa thể xác minh vé.');
        setLoading(false);
        setLoadedKey(loadKey);
        return;
      }

      let guestCredentials:
        | { bookingCode: string; phoneNumber: string }
        | undefined;
      for (let index = 0; index < sessionStorage.length; index++) {
        const key = sessionStorage.key(index);
        if (!key?.startsWith(PAYMENT_DRAFT_STORAGE_PREFIX)) continue;
        const raw = sessionStorage.getItem(key);
        if (!raw) continue;
        try {
          const parsed: {
            bookingId?: number;
            bookingCode?: string;
            passenger?: { phoneNumber?: string };
          } = JSON.parse(raw);
          if (
            parsed.bookingId === numericBookingId &&
            parsed.bookingCode?.trim() &&
            parsed.passenger?.phoneNumber?.trim()
          ) {
            guestCredentials = {
              bookingCode: parsed.bookingCode,
              phoneNumber: parsed.passenger.phoneNumber,
            };
            break;
          }
        } catch {
          // Ignore malformed drafts; the backend still decides access.
        }
      }

      try {
        const response = isAuthenticated
          ? await executeWithAuth((token) =>
              bookingsApi.getPublicBookingDetail(numericBookingId, {
                signal: controller.signal,
                accessToken: token,
                ...guestCredentials,
              }),
            )
          : await bookingsApi.getPublicBookingDetail(numericBookingId, {
              signal: controller.signal,
              ...guestCredentials,
            });
        if (controller.signal.aborted) return;

        const booking = response.data;
        if (booking.bookingId !== numericBookingId) {
          throw new Error('Thông tin đơn đặt vé không khớp với yêu cầu.');
        }

        const statuses = [booking.status, booking.paymentStatus];
        const isPaid =
          booking.paymentStatus === 'DA_THANH_TOAN' &&
          ['DA_THANH_TOAN', 'HOAN_TAT'].includes(booking.status ?? '');
        if (!isPaid) {
          if (statuses.some((status) => ['DA_HUY', 'HUY'].includes(status ?? ''))) {
            throw new Error('Đơn đặt vé đã bị hủy nên không thể xuất vé điện tử.');
          }
          if (statuses.some((status) => ['HET_HAN', 'EXPIRED'].includes(status ?? ''))) {
            throw new Error('Đơn đặt vé đã hết hạn nên không thể xuất vé điện tử.');
          }
          if (statuses.some((status) => status === 'CHO_THANH_TOAN')) {
            throw new Error('Thanh toán chưa được hệ thống xác nhận. Vé sẽ xuất hiện sau khi ngân hàng xác nhận giao dịch.');
          }
          throw new Error('Chưa thể xác minh trạng thái thanh toán của đơn đặt vé.');
        }

        const totalAmount = Number(booking.totalAmount);
        if (
          !booking.bookingCode?.trim() ||
          !booking.orderCode?.trim() ||
          !Number.isFinite(totalAmount) ||
          totalAmount < 0
        ) {
          throw new Error('Thông tin vé từ máy chủ chưa đầy đủ nên chưa thể xuất vé.');
        }

        const cargoItems = (booking.cargoItems || []).map((item) => ({
          name: item.name || 'Hàng gửi kèm',
          quantity: item.quantity ?? 1,
          weight: item.weight ?? 0,
          category: item.category,
          categoryName: item.categoryName || 'Hàng gửi kèm',
        }));
        setInvoice({
          bookingCode: booking.bookingCode,
          orderCode: booking.orderCode,
          tripType: 'one-way',
          busCompanyName: booking.busCompanyName || '—',
          passengerName: booking.passenger?.fullName || '—',
          passengerPhone: booking.passenger?.phoneNumber || '—',
          passengerEmail: booking.passenger?.email || '',
          totalAmount,
          promotionCode:
            typeof booking.promotionCode === 'string'
              ? booking.promotionCode
              : null,
          originalTicketSubtotal: Number.isFinite(Number(booking.originalTicketSubtotal))
            ? Number(booking.originalTicketSubtotal)
            : Number(booking.ticketSubtotal ?? totalAmount),
          discountAmount: Number.isFinite(Number(booking.discountAmount))
            ? Number(booking.discountAmount)
            : 0,
          ticketSubtotal: Number.isFinite(Number(booking.ticketSubtotal))
            ? Number(booking.ticketSubtotal)
            : totalAmount,
          cargoFee: Number(booking.cargoFee) || 0,
          cargoItems,
          legs: [
            {
              route: booking.route || '—',
              departureTime: formatTimeText(booking.departureTime),
              seats: booking.seatNumbers || [],
              pickup: booking.pickup || booking.origin || '—',
              dropoff: booking.dropoff || booking.destination || '—',
              busCompanyName: booking.busCompanyName || '—',
              vehicleType: booking.vehicleType || '—',
              fare: Number(booking.ticketSubtotal ?? totalAmount),
            },
          ],
          paymentStatus: booking.paymentStatus!,
          paymentMethod: booking.paymentMethod || '—',
          createdAt: booking.createdAt || '—',
        });
        setError(null);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Không thể xác minh trạng thái thanh toán. Vui lòng thử lại sau.',
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          setLoadedKey(loadKey);
        }
      }
    };

    void loadInvoice();

    return () => {
      controller.abort();
    };
  }, [executeWithAuth, isAuthenticated, isHydrated, loadKey, numericBookingId]);

  const handlePrint = () => {
    window.print();
  };

  if (loading || loadedKey !== loadKey) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-600">Đang xuất vé điện tử...</p>
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-16 font-sans">
        <div className="mx-auto max-w-[460px] rounded-2xl border border-amber-200 bg-white p-6 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-amber-200 bg-amber-50 text-amber-700">
            <Clock aria-hidden="true" className="h-7 w-7" />
          </div>
          <h1 className="mb-2 text-lg font-bold text-slate-900">Chưa thể xuất vé điện tử</h1>
          <p role="alert" className="text-sm leading-relaxed text-slate-600">
            {error || 'Chưa thể xác minh trạng thái thanh toán của đơn đặt vé.'}
          </p>
          <Link href="/" className="mt-5 inline-flex h-10 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-bold text-white hover:bg-slate-800">
            Về trang chủ
          </Link>
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

            {invoice.promotionCode && (
              <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 space-y-2 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="text-slate-600">Mã khuyến mãi</span>
                  <strong className="font-mono text-emerald-800">{invoice.promotionCode}</strong>
                </div>
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="text-slate-600">Giá vé gốc của toàn đơn</span>
                  <strong className="text-slate-800">
                    {invoice.originalTicketSubtotal.toLocaleString('vi-VN')}đ
                  </strong>
                </div>
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="text-slate-600">Giảm giá cho toàn đơn</span>
                  <strong className="text-emerald-700">
                    −{invoice.discountAmount.toLocaleString('vi-VN')}đ
                  </strong>
                </div>
                <div className="flex flex-wrap justify-between gap-2 border-t border-emerald-200 pt-2">
                  <span className="text-slate-700">Tổng tiền vé sau ưu đãi</span>
                  <strong className="text-slate-900">
                    {invoice.ticketSubtotal.toLocaleString('vi-VN')}đ
                  </strong>
                </div>
                <p className="text-xs font-medium text-slate-600">
                  Ưu đãi chỉ áp dụng cho tiền vé; cước hàng hóa không được giảm.
                </p>
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
