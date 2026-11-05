/* eslint-disable */
'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowRight,
  Bus,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  FileText,
  Loader2,
  MapPin,
  Package,
  Phone,
  Printer,
  QrCode,
  RotateCcw,
  Search,
  ShieldCheck,
  Star,
  Ticket,
  User,
  X,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/format';
import { AlertModal } from '@/components/ui/alert-modal';
import { ticketsApi, type TicketItem } from '@/features/account/services/tickets.api';
import { checkTicketCancelEligibility } from '@/features/tickets/services/cancel-eligibility';
import { saveCancelSession } from '@/features/tickets/services/cancel-session';
import { ReviewDialog } from '@/features/tickets/components/review-dialog';
import { useAuthSession } from '@/features/auth/auth-session';
import { QRCodeSVG } from 'qrcode.react';
import { PAYMENT_DRAFT_STORAGE_PREFIX } from '@/features/booking/services/payment-draft';

const VIETNAM_PHONE_REGEX = /^(?:\+84|0)(?:3[2-9]|5[689]|7[06-9]|8[1-9]|9\d)\d{7}$/;

function formatTimeAndDate(isoString: string | null | undefined): { time: string; date: string } {
  if (!isoString) return { time: '--:--', date: 'Chưa cập nhật' };
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return { time: '--:--', date: isoString };
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return {
      time: `${hours}:${minutes}`,
      date: `${day}/${month}/${year}`,
    };
  } catch {
    return { time: '--:--', date: isoString };
  }
}

function getTripDuration(depIso: string | null | undefined, arrIso: string | null | undefined): string {
  if (!depIso || !arrIso) return 'Hành trình chuyến';
  try {
    const dep = new Date(depIso);
    const arr = new Date(arrIso);
    const diffMs = arr.getTime() - dep.getTime();
    if (diffMs <= 0) return 'Hành trình chuyến';
    const totalMinutes = Math.round(diffMs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0 && minutes > 0) return `~${hours}h${minutes}p`;
    if (hours > 0) return `~${hours} giờ`;
    return `~${minutes} phút`;
  } catch {
    return 'Hành trình chuyến';
  }
}

function mapPaymentMethod(method: string | null): string {
  if (!method) return 'Chuyển khoản VietQR';
  const upper = method.toUpperCase();
  switch (upper) {
    case 'SEPAY':
    case 'CHUYEN_KHOAN':
    case 'VIETQR':
      return 'Chuyển khoản VietQR';
    case 'TAI_BEN':
    case 'TIEN_MAT':
      return 'Tiền mặt tại bến';
    case 'MOMO':
      return 'Ví MoMo';
    case 'VNPAY':
      return 'Cổng VNPay';
    case 'ZALOPAY':
      return 'Ví ZaloPay';
    default:
      return method;
  }
}

function mapPaymentStatus(status: string | null): { label: string; isPaid: boolean } {
  if (!status) return { label: 'Chưa thanh toán', isPaid: false };
  const upper = status.toUpperCase();
  if (['DA_THANH_TOAN', 'THANH_CONG', 'PAID'].includes(upper)) {
    return { label: 'Đã thanh toán', isPaid: true };
  }
  if (['CHO_THANH_TOAN', 'PENDING'].includes(upper)) {
    return { label: 'Chờ thanh toán', isPaid: false };
  }
  if (['THAT_BAI', 'FAILED'].includes(upper)) {
    return { label: 'Thất bại', isPaid: false };
  }
  if (['HOAN_TIEN', 'REFUNDED'].includes(upper)) {
    return { label: 'Đã hoàn tiền', isPaid: false };
  }
  return { label: status, isPaid: false };
}

function formatPhoneDisplay(phoneStr: string | null): string {
  if (!phoneStr) return 'Chưa cập nhật';
  const clean = phoneStr.trim();
  if (clean.startsWith('+84') && clean.length === 12) {
    return `0${clean.slice(3, 5)} ${clean.slice(5, 8)} ${clean.slice(8)}`;
  }
  if (clean.startsWith('0') && clean.length === 10) {
    return `${clean.slice(0, 4)} ${clean.slice(4, 7)} ${clean.slice(7)}`;
  }
  return clean;
}

function TicketSearchForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  let authContext: ReturnType<typeof useAuthSession> | null = null;
  try {
    authContext = useAuthSession();
  } catch {
    authContext = null;
  }
  const isAuthenticated = authContext?.isAuthenticated ?? false;

  const [phone, setPhone] = useState(
    searchParams.get('phone') || searchParams.get('phoneNumber') || '',
  );
  const [ticketCode, setTicketCode] = useState(
    searchParams.get('code') || searchParams.get('ticketCode') || '',
  );

  const [isLoading, setIsLoading] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [ticketCodeError, setTicketCodeError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [ticket, setTicket] = useState<TicketItem | null>(null);
  const [copied, setCopied] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showLookupGuide, setShowLookupGuide] = useState(false);
  const [ineligibleModal, setIneligibleModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant: 'warning' | 'error' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    variant: 'warning',
  });

  const handleCancelClick = () => {
    if (!ticket) return;
    const allTickets =
      ticket.bookingTickets && ticket.bookingTickets.length > 0
        ? ticket.bookingTickets
        : [ticket];
    const cancellable = allTickets.filter(
      (t) =>
        (t.status || '').toUpperCase() !== 'HUY' &&
        (t.status || '').toUpperCase() !== 'CANCELLED',
    );
    const repTicket = cancellable.length > 0 ? cancellable[0] : ticket;
    const eligibility = checkTicketCancelEligibility(repTicket);
    if (!eligibility.eligible) {
      setIneligibleModal({
        isOpen: true,
        title: eligibility.title,
        message:
          cancellable.length === 0 &&
          (eligibility.reason === 'ALREADY_CANCELLED' || !eligibility.reason)
            ? 'Tất cả các vé trong đơn đặt vé này đã hoàn tất thủ tục hủy trước đó.'
            : eligibility.message,
        variant: 'warning',
      });
      return;
    }
    saveCancelSession({
      ticketCode: repTicket.ticketCode,
      phoneNumber: repTicket.passengerPhone || phone,
      ticket: {
        ...repTicket,
        bookingTickets: allTickets,
      },
    });
    router.push('/cancel-ticket');
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const performLookup = async (inputCode: string, inputPhone: string) => {
    const trimmedCode = inputCode.trim().toUpperCase();
    const trimmedPhone = inputPhone.trim().replace(/[\s.-]/g, '');

    let hasError = false;

    if (!trimmedPhone) {
      setPhoneError('Vui lòng nhập số điện thoại.');
      hasError = true;
    } else if (!VIETNAM_PHONE_REGEX.test(trimmedPhone)) {
      setPhoneError('Số điện thoại không hợp lệ.');
      hasError = true;
    } else {
      setPhoneError(null);
    }

    if (!trimmedCode) {
      setTicketCodeError('Vui lòng nhập mã vé.');
      hasError = true;
    } else {
      setTicketCodeError(null);
    }

    if (hasError) return;

    setIsLoading(true);
    setGeneralError(null);

    try {
      const response = await ticketsApi.lookupTicket(trimmedCode, trimmedPhone);
      const allTickets =
        response.data.bookingTickets && response.data.bookingTickets.length > 0
          ? response.data.bookingTickets
          : [response.data];
      const cancellable = allTickets.filter(
        (t) =>
          (t.status || '').toUpperCase() !== 'HUY' &&
          (t.status || '').toUpperCase() !== 'CANCELLED',
      );
      const isDirectTicketCode = allTickets.some((t) => t.ticketCode === trimmedCode);
      const selected =
        (isDirectTicketCode ? response.data : null) ||
        (cancellable.length > 0 ? cancellable[0] : response.data);

      setTicket({
        ...selected,
        bookingTickets: allTickets,
      });
    } catch (err: any) {
      setTicket(null);
      if (err.status === 404) {
        setGeneralError(
          'Không tìm thấy vé hoặc thông tin số điện thoại không khớp. Vui lòng kiểm tra lại.',
        );
      } else if (err.status === 429) {
        setGeneralError(
          'Bạn đã tra cứu quá nhiều lần. Vui lòng thử lại sau giây lát.',
        );
      } else {
        setGeneralError(
          err.message || 'Đã xảy ra lỗi khi tra cứu vé. Vui lòng thử lại.',
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performLookup(ticketCode, phone);
  };

  const handleReset = () => {
    setTicket(null);
    setGeneralError(null);
    setPhoneError(null);
    setTicketCodeError(null);
    setTicketCode('');
    setPhone('');
  };

  useEffect(() => {
    const initialCode = searchParams.get('code') || searchParams.get('ticketCode');
    const initialPhone = searchParams.get('phone') || searchParams.get('phoneNumber');
    if (initialCode && initialPhone) {
      performLookup(initialCode, initialPhone);
    }
  }, [searchParams]);

  const isCancelled = (ticket?.status || '').toUpperCase() === 'HUY' || (ticket?.status || '').toUpperCase() === 'CANCELLED';
  const departureInfo = formatTimeAndDate(ticket?.departureTime || null);
  const arrivalInfo = formatTimeAndDate(ticket?.arrivalTime || null);
  const payment = mapPaymentStatus(ticket?.paymentStatus || null);

  return (
    <div className="w-full max-w-2xl space-y-8">
      {/* Search Input Box */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xl p-6 sm:p-8">
        <div className="flex items-center gap-3.5 pb-5 mb-6 border-b border-slate-100">
          <div className="w-11 h-11 rounded-2xl bg-blue-50 text-[#0060c4] flex items-center justify-center shrink-0 border border-blue-100/60 shadow-xs">
            <Search className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900">
              Tra cứu vé &amp; Hành trình đặt chỗ
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Nhập số điện thoại và mã vé để xem chi tiết thông tin chuyến xe
            </p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Số điện thoại <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Phone
                className={`w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${
                  phoneError ? 'text-rose-500' : 'text-slate-400'
                }`}
              />
              <input
                type="text"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (phoneError) setPhoneError(null);
                  if (generalError) setGeneralError(null);
                }}
                placeholder="Vui lòng nhập số điện thoại"
                disabled={isLoading}
                className={`w-full h-12 pl-12 pr-4 rounded-xl border ${
                  phoneError
                    ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/15'
                    : 'border-slate-300 focus:border-[#f05123] focus:ring-2 focus:ring-[#f05123]/15'
                } transition-all text-slate-800 font-medium placeholder:text-slate-400 disabled:bg-slate-50`}
              />
            </div>
            {phoneError && (
              <p className="mt-1.5 text-xs font-medium text-rose-600 flex items-center gap-1.5 animate-in fade-in duration-150">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{phoneError}</span>
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Mã vé xe <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Ticket
                className={`w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${
                  ticketCodeError ? 'text-rose-500' : 'text-slate-400'
                }`}
              />
              <input
                type="text"
                value={ticketCode}
                onChange={(e) => {
                  setTicketCode(e.target.value.toUpperCase());
                  if (ticketCodeError) setTicketCodeError(null);
                  if (generalError) setGeneralError(null);
                }}
                placeholder="Vui lòng nhập mã vé"
                disabled={isLoading}
                className={`w-full h-12 pl-12 pr-4 rounded-xl border ${
                  ticketCodeError
                    ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/15'
                    : 'border-slate-300 focus:border-[#f05123] focus:ring-2 focus:ring-[#f05123]/15'
                } transition-all uppercase text-slate-800 font-mono font-medium placeholder:font-sans placeholder:normal-case placeholder:text-slate-400 disabled:bg-slate-50`}
              />
            </div>
            {ticketCodeError && (
              <p className="mt-1.5 text-xs font-medium text-rose-600 flex items-center gap-1.5 animate-in fade-in duration-150">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{ticketCodeError}</span>
              </p>
            )}
          </div>

          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setShowLookupGuide(true)}
              className="text-sm font-bold text-[#f05123] hover:text-[#ea4a18] hover:underline transition-colors cursor-pointer text-left"
            >
              Hướng dẫn tra cứu vé
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full sm:w-auto px-10 h-12 bg-[#f05123] hover:bg-[#ea4a18] active:scale-[0.99] text-white font-bold text-sm sm:text-base rounded-full transition-all shadow-md shadow-[#f05123]/25 disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Đang tra cứu...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 shrink-0" />
                  <span>Tra cứu vé</span>
                </>
              )}
            </button>
          </div>

          {/* Thông báo lỗi chung (404, 429...) đặt ở DƯỚI nút Tra cứu vé */}
          {generalError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center justify-center gap-2.5 animate-in fade-in duration-200 text-center">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <p className="font-medium leading-relaxed">{generalError}</p>
            </div>
          )}
        </form>
      </div>

      {/* Ticket Result - Premium Boarding Pass Design */}
      {ticket && (
        <div className="relative rounded-3xl border border-slate-200 bg-white shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
          
          {/* Card Top Brand & Status Strip */}
          <div className="px-6 sm:px-8 py-5 bg-gradient-to-r from-blue-50/70 via-white to-slate-50 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <h3 className="font-black text-slate-900 text-base sm:text-lg">
                {ticket.busCompanyName
                  ? ticket.busCompanyName.startsWith('Nhà xe')
                    ? ticket.busCompanyName
                    : `Nhà xe ${ticket.busCompanyName}`
                  : 'Nhà xe Phương Trang'}
              </h3>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-[#0060c4]">
                {ticket.vehicleType || 'Tiêu chuẩn'}
              </span>
            </div>

            {/* Status Pill */}
            <div>
              {isCancelled ? (
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black bg-rose-50 text-rose-600 border border-rose-200">
                  <XCircle className="w-4 h-4" /> Vé đã hủy
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs">
                  <CheckCircle2 className="w-4 h-4" /> Vé hợp lệ / Đã đặt
                </span>
              )}
            </div>
          </div>

          {/* Ticket Code Copy Bar */}
          <div className="px-6 sm:px-8 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-4 text-xs font-bold text-slate-600">
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="text-slate-400 uppercase tracking-wider shrink-0">Mã vé:</span>
              <span className="font-mono font-black text-slate-900 text-sm tracking-wide truncate">
                {ticket.ticketCode}
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleCopyCode(ticket.ticketCode)}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 active:scale-95 text-slate-700 font-semibold transition-all shrink-0 cursor-pointer shadow-xs"
              title="Sao chép mã vé"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700 font-bold">Đã chép</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>Sao chép</span>
                </>
              )}
            </button>
          </div>

          {/* Departure & Arrival Hero Section */}
          <div className="px-6 sm:px-8 py-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 bg-slate-50/80 rounded-2xl p-5 border border-slate-100">
              
              {/* Departure Info */}
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Khởi hành
                </span>
                <p className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  {departureInfo.time}
                </p>
                <p className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#f05123]" />
                  {departureInfo.date}
                </p>
                <p className="text-base font-extrabold text-[#0060c4] pt-1">
                  {ticket.origin || 'Nơi khởi hành'}
                </p>
              </div>

              {/* Center Route Line */}
              <div className="hidden sm:flex flex-col items-center flex-1 max-w-[160px] px-2">
                <div className="w-full flex items-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-100 shrink-0"></div>
                  <div className="h-0.5 flex-1 bg-slate-300 border-t border-dashed border-slate-300"></div>
                  <div className="p-1 rounded-full bg-white shadow-xs border border-slate-200 text-[#0060c4]">
                    <Bus className="w-4 h-4" />
                  </div>
                  <div className="h-0.5 flex-1 bg-slate-300 border-t border-dashed border-slate-300"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-[#f05123] ring-4 ring-orange-100 shrink-0"></div>
                </div>
                <span className="text-[11px] font-semibold text-slate-400 mt-2">
                  {getTripDuration(ticket.departureTime, ticket.arrivalTime)}
                </span>
              </div>

              {/* Arrival Info */}
              <div className="space-y-1 sm:text-right">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Đến nơi (dự kiến)
                </span>
                <p className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  {arrivalInfo.time}
                </p>
                <p className="text-xs font-bold text-slate-500 flex items-center sm:justify-end gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#f05123]" />
                  {arrivalInfo.date}
                </p>
                <p className="text-base font-extrabold text-[#0060c4] pt-1">
                  {ticket.destination || 'Nơi đến'}
                </p>
              </div>
            </div>
          </div>

          {/* Realistic Ticket Cutouts & Perforation Line */}
          <div className="relative py-2">
            <div className="absolute -left-3.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-[#F4F7F9] border-r border-slate-200"></div>
            <div className="border-b-2 border-dashed border-slate-200 mx-5"></div>
            <div className="absolute -right-3.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-[#F4F7F9] border-l border-slate-200"></div>
          </div>

          {/* Details Grid + Boarding QR Code */}
          <div className="px-6 sm:px-8 py-5 flex flex-col lg:flex-row gap-5">
            {/* Left: Details Grid (4 Cards) */}
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              {/* Box 1: Seat Info */}
              <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-100/90">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Chỗ ngồi / Vị trí
                </span>
                <p className="text-xl font-black text-[#0060c4]">
                  Ghế {ticket.seatNumber || 'N/A'}
                </p>
                <p className="text-xs font-medium text-slate-600 mt-1">
                  Vị trí: <strong className="font-semibold text-slate-800">{ticket.seatPosition || 'Ghế tiêu chuẩn'}</strong>
                </p>
              </div>

              {/* Box 2: Price */}
              <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-100/90">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Giá vé
                </span>
                <p className="text-xl font-black text-[#f05123]">
                  {formatCurrency(ticket.price)}
                </p>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  Đã bao gồm VAT & bảo hiểm hành khách
                </p>
              </div>

              {/* Box 3: Pickup & Dropoff */}
              <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-100/90 space-y-2">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                    Điểm đón
                  </span>
                  <p className="font-bold text-slate-800 flex items-start gap-1.5 leading-snug">
                    <MapPin className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{ticket.pickup || ticket.origin || 'Theo thông báo của nhà xe'}</span>
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-200/60">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                    Điểm trả
                  </span>
                  <p className="font-bold text-slate-800 flex items-start gap-1.5 leading-snug">
                    <MapPin className="w-4 h-4 text-[#f05123] shrink-0 mt-0.5" />
                    <span>{ticket.dropoff || ticket.destination || 'Theo lộ trình'}</span>
                  </p>
                </div>
              </div>

              {/* Box 4: Passenger & Payment */}
              <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-100/90 space-y-2">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                    Hành khách
                  </span>
                  <p className="font-bold text-slate-800 flex items-center gap-1.5">
                    <User className="w-4 h-4 text-slate-400" />
                    <span>{ticket.passengerName || 'Chưa cập nhật'}</span>
                  </p>
                  <p className="text-xs text-slate-500 font-medium pl-5.5 mt-0.5">
                    SĐT: {formatPhoneDisplay(ticket.passengerPhone || phone)}
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-200/60">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                    Thanh toán
                  </span>
                  <div className="flex items-center gap-1.5 font-bold">
                    <CreditCard className="w-4 h-4 text-slate-400" />
                    <span className={payment.isPaid ? 'text-emerald-700' : 'text-amber-700'}>
                      {payment.label}
                    </span>
                    <span className="text-slate-400 font-normal">({mapPaymentMethod(ticket.paymentMethod)})</span>
                  </div>
                  {ticket.bookingCode && (
                    <p className="text-[11px] text-slate-400 font-medium pl-5.5 mt-0.5 font-mono">
                      Đơn: {ticket.bookingCode}
                    </p>
                  )}
                  {ticket.promotionCode && (
                    <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50/70 p-2.5 text-xs">
                      <div className="flex flex-wrap justify-between gap-2">
                        <span className="text-slate-600">Mã khuyến mãi của đơn</span>
                        <strong className="font-mono text-emerald-800">
                          {ticket.promotionCode}
                        </strong>
                      </div>
                      {typeof ticket.discountAmount === 'number' && (
                        <div className="mt-1 flex flex-wrap justify-between gap-2">
                          <span className="text-slate-600">Giảm giá của toàn đơn</span>
                          <strong className="text-emerald-700">
                            −{formatCurrency(ticket.discountAmount)}
                          </strong>
                        </div>
                      )}
                      <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                        Mức giảm được ghi một lần ở cấp đơn; không lặp lại mức giảm trên từng vé.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Boarding QR Code Stub */}
            <div className="lg:w-60 shrink-0 p-5 rounded-2xl bg-gradient-to-b from-slate-50 to-blue-50/40 border border-slate-200/90 flex flex-col items-center justify-center text-center">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-100/80 text-[#0060c4] text-[11px] font-extrabold uppercase tracking-wider mb-3">
                <QrCode className="w-3.5 h-3.5" />
                Mã QR lên xe
              </div>
              <div className="relative p-3 bg-white rounded-2xl border border-slate-200 shadow-xs">
                <div className={isCancelled ? 'opacity-20 grayscale' : ''}>
                  <QRCodeSVG
                    value={`https://vexgo.vn/tra-cuu-ve?code=${encodeURIComponent(ticket.ticketCode)}`}
                    size={140}
                    level="M"
                    role="img"
                    aria-label={`Mã QR vé ${ticket.ticketCode}`}
                    className="w-36 h-36"
                  />
                </div>
                {isCancelled && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="px-3 py-1 rounded-md bg-rose-600 text-white text-xs font-black uppercase tracking-wider rotate-[-12deg] shadow-lg">
                      ĐÃ HỦY
                    </span>
                  </div>
                )}
              </div>
              <p className="text-xs font-black text-slate-900 mt-3 font-mono">
                Ghế {ticket.seatNumber || 'N/A'} • {ticket.ticketCode}
              </p>
              <span className="text-[11px] text-slate-500 font-medium leading-relaxed mt-1 block">
                {isCancelled
                  ? 'Vé đã hủy, mã QR không còn hiệu lực lên xe'
                  : 'Xuất trình mã QR này cho nhân viên nhà xe quét khi lên xe'}
              </span>
            </div>
          </div>

          {/* Thời gian có mặt trước giờ khởi hành & Hành lý gửi kèm */}
          {(() => {
            const cargoItems = ticket.cargoItems || [];
            const hasMotorbike = cargoItems.some((item) =>
              item.name?.toLowerCase().includes('xe máy'),
            );
            const hasBicycle = cargoItems.some((item) =>
              item.name?.toLowerCase().includes('xe đạp'),
            );
            const snapshotMinutes =
              typeof ticket.diemDonSnapshot?.phutCoMatTruoc === 'number' &&
              ticket.diemDonSnapshot.phutCoMatTruoc > 0
                ? ticket.diemDonSnapshot.phutCoMatTruoc
                : 20;
            const checkInText = hasMotorbike
              ? '90 – 120 phút (do có gửi xe máy kèm vé)'
              : hasBicycle
                ? '20 – 30 phút (do có gửi xe đạp kèm vé)'
                : `ít nhất ${snapshotMinutes} phút`;

            return (
              <div className="mx-6 sm:mx-8 mb-5 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {/* Thời gian có mặt */}
                <div className="p-3.5 rounded-xl bg-amber-50/90 border border-amber-200/80 flex items-start gap-2.5 text-amber-900">
                  <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5 leading-relaxed">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 block">
                      Thời gian có mặt trước giờ khởi hành
                    </span>
                    <p className="text-slate-800">
                      Quý khách vui lòng có mặt tại điểm đón trước giờ khởi hành{' '}
                      <strong className="text-amber-900 underline">{checkInText}</strong> để làm thủ tục
                      lên xe và xếp hành lý.
                    </p>
                  </div>
                </div>

                {/* Hành lý gửi kèm */}
                <div className="p-3.5 rounded-xl bg-slate-50/90 border border-slate-200/80 space-y-2">
                  <div className="flex items-center justify-between gap-2 pb-1 border-b border-slate-200/60">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-[#0060c4]" />
                      Hành lý theo vé
                    </span>
                    <span className="text-[10.5px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/70">
                      {cargoItems.length > 0
                        ? `${cargoItems.reduce((s, i) => s + (i.quantity || 1), 0)} kiện ký gửi`
                        : 'Không có'}
                    </span>
                  </div>

                  <div className="space-y-1 text-slate-700">
                    {cargoItems.length > 0 ? (
                      <div className="space-y-1">
                        <div className="font-semibold text-slate-900">
                          Kiện hành lý ký gửi hầm xe:
                        </div>
                        <ul className="space-y-1 pl-4 list-disc text-slate-700">
                          {cargoItems.map((item, idx) => (
                            <li key={idx}>
                              <strong className="text-slate-900">
                                {item.quantity}x {item.name}
                              </strong>{' '}
                              ({item.weight}kg)
                              {item.note ? (
                                <span className="text-slate-500"> — {item.note}</span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                        {typeof ticket.cargoFee === 'number' && ticket.cargoFee > 0 && (
                          <p className="text-[11px] text-slate-500 pt-0.5">
                            Phụ phí hành lý ký gửi:{' '}
                            <strong className="text-slate-800">{formatCurrency(ticket.cargoFee)}</strong>
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="text-slate-500">
                        Không có hành lý ký gửi kèm vé.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Cancellation Notice if ticket is cancelled */}
          {isCancelled && (
            <div className="mx-6 sm:mx-8 mb-5 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm font-medium flex items-center gap-3">
              <XCircle className="w-5 h-5 text-rose-500 shrink-0" />
              <span>
                Vé này đã được hủy. Mọi thắc mắc về tiền hoàn hoặc đổi vé, vui lòng liên hệ tổng đài hỗ trợ của nhà xe.
              </span>
            </div>
          )}

          {/* Review Section: 4 states for a paid, non-cancelled ticket */}
          {!isCancelled && payment.isPaid && ticket.departureTime && (() => {
            const departureMs = new Date(ticket.departureTime).getTime();
            const nowMs = Date.now();
            const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
            const isNotDeparted = departureMs > nowMs;
            const isPastSevenDays = nowMs - departureMs > SEVEN_DAYS_MS;
            const isWithinSevenDays = !isNotDeparted && !isPastSevenDays;

            if (isNotDeparted) {
              return (
                <div className="mx-6 sm:mx-8 mb-5 p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-3 text-xs text-slate-600">
                  <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>
                    Chuyến xe chưa khởi hành. Bạn có thể gửi đánh giá dịch vụ sau khi chuyến đi bắt đầu.
                  </span>
                </div>
              );
            }

            if (isPastSevenDays) {
              return (
                <div className="mx-6 sm:mx-8 mb-5 p-3.5 rounded-xl bg-slate-100/80 border border-slate-200 flex items-center justify-between gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                    Chuyến xe đã kết thúc quá 7 ngày, đã hết thời hạn gửi đánh giá.
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-slate-200 text-[11px] font-semibold text-slate-600">
                    Hết hạn đánh giá
                  </span>
                </div>
              );
            }

            if (isWithinSevenDays) {
              return (
                <div className="mx-6 sm:mx-8 mb-5 p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                      <Star className="w-5 h-5 fill-amber-500 text-amber-500" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">
                        Chuyến đi đã hoàn tất! Hãy chia sẻ trải nghiệm của bạn
                      </h4>
                      <p className="text-xs text-slate-600">
                        {isAuthenticated
                          ? `Đánh giá chất lượng phục vụ của ${ticket.busCompanyName || 'nhà xe'} giúp hành khách khác có thêm thông tin tham khảo.`
                          : `Đăng nhập số điện thoại đặt vé (${ticket.passengerPhone || phone}) để gửi đánh giá chuyến đi.`}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowReviewModal(true)}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold text-xs transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <Star className="w-3.5 h-3.5 fill-white text-white" />
                    {isAuthenticated ? 'Đánh giá chuyến đi' : 'Đăng nhập để đánh giá'}
                  </button>
                </div>
              );
            }

            return null;
          })()}
          {/* Danh sách tất cả các vé thuộc cùng đơn đặt chỗ */}
          {ticket.bookingTickets && ticket.bookingTickets.length > 1 && (
            <div className="mx-6 sm:mx-8 mb-5 p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Ticket className="w-4 h-4 text-[#0060c4]" />
                  Tất cả vé trong đơn ({ticket.bookingTickets.length} vé)
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  Đang xem: Ghế {ticket.seatNumber}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {ticket.bookingTickets.map((sibling) => {
                  const isCurrent = sibling.ticketCode === ticket.ticketCode;
                  const isSiblingCancelled =
                    (sibling.status || '').toUpperCase() === 'HUY' ||
                    (sibling.status || '').toUpperCase() === 'CANCELLED';
                  return (
                    <div
                      key={sibling.ticketCode}
                      onClick={() =>
                        setTicket({
                          ...sibling,
                          bookingTickets: ticket.bookingTickets,
                        })
                      }
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${
                        isCurrent
                          ? 'bg-blue-50/80 border-[#0060c4] shadow-xs'
                          : isSiblingCancelled
                            ? 'bg-white/60 border-rose-200 hover:bg-rose-50/40 text-slate-500'
                            : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`text-sm font-black ${
                            isSiblingCancelled
                              ? 'line-through text-slate-400'
                              : isCurrent
                                ? 'text-[#0060c4]'
                                : 'text-slate-800'
                          }`}
                        >
                          Ghế {sibling.seatNumber}
                        </span>
                        {isSiblingCancelled ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
                            <XCircle className="w-2.5 h-2.5" /> Đã hủy
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-2.5 h-2.5" /> Hợp lệ
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                        <span className="truncate">{sibling.ticketCode}</span>
                        {isCurrent && (
                          <span className="text-[10px] font-sans font-bold text-[#0060c4] shrink-0">
                            (Đang chọn)
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Bottom Action Footer */}
          <div className="px-6 sm:px-8 py-5 bg-slate-50/90 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-sm transition-all shadow-xs cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Tra cứu vé khác
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => window.print()}
                className="hidden sm:inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-sm transition-all shadow-xs cursor-pointer"
                title="In thông tin vé"
              >
                <Printer className="w-4 h-4" />
                In vé
              </button>

              <button
                type="button"
                onClick={handleCancelClick}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-rose-200 text-rose-600 bg-white hover:bg-rose-50 font-bold text-sm transition-all cursor-pointer shadow-xs"
              >
                <XCircle className="w-4 h-4" />
                Hủy vé
              </button>

              <Link
                href={`/invoice/${ticket.bookingId ? ticket.bookingId : encodeURIComponent(ticket.ticketCode)}`}
                onClick={() => {
                  try {
                    if (typeof sessionStorage !== 'undefined' && ticket.bookingId && ticket.bookingCode) {
                      sessionStorage.setItem(
                        `${PAYMENT_DRAFT_STORAGE_PREFIX}lookup-${ticket.bookingId}`,
                        JSON.stringify({
                          bookingId: ticket.bookingId,
                          bookingCode: ticket.bookingCode,
                          passenger: {
                            phoneNumber: ticket.passengerPhone || phone.trim(),
                          },
                        }),
                      );
                    }
                  } catch {
                    // Ignore storage errors
                  }
                }}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#0060c4] hover:bg-blue-700 active:scale-[0.99] text-white font-bold text-sm transition-all shadow-md shadow-[#0060c4]/25 cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                Xem vé điện tử
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Review Modal Dialog */}
      {ticket && (
        <ReviewDialog
          isOpen={showReviewModal}
          onClose={() => setShowReviewModal(false)}
          tripId={ticket.tripId ?? undefined}
          tripInfo={{
            route: ticket.route || `${ticket.origin || ''} → ${ticket.destination || ''}`,
            date: `${departureInfo.time}, ${departureInfo.date}`,
            busBrand: ticket.busCompanyName || 'Nhà xe VexGo',
          }}
        />
      )}

      {/* Ineligibility Alert Modal */}
      <AlertModal
        isOpen={ineligibleModal.isOpen}
        title={ineligibleModal.title}
        message={ineligibleModal.message}
        variant={ineligibleModal.variant}
        confirmText="Đã hiểu"
        onClose={() => setIneligibleModal((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Ticket Lookup Guide Modal */}
      {showLookupGuide && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setShowLookupGuide(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="ticket-lookup-guide-title"
        >
          <div
            className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-orange-50/70 via-white to-amber-50/50">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f05123] text-white shadow-xs">
                  <Ticket className="h-5 w-5" />
                </div>
                <div>
                  <h2
                    id="ticket-lookup-guide-title"
                    className="text-base sm:text-lg font-black text-slate-900 tracking-tight"
                  >
                    Hướng dẫn tra cứu vé trực tuyến
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    4 bước kiểm tra thông tin vé xe, hành trình và mã QR lên xe trên VexGo
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowLookupGuide(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors cursor-pointer"
                aria-label="Đóng"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto p-5 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {[
                  {
                    step: '1',
                    icon: Phone,
                    title: 'Chuẩn bị SĐT & Mã vé',
                    desc: 'Lấy Mã vé xe (trên Vé điện tử E-Ticket, Email xác nhận hoặc mục Hoạt động của tôi) và Số điện thoại đã dùng khi đặt vé.',
                    tag: 'Thông tin xác thực',
                    bg: 'bg-blue-50 text-blue-600 border-blue-200',
                  },
                  {
                    step: '2',
                    icon: Search,
                    title: 'Nhập thông tin tra cứu',
                    desc: 'Điền chính xác Số điện thoại (10 chữ số) và Mã vé xe vào biểu mẫu tra cứu, sau đó nhấn nút "Tra cứu vé".',
                    tag: 'Tra cứu tức thì',
                    bg: 'bg-emerald-50 text-emerald-600 border-emerald-200',
                  },
                  {
                    step: '3',
                    icon: Bus,
                    title: 'Kiểm tra chi tiết chuyến đi',
                    desc: 'Xem đầy đủ nhà xe, biển số xe, số ghế, giờ khởi hành, điểm đón/trả, thời gian cần có mặt tại bến và hành lý ký gửi đi kèm.',
                    tag: 'Hành trình minh bạch',
                    bg: 'bg-amber-50 text-amber-700 border-amber-200',
                  },
                  {
                    step: '4',
                    icon: QrCode,
                    title: 'Tải vé PDF & Quản lý vé',
                    desc: 'Mở trang Vé điện tử (E-Ticket) để lấy mã QR lên xe và tải vé PDF, hoặc thực hiện Hủy vé trực tuyến nếu đủ điều kiện.',
                    tag: 'Tiện ích trực tuyến',
                    bg: 'bg-rose-50 text-rose-600 border-rose-200',
                  },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.step}
                      className="rounded-xl border border-slate-200/90 bg-slate-50/60 p-4 transition-all hover:bg-white hover:border-[#f05123]/40 hover:shadow-xs flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2.5">
                          <div className="flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#f05123] text-white text-xs font-black shadow-2xs">
                              {item.step}
                            </span>
                            <h3 className="font-extrabold text-slate-900 text-sm">
                              {item.title}
                            </h3>
                          </div>
                          <div className={`p-1.5 rounded-lg ${item.bg} shrink-0`}>
                            <Icon className="h-4 w-4" />
                          </div>
                        </div>
                        <p className="text-xs leading-relaxed text-slate-600 font-medium">
                          {item.desc}
                        </p>
                      </div>
                      <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                          {item.tag}
                        </span>
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                          ✓ Trực tuyến
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-xl border border-blue-200/80 bg-blue-50/50 p-4">
                <h4 className="text-xs font-black text-[#0060c4] uppercase tracking-wide flex items-center gap-1.5 mb-2">
                  <ShieldCheck className="w-4 h-4 text-[#0060c4]" />
                  Lưu ý khi tra cứu & sử dụng vé
                </h4>
                <ul className="text-xs text-slate-700 space-y-1.5 font-medium">
                  <li className="flex items-start gap-1.5">
                    <span className="text-[#f05123] font-bold">•</span>
                    <span>
                      Nếu một đơn có <strong>nhiều ghế</strong>, bạn chỉ cần nhập mã vé của bất kỳ ghế nào trong đơn để xem toàn bộ danh sách ghế.
                    </span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-[#f05123] font-bold">•</span>
                    <span>
                      Vui lòng có mặt tại điểm đón trước giờ khởi hành theo đúng thời gian quy định ghi trên vé (mặc định tối thiểu <strong>20 phút</strong>).
                    </span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-[#f05123] font-bold">•</span>
                    <span>
                      Hỗ trợ hủy vé trực tuyến trước giờ khởi hành từ <strong>2 giờ 30 phút</strong> trở lên; sau khi hủy vui lòng liên hệ nhà xe để nhận tiền hoàn.
                    </span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                <QrCode className="w-4 h-4 text-[#f05123]" />
                <span>
                  Tổng đài CSKH 24/7: <strong className="text-slate-900">1900 6067</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowLookupGuide(false)}
                className="px-5 py-2 rounded-xl bg-[#f05123] hover:bg-[#d8441a] text-white font-extrabold text-xs transition-all shadow-xs cursor-pointer active:scale-95"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export const TicketSearchPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#F4F6F8] font-sans pb-24">
      {/* HERO BANNER SECTION */}
      <div className="bg-[#17223B] text-white pt-10 pb-20 px-4 sm:px-6 relative z-0 overflow-hidden">
        {/* Glow ambient background effects */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-2">
              Tra cứu thông tin đặt vé xe, <br className="hidden sm:inline" />
              <span className="text-[#FF7D42]">nhanh chóng – chuẩn xác</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl leading-relaxed">
              Kiểm tra chi tiết vé xe, vị trí chỗ ngồi, thời gian xuất bến và quản lý hành trình di chuyển an tâm trên mọi nẻo đường.
            </p>
          </div>

          {/* Switch Tab: Tra cứu vé xe <-> Tra cứu vận đơn */}
          <div className="inline-flex p-1 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/10 self-start md:self-auto shrink-0">
            <Link
              href="/tickets/lookup"
              className="px-5 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all bg-white text-[#17223B] shadow-sm flex items-center gap-2"
            >
              <Ticket className="w-4 h-4 text-[#0060c4]" />
              <span>Tra cứu vé xe</span>
            </Link>
            <Link
              href="/send-freight?tab=lookup"
              className="px-5 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all text-white/80 hover:text-white flex items-center gap-2"
            >
              <Package className="w-4 h-4 text-orange-400" />
              <span>Tra cứu vận đơn</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Floating Card Container */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 -mt-10 relative flex flex-col items-center">
        <Suspense fallback={<div className="text-slate-400 text-sm">Đang tải...</div>}>
          <TicketSearchForm />
        </Suspense>
      </div>
    </div>
  );
};
