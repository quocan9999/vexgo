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
  Phone,
  Printer,
  RotateCcw,
  ShieldCheck,
  Ticket,
  User,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/format';
import { AlertModal } from '@/components/ui/alert-modal';
import { ticketsApi, type TicketItem } from '@/features/account/services/tickets.api';
import { checkTicketCancelEligibility } from '@/features/tickets/services/cancel-eligibility';
import { saveCancelSession } from '@/features/tickets/services/cancel-session';

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
  if (!method) return 'Chưa cập nhật';
  const upper = method.toUpperCase();
  switch (upper) {
    case 'MOMO':
      return 'Ví MoMo';
    case 'VNPAY':
      return 'Cổng VNPay';
    case 'ZALOPAY':
      return 'Ví ZaloPay';
    case 'TIEN_MAT':
      return 'Tiền mặt';
    case 'CHUYEN_KHOAN':
      return 'Chuyển khoản ngân hàng';
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
    const eligibility = checkTicketCancelEligibility(ticket);
    if (!eligibility.eligible) {
      setIneligibleModal({
        isOpen: true,
        title: eligibility.title,
        message: eligibility.message,
        variant: 'warning',
      });
      return;
    }
    saveCancelSession({
      ticketCode: ticket.ticketCode,
      phoneNumber: ticket.passengerPhone || phone,
      ticket,
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
      setTicket(response.data);
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
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 sm:p-8">
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

          <div className="pt-2 flex justify-center">
            <button
              type="submit"
              disabled={isLoading}
              className="px-14 py-3 bg-[#f05123] hover:bg-[#ea4a18] active:scale-[0.99] text-white font-bold text-base rounded-full transition-all shadow-md shadow-[#f05123]/25 disabled:opacity-60 flex items-center justify-center gap-2.5 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Đang tra cứu...</span>
                </>
              ) : (
                <span>Tra cứu vé</span>
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

          {/* Details Grid (4 Cards) */}
          <div className="px-6 sm:px-8 py-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            
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
              </div>
            </div>
          </div>

          {/* Cancellation Notice if ticket is cancelled */}
          {isCancelled && (
            <div className="mx-6 sm:mx-8 mb-5 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm font-medium flex items-center gap-3">
              <XCircle className="w-5 h-5 text-rose-500 shrink-0" />
              <span>
                Vé này đã được hủy. Mọi thắc mắc về tiền hoàn hoặc đổi vé, vui lòng liên hệ tổng đài hỗ trợ của nhà xe.
              </span>
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
                href={`/invoice/${encodeURIComponent(ticket.ticketCode)}`}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#0060c4] hover:bg-blue-700 active:scale-[0.99] text-white font-bold text-sm transition-all shadow-md shadow-[#0060c4]/25 cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                Xem vé điện tử
              </Link>
            </div>
          </div>
        </div>
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
    </div>
  );
}

export const TicketSearchPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#F4F7F9] flex flex-col items-center pt-12 px-4 pb-24 font-sans">
      <div className="text-center mb-8">
        <h1 className="text-2xl md:text-3xl font-black text-[#0060c4] tracking-tight uppercase">
          TRA CỨU THÔNG TIN ĐẶT VÉ
        </h1>
      </div>

      <Suspense fallback={<div className="text-slate-400 text-sm">Đang tải...</div>}>
        <TicketSearchForm />
      </Suspense>
    </div>
  );
};
