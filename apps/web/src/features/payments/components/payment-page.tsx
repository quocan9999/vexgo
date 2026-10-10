'use client';

import React, { useState, useEffect, useMemo, useSyncExternalStore, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Info, ScanLine, X, MapPin, Calendar, Clock, Armchair, User, Package } from 'lucide-react';
import {
  PAYMENT_DRAFT_STORAGE_PREFIX,
  validatePaymentDraft,
  type PaymentDraft,
} from '@/features/booking/services/payment-draft';
import { bookingsApi } from '@/features/account/services/bookings.api';

const emptySubscribe = () => () => {};

function useIsClient(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

function useRawPaymentDraft(draftId: string | null): string | null {
  return useSyncExternalStore(
    emptySubscribe,
    () => {
      if (!draftId || typeof window === 'undefined') return null;
      return sessionStorage.getItem(`${PAYMENT_DRAFT_STORAGE_PREFIX}${draftId}`);
    },
    () => null,
  );
}

function PaymentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const draftId = searchParams.get('draftId');

  const isClient = useIsClient();
  const rawDraft = useRawPaymentDraft(draftId);

  const draft = useMemo<PaymentDraft | null>(() => {
    if (!rawDraft) return null;
    try {
      return validatePaymentDraft(JSON.parse(rawDraft));
    } catch {
      return null;
    }
  }, [rawDraft]);

  const [selectedMethod, setSelectedMethod] = useState('vietqr');
  const [isProcessing, setIsProcessing] = useState(false);
  const [timeLeft, setTimeLeft] = useState(599); // 9:59
  const [showTripDetailModal, setShowTripDetailModal] = useState(false);
  const [showCargoDetailModal, setShowCargoDetailModal] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  // Tự động kiểm tra trạng thái thanh toán (Auto-Polling khi SePay bắn Webhook)
  useEffect(() => {
    const bookingId = draft?.bookingId;
    if (!bookingId) return;

    let isSubscribed = true;
    const checkInterval = setInterval(async () => {
      try {
        const res = await bookingsApi.getPublicBookingDetail(bookingId);
        if (
          isSubscribed &&
          (res.data?.status === 'DA_THANH_TOAN' || res.data?.paymentStatus === 'DA_THANH_TOAN')
        ) {
          clearInterval(checkInterval);
          router.push(`/invoice/${bookingId}`);
        }
      } catch {
        // Giữ polling tiếp tục nếu có lỗi tạm thời
      }
    }, 2500);

    return () => {
      isSubscribed = false;
      clearInterval(checkInterval);
    };
  }, [draft?.bookingId, router]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const transferContent = useMemo(() => {
    if (!draft) return 'VEXGO DATVE';
    if (draft.bookingCode) return `VEXGO ${draft.bookingCode}`;
    if (draft.orderCode) return `VEXGO ${draft.orderCode}`;
    return `VEXGO ${draft.passenger.phoneNumber || 'DATVE'}`;
  }, [draft]);

  const vietQrUrl = useMemo(() => {
    if (!draft) return '';
    const bankId = 'STB'; // Sacombank
    const accountNo = 'SEP1000IHVEXGO';
    const accountName = 'LE SONY';
    const amount = draft.totalFare;
    const memo = encodeURIComponent(transferContent);
    return `https://img.vietqr.io/image/${bankId}-${accountNo}-compact2.png?amount=${amount}&addInfo=${memo}&accountName=${encodeURIComponent(accountName)}`;
  }, [draft, transferContent]);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handlePayment = async () => {
    if (!draft) return;
    setIsProcessing(true);
    try {
      if (draft.bookingId) {
        try {
          await bookingsApi.confirmPayment(
            draft.bookingId,
            selectedMethod === 'momo'
              ? 'MOMO'
              : selectedMethod === 'vnpay'
                ? 'VNPAY'
                : 'CHUYEN_KHOAN',
          );
        } catch (e) {
          console.warn('Confirm payment api notice:', e);
        }
        const paidDraft = {
          ...draft,
          status: 'DA_THANH_TOAN',
          paymentStatus: 'DA_THANH_TOAN',
          paymentMethod: selectedMethod,
        };
        try {
          sessionStorage.setItem('vexgo:last-completed-booking', JSON.stringify(paidDraft));
          sessionStorage.setItem(`vexgo:invoice:${draft.bookingId}`, JSON.stringify(paidDraft));
          if (draft.bookingCode) {
            sessionStorage.setItem(`vexgo:invoice:${draft.bookingCode}`, JSON.stringify(paidDraft));
          }
        } catch {}
        router.push(`/invoice/${draft.bookingId}`);
      } else {
        const invoiceCode = draft.bookingCode || 'BW-888999';
        const paidDraft = {
          ...draft,
          bookingCode: invoiceCode,
          status: 'DA_THANH_TOAN',
          paymentStatus: 'DA_THANH_TOAN',
          paymentMethod: selectedMethod,
        };
        try {
          sessionStorage.setItem('vexgo:last-completed-booking', JSON.stringify(paidDraft));
          sessionStorage.setItem(`vexgo:invoice:${invoiceCode}`, JSON.stringify(paidDraft));
          sessionStorage.setItem('vexgo:invoice:BW-888999', JSON.stringify(paidDraft));
        } catch {}
        router.push(`/invoice/${invoiceCode}`);
      }
    } catch {
      const fallbackTarget = draft.bookingId || draft.bookingCode || 'BW-888999';
      try {
        const paidDraft = {
          ...draft,
          bookingCode: draft.bookingCode || 'BW-888999',
          status: 'DA_THANH_TOAN',
          paymentStatus: 'DA_THANH_TOAN',
          paymentMethod: selectedMethod,
        };
        sessionStorage.setItem('vexgo:last-completed-booking', JSON.stringify(paidDraft));
        sessionStorage.setItem(`vexgo:invoice:${fallbackTarget}`, JSON.stringify(paidDraft));
      } catch {}
      router.push(`/invoice/${fallbackTarget}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const methods = [
    {
      id: 'vietqr',
      name: 'Chuyển khoản VietQR',
      extra: 'Quét mã VietQR bằng mọi ứng dụng Ngân hàng (MB, VCB, BIDV, Techcombank...).',
    },
  ];

  if (!isClient) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-600">
            Đang tải thông tin thanh toán...
          </p>
        </div>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="min-h-screen bg-slate-50 py-16 font-sans">
        <div className="max-w-[460px] mx-auto px-4 text-center">
          <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center">
            <Info className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">
            Không tìm thấy thông tin thanh toán
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed mb-6">
            Thông tin đặt chỗ không tồn tại hoặc đã hết hạn. Vui lòng quay lại
            tìm chuyến xe và chọn ghế để tiếp tục.
          </p>
          <button
            type="button"
            onClick={() => router.push('/posts')}
            className="h-11 px-8 rounded-xl bg-brand hover:bg-brand-hover text-white text-sm font-bold transition-colors shadow-sm cursor-pointer"
          >
            Tìm chuyến xe
          </button>
        </div>
      </div>
    );
  }

  const totalFareText = `${draft.totalFare.toLocaleString('vi-VN')}đ`;

  return (
    <div className="min-h-screen bg-slate-50 py-8 font-sans">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6">
        <div className="mb-6">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-brand transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Quay lại
          </button>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Cột 1: Chọn phương thức thanh toán */}
          <div className="w-full lg:w-[300px] shrink-0">
            <h2 className="text-lg font-bold text-slate-900 mb-6">
              Chọn phương thức thanh toán
            </h2>
            <div className="space-y-4">
              {methods.map((method) => (
                <div
                  key={method.id}
                  className="flex items-start gap-4 p-3 rounded-2xl bg-white border border-slate-200/80 shadow-2xs"
                >
                  <div className="pt-0.5 shrink-0">
                    <div className="w-5 h-5 rounded-full border-2 border-brand bg-white flex items-center justify-center">
                      <div className="w-2.5 h-2.5 rounded-full bg-brand" />
                    </div>
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 text-[15px] block">
                      {method.name}
                    </span>
                    {method.extra && (
                      <p className="text-[12px] mt-1 font-medium leading-relaxed text-slate-600">
                        {method.extra}
                      </p>
                    )}
                  </div>
                </div>
              ))}

              {/* Hướng dẫn thanh toán */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-4">
                <h3 className="font-bold text-slate-900 text-sm">
                  Hướng dẫn thanh toán
                </h3>
                
                <div className="space-y-3.5 text-xs text-slate-700">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-slate-800 text-white font-bold flex items-center justify-center text-[11px] shrink-0">
                      1
                    </span>
                    <span className="font-medium">
                      Mở ứng dụng Ngân hàng trên điện thoại
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-slate-800 text-white font-bold flex items-center justify-center text-[11px] shrink-0">
                      2
                    </span>
                    <span className="font-medium flex items-center gap-1.5 flex-wrap">
                      Dùng biểu tượng <ScanLine className="w-4 h-4 text-slate-900 inline-block shrink-0" /> để quét mã QR
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-slate-800 text-white font-bold flex items-center justify-center text-[11px] shrink-0">
                      3
                    </span>
                    <span className="font-medium">
                      Quét mã ở trang này và xác nhận thanh toán
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Cột 2: QR Code & Thông tin chuyển khoản */}
          <div className="flex-1 flex flex-col items-center">
            <p className="text-sm font-semibold text-slate-500 mb-1">
              Tổng thanh toán
            </p>
            <h1 className="text-5xl font-bold text-red-600 mb-8 tracking-tight">
              {totalFareText}
            </h1>

            <div className="w-full max-w-[520px] bg-white rounded-3xl p-7 shadow-sm border border-slate-200 flex flex-col items-center">
              <p className="text-sm font-semibold text-amber-600 mb-4">
                Thời gian giữ chỗ còn lại {formatTime(timeLeft)}
              </p>

              {/* VietQR Image động thật - Kích thước lớn dễ quét */}
              <div className="w-full max-w-[420px] aspect-square border-2 border-slate-200 rounded-3xl p-3 mb-6 bg-white flex items-center justify-center overflow-hidden shadow-2xs">
                <img
                  src={vietQrUrl}
                  alt="Mã QR thanh toán VietQR"
                  className="w-full h-full object-contain"
                />
              </div>

              {/* Thông tin chuyển khoản sao chép */}
              <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-5 text-[13px] space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Ngân hàng:</span>
                  <span className="font-bold text-slate-900">Sacombank</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Chủ tài khoản:</span>
                  <span className="font-bold text-slate-900">LE SONY</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Số tài khoản VA:</span>
                  <div className="flex items-center gap-2">
                    <strong className="text-slate-950 font-black tracking-wide">SEP1000IHVEXGO</strong>
                    <button
                      type="button"
                      onClick={() => copyToClipboard('SEP1000IHVEXGO', 'stk')}
                      className="text-[11px] text-accent font-bold px-2 py-0.5 rounded bg-accent/10 hover:bg-accent/20 transition-colors whitespace-nowrap shrink-0"
                    >
                      {copiedField === 'stk' ? 'Đã chép' : 'Sao chép'}
                    </button>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Nội dung CK:</span>
                  <div className="flex items-center gap-2">
                    <strong className="text-emerald-700 font-black">{transferContent}</strong>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(transferContent, 'nd')}
                      className="text-[11px] text-accent font-bold px-2 py-0.5 rounded bg-accent/10 hover:bg-accent/20 transition-colors whitespace-nowrap shrink-0"
                    >
                      {copiedField === 'nd' ? 'Đã chép' : 'Sao chép'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="w-full text-center">
                <p className="text-xs font-semibold text-slate-600 mb-3 flex items-center justify-center gap-1.5">
                  <ScanLine className="w-4 h-4 text-emerald-600 inline-block" />
                  Quét mã qua bất kỳ App Ngân hàng
                </p>

                <button
                  type="button"
                  onClick={handlePayment}
                  disabled={isProcessing}
                  className="w-full h-11 bg-accent text-white font-bold rounded-xl hover:bg-accent-hover transition-colors flex items-center justify-center gap-2 disabled:opacity-70 text-sm cursor-pointer shadow-sm"
                >
                  {isProcessing ? 'Đang xác nhận...' : 'Tôi đã chuyển khoản thành công'}
                </button>
              </div>
            </div>
          </div>

          {/* Cột 3: Thông tin chi tiết */}
          <div className="w-full lg:w-[360px] shrink-0 space-y-4">
            {/* Thông tin hành khách */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="font-bold text-slate-900 text-base mb-4">
                Thông tin hành khách
              </h3>
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Họ và tên</span>
                  <span className="font-bold text-slate-800">
                    {draft.passenger.fullName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Số điện thoại</span>
                  <span className="font-bold text-slate-800">
                    {draft.passenger.phoneNumber}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Email</span>
                  <span className="font-bold text-slate-800">
                    {draft.passenger.email}
                  </span>
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
                <button
                  type="button"
                  onClick={() => setShowTripDetailModal(true)}
                  className="text-xs text-rose-500 font-bold underline cursor-pointer"
                >
                  Chi tiết
                </button>
              </div>

              <div className="space-y-4 text-[13px]">
                {draft.legs.map((leg, index) => (
                  <div
                    key={index}
                    className={
                      index > 0 ? 'pt-4 border-t border-slate-200' : ''
                    }
                  >
                    {draft.legs.length > 1 && (
                      <p className="text-xs font-black uppercase text-accent mb-2.5">
                        {index === 0 ? 'Lượt đi' : 'Lượt về'}
                      </p>
                    )}
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Tuyến xe</span>
                        <span className="font-bold text-slate-800 text-right">
                          {leg.route}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Thời gian xuất bến</span>
                        <span className="font-bold text-brand text-right">
                          {leg.departureTime}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Số lượng ghế</span>
                        <span className="font-bold text-slate-800 text-right">
                          {leg.seats.length} Ghế
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Số ghế</span>
                        <span className="font-bold text-brand text-right">
                          {leg.seats.join(', ')}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Điểm lên xe</span>
                        <span className="font-bold text-slate-800 text-right">
                          {leg.pickup}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Điểm trả khách</span>
                        <span className="font-bold text-slate-800 text-right">
                          {leg.dropoff}
                        </span>
                      </div>
                      <div className="flex justify-between pt-1">
                        <span className="text-slate-500">
                          {draft.legs.length > 1
                            ? index === 0
                              ? 'Tiền lượt đi'
                              : 'Tiền lượt về'
                            : 'Tổng tiền'}
                        </span>
                        <span className="font-bold text-red-600 text-right">
                          {leg.subtotal.toLocaleString('vi-VN')}đ
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Card Hàng gửi hầm xe */}
            {draft.luggage && draft.luggage.weight > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-center justify-between mb-3.5">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 text-base">
                      Hàng gửi hầm xe
                    </h3>
                  </div>
                  {draft.luggage.items && draft.luggage.items.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowCargoDetailModal(true)}
                      className="text-xs text-rose-500 font-bold underline cursor-pointer hover:text-rose-600 transition-colors"
                    >
                      Chi tiết
                    </button>
                  )}
                </div>

                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200/60 text-xs font-bold text-rose-700 mb-3.5">
                  <span>{draft.luggage.items?.length || 1} kiện</span>
                  <span>•</span>
                  <span>{draft.luggage.weight}kg</span>
                </div>

                {draft.luggage.items && draft.luggage.items.length > 0 ? (
                  <div className="space-y-2">
                    {draft.luggage.items.slice(0, 2).map((item, idx) => {
                      const actualW = item.weight || 0;
                      const volW =
                        item.length && item.width && item.height
                          ? Math.round(((item.length * item.width * item.height) / 5000) * 10) / 10
                          : 0;
                      const effW = Math.max(actualW, volW) * (item.quantity || 1);
                      const isMotorbike = item.type === 'Xe máy';
                      const isBicycle = item.type === 'Xe đạp';
                      let itemFee = 0;
                      if (isMotorbike) {
                        itemFee = 250000 * (item.quantity || 1);
                      } else if (isBicycle) {
                        itemFee = 100000 * (item.quantity || 1);
                      } else {
                        if (effW <= 20) itemFee = 0;
                        else if (effW <= 40) itemFee = 30000;
                        else itemFee = 30000;
                      }

                      return (
                        <div
                          key={item.id || idx}
                          className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80 flex items-start justify-between gap-3 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-slate-900">
                                {isMotorbike
                                  ? `Xe máy: ${item.motorbikeType || 'Xe số'}`
                                  : isBicycle
                                    ? `Xe đạp: ${item.bicycleType || 'Xe đạp thường'}`
                                    : `Kiện ${idx + 1}: ${item.type || 'Vali'}`}
                              </span>
                              {item.category === 'fragile' && (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-900 text-white">
                                  Dễ vỡ
                                </span>
                              )}
                              {item.category === 'valuable' && (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-900 text-white">
                                  Giá trị cao
                                </span>
                              )}
                            </div>
                            {isMotorbike ? (
                              <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                                {item.licensePlate && (
                                  <span className="bg-slate-200 text-slate-800 font-bold px-1.5 py-0.2 rounded text-[10px]">
                                    Biển số: {item.licensePlate}
                                  </span>
                                )}
                              </div>
                            ) : isBicycle ? (
                              <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                                <span>{item.quantity || 1} xe</span>
                                <span className="text-slate-300">•</span>
                                <span>Gửi hầm xe</span>
                              </div>
                            ) : (
                              <>
                                <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                                  <span>{item.weight} kg</span>
                                  {item.length && item.width && item.height && (
                                    <>
                                      <span className="text-slate-300">•</span>
                                      <span>{item.length}×{item.width}×{item.height}cm</span>
                                    </>
                                  )}
                                </div>
                                {volW > actualW && (
                                  <span className="inline-block mt-1 text-[10px] text-accent font-bold bg-accent/10 px-1.5 py-0.2 rounded">
                                    (Tính cước: {volW}kg quy đổi)
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                          <span className="font-extrabold text-red-600 shrink-0">
                            {itemFee === 0 ? (
                              <span className="text-emerald-600 font-bold">Miễn phí</span>
                            ) : (
                              `+${itemFee.toLocaleString('vi-VN')}đ`
                            )}
                          </span>
                        </div>
                      );
                    })}
                    {draft.luggage.items.length > 2 && (
                      <button
                        type="button"
                        onClick={() => setShowCargoDetailModal(true)}
                        className="text-[11px] text-slate-500 hover:text-slate-800 font-medium pt-1 text-center w-full block cursor-pointer"
                      >
                        + Xem thêm {draft.luggage.items.length - 2} kiện khác
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80 flex items-center justify-between text-xs">
                    <span className="text-slate-600 font-medium">Phụ phí ký gửi</span>
                    <strong className={draft.luggage.fee > 0 ? 'text-red-600 font-extrabold' : 'text-emerald-600 font-bold'}>
                      {draft.luggage.fee > 0 ? `+${draft.luggage.fee.toLocaleString('vi-VN')}đ` : 'Miễn phí'}
                    </strong>
                  </div>
                )}
              </div>
            )}

            {/* Chi tiết giá */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="font-bold text-slate-900 text-base mb-4 flex items-center gap-2">
                Chi tiết giá
                <Info className="w-4 h-4 text-red-600" />
              </h3>
              <div className="space-y-2.5 text-sm">
                {draft.legs.map((leg, index) => (
                  <div key={index} className="flex justify-between">
                    <span className="text-slate-500">
                      {draft.legs.length > 1
                        ? index === 0
                          ? `Giá vé lượt đi (${leg.seats.length} ghế)`
                          : `Giá vé lượt về (${leg.seats.length} ghế)`
                        : `Giá vé (${leg.seats.length} ghế)`}
                    </span>
                    <span className="font-bold text-red-600">
                      {leg.subtotal.toLocaleString('vi-VN')}đ
                    </span>
                  </div>
                ))}

                {draft.luggage && draft.luggage.fee > 0 ? (
                  <div className="flex justify-between">
                    <span className="text-slate-500">
                      Phụ phí hành lý ({draft.luggage.weight}kg)
                    </span>
                    <span className="font-bold text-red-600">
                      {draft.luggage.fee.toLocaleString('vi-VN')}đ
                    </span>
                  </div>
                ) : draft.luggage ? (
                  <div className="flex justify-between">
                    <span className="text-slate-500">
                      Hành lý ({draft.luggage.weight}kg)
                    </span>
                    <span className="font-bold text-emerald-600">Miễn phí</span>
                  </div>
                ) : null}
                <div className="flex justify-between pt-3 border-t border-slate-200 text-base">
                  <span className="text-slate-500 font-bold">Tổng tiền</span>
                  <span className="font-bold text-red-600 text-lg">
                    {totalFareText}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Chi tiết chuyến đi thật */}
      {showTripDetailModal && (
        <div
          className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-xs px-4 py-6 flex items-center justify-center animate-in fade-in duration-200"
          onClick={() => setShowTripDetailModal(false)}
        >
          <div
            className="w-full max-w-[440px] rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 flex flex-col max-h-[85vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-accent/10 text-accent flex items-center justify-center font-bold text-xs">
                  <Info className="w-4 h-4" />
                </span>
                <h3 className="text-base font-black text-slate-900">
                  Chi tiết chuyến đi
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowTripDetailModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Đóng"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Modal */}
            <div className="py-4 space-y-4 overflow-y-auto pr-0.5 text-xs">
              {draft.legs.map((leg, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-4 space-y-3"
                >
                  {draft.legs.length > 1 && (
                    <span className="inline-block px-2 py-0.5 rounded bg-accent text-white font-extrabold text-[10px] uppercase tracking-wide">
                      {idx === 0 ? 'Chặng đi' : 'Chặng về'}
                    </span>
                  )}

                  <div className="flex justify-between items-start gap-2">
                    <span className="text-slate-500 font-medium">Tuyến đường:</span>
                    <strong className="text-slate-900 font-bold text-right text-[13px]">
                      {leg.route}
                    </strong>
                  </div>

                  <div className="flex justify-between items-center gap-2">
                    <span className="text-slate-500 font-medium">Xuất bến:</span>
                    <strong className="text-emerald-700 font-bold">
                      {leg.departureTime}
                    </strong>
                  </div>

                  <div className="flex justify-between items-center gap-2">
                    <span className="text-slate-500 font-medium">Ghế đã chọn ({leg.seats.length}):</span>
                    <strong className="text-accent font-black text-[13px]">
                      {leg.seats.join(', ')}
                    </strong>
                  </div>

                  <div className="pt-2 border-t border-slate-200/80 space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-slate-500 font-medium">Điểm đón:</span>
                      <span className="text-slate-800 font-semibold text-right">
                        {leg.pickup}
                      </span>
                    </div>

                    <div className="flex justify-between items-start gap-2">
                      <span className="text-slate-500 font-medium">Điểm trả:</span>
                      <span className="text-slate-800 font-semibold text-right">
                        {leg.dropoff}
                      </span>
                    </div>

                    <div className="flex justify-between items-center gap-2 pt-1">
                      <span className="text-slate-500 font-medium">Tiền vé ({leg.seats.length} ghế):</span>
                      <strong className="text-red-600 font-extrabold">
                        {leg.subtotal.toLocaleString('vi-VN')}đ
                      </strong>
                    </div>
                  </div>
                </div>
              ))}

              {/* Thông tin hành khách */}
              <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 space-y-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Hành khách
                </span>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Họ và tên:</span>
                  <span className="font-bold text-slate-900">{draft.passenger.fullName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Số điện thoại:</span>
                  <span className="font-bold text-slate-900">{draft.passenger.phoneNumber}</span>
                </div>
                {draft.passenger.email && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Email:</span>
                    <span className="font-medium text-slate-700">{draft.passenger.email}</span>
                  </div>
                )}
              </div>

              {/* Thông tin hành lý nếu có */}
              {draft.luggage && (
                <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 space-y-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Hành lý ký gửi hầm xe
                  </span>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Khối lượng:</span>
                    <span className="font-bold text-slate-900">{draft.luggage.weight} kg</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Phụ phí:</span>
                    <strong className={draft.luggage.fee > 0 ? 'text-red-600 font-extrabold' : 'text-emerald-600 font-bold'}>
                      {draft.luggage.fee > 0 ? `+${draft.luggage.fee.toLocaleString('vi-VN')}đ` : 'Miễn phí'}
                    </strong>
                  </div>
                </div>
              )}

              {/* Tổng thanh toán trong modal */}
              <div className="rounded-xl bg-slate-900 text-white p-3.5 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 font-medium block">
                    Tổng tiền thanh toán
                  </span>
                  <span className="text-base font-black text-rose-400">
                    {totalFareText}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTripDetailModal(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Chi tiết hàng gửi hầm xe */}
      {showCargoDetailModal && draft.luggage?.items && (
        <div
          className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-xs px-4 py-6 flex items-center justify-center animate-in fade-in duration-200"
          onClick={() => setShowCargoDetailModal(false)}
        >
          <div
            className="w-full max-w-[440px] rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 flex flex-col max-h-[85vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 pb-3.5 border-b border-slate-100 shrink-0">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Chi tiết hàng gửi hầm xe
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Tổng cộng: {draft.luggage.items.length} kiện • {draft.luggage.weight}kg
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCargoDetailModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Đóng"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-3.5 space-y-2.5 overflow-y-auto pr-0.5 max-h-[55vh]">
              {draft.luggage.items.map((item, idx) => {
                const actualW = item.weight || 0;
                const volW =
                  item.length && item.width && item.height
                    ? Math.round(((item.length * item.width * item.height) / 5000) * 10) / 10
                    : 0;
                const effW = Math.max(actualW, volW) * (item.quantity || 1);
                const isMotorbike = item.type === 'Xe máy';
                const isBicycle = item.type === 'Xe đạp';
                let itemFee = 0;
                if (isMotorbike) {
                  itemFee = 250000 * (item.quantity || 1);
                } else if (isBicycle) {
                  itemFee = 100000 * (item.quantity || 1);
                } else {
                  if (effW <= 20) itemFee = 0;
                  else if (effW <= 40) itemFee = 30000;
                  else itemFee = 30000;
                }

                return (
                  <div
                    key={item.id || idx}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 text-xs flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <strong className="text-slate-900 font-bold text-[13px]">
                          {isMotorbike
                            ? `Xe máy: ${item.motorbikeType || 'Xe số'}`
                            : isBicycle
                              ? `Xe đạp: ${item.bicycleType || 'Xe đạp thường'}`
                              : `Kiện ${idx + 1}: ${item.type || 'Vali'}`}
                        </strong>
                        {item.category === 'fragile' && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-900 text-white">
                            Dễ vỡ
                          </span>
                        )}
                        {item.category === 'valuable' && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-900 text-white">
                            Giá trị cao
                          </span>
                        )}
                      </div>

                      {isMotorbike ? (
                        <div className="mt-1 text-slate-600 flex items-center gap-2 flex-wrap text-[11px]">
                          <span>Số lượng: {item.quantity || 1} xe</span>
                          {item.licensePlate && (
                            <>
                              <span>•</span>
                              <span className="bg-slate-200 text-slate-800 font-bold px-1.5 py-0.2 rounded text-[10px]">
                                Biển số: {item.licensePlate}
                              </span>
                            </>
                          )}
                        </div>
                      ) : isBicycle ? (
                        <div className="mt-1 text-slate-600 flex items-center gap-2 flex-wrap text-[11px]">
                          <span>Số lượng: {item.quantity || 1} xe</span>
                          <span className="text-slate-300">•</span>
                          <span>Gửi hầm xe</span>
                        </div>
                      ) : (
                        <div className="mt-1 text-slate-600 flex items-center gap-2 flex-wrap text-[11px]">
                          <span>Số lượng: {item.quantity || 1}</span>
                          <span>•</span>
                          <span>Khối lượng: {item.weight} kg</span>
                          {item.length && item.width && item.height && (
                            <>
                              <span>•</span>
                              <span>{item.length}×{item.width}×{item.height}cm</span>
                            </>
                          )}
                        </div>
                      )}

                      {volW > actualW && (
                        <p className="mt-1 text-[10px] text-accent font-semibold bg-accent/10 px-1.5 py-0.5 rounded inline-block">
                          Tính cước: {volW}kg quy đổi
                        </p>
                      )}

                      {item.note && (
                        <p className="mt-1 text-[11px] text-slate-500 italic">
                          "{item.note}"
                        </p>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-extrabold text-red-600">
                        {itemFee === 0 ? (
                          <span className="text-emerald-600 font-bold">Miễn phí</span>
                        ) : (
                          `+${itemFee.toLocaleString('vi-VN')}đ`
                        )}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between shrink-0">
              <div>
                <span className="text-[11px] text-slate-500 font-medium block">
                  Tổng phụ phí hành lý
                </span>
                <strong className={draft.luggage.fee > 0 ? 'text-red-600 font-extrabold text-sm' : 'text-emerald-600 font-bold text-sm'}>
                  {draft.luggage.fee > 0 ? `+${draft.luggage.fee.toLocaleString('vi-VN')}đ` : 'Miễn phí'}
                </strong>
              </div>
              <button
                type="button"
                onClick={() => setShowCargoDetailModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PaymentPage() {
  return (
    <div className="min-h-screen">
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center bg-slate-50">
            Tổng thanh toán...
          </div>
        }
      >
        <PaymentContent />
      </Suspense>
    </div>
  );
}
