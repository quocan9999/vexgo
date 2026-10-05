'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  HelpCircle,
  Loader2,
  MapPin,
  Phone,
  ShieldAlert,
  Ticket,
  User,
  X,
  XCircle,
} from 'lucide-react';
import { AlertModal } from '@/components/ui/alert-modal';
import {
  ticketsApi,
  isCancellationQuoteExpiredError,
  type TicketItem,
  type CancelTicketResult,
  type TicketCancellationQuote,
} from '@/features/account/services/tickets.api';
import {
  checkTicketCancelEligibility,
  type CancelEligibilityResult,
} from '@/features/tickets/services/cancel-eligibility';
import {
  getCancelSession,
  clearCancelSession,
} from '@/features/tickets/services/cancel-session';

function formatCurrency(amount: number | string | null | undefined): string {
  if (amount == null || amount === '') return '0 đ';
  const num = typeof amount === 'number' ? amount : Number(amount);
  if (isNaN(num)) return '0 đ';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(num);
}

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

function mapPaymentMethod(method: string | null): string {
  if (!method) return 'Phương thức ban đầu';
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

const VIETNAM_PHONE_REGEX = /^(?:\+84|0)(?:3[2-9]|5[689]|7[06-9]|8[1-9]|9\d)\d{7}$/;

function isCancellationQuote(value: unknown): value is TicketCancellationQuote {
  if (typeof value !== 'object' || value === null) return false;
  const quote = value as Partial<TicketCancellationQuote>;
  return (
    typeof quote.eligible === 'boolean' &&
    typeof quote.cancelFeeRate === 'number' &&
    typeof quote.cancelFee === 'number' &&
    typeof quote.refundAmount === 'number'
  );
}

function CancelTicketContent() {
  const [initialSession] = useState(() => getCancelSession());
  const [step, setStep] = useState<1 | 2 | 3>(() => {
    if (initialSession?.ticket) {
      const res = checkTicketCancelEligibility(initialSession.ticket, Date.now());
      return res.eligible ? 2 : 1;
    }
    return 1;
  });
  const [ticketCode, setTicketCode] = useState(() => initialSession?.ticketCode || '');
  const [phone, setPhone] = useState(() => initialSession?.phoneNumber || '');
  const [ticket, setTicket] = useState<TicketItem | null>(() => initialSession?.ticket || null);
  const [eligibility, setEligibility] = useState<CancelEligibilityResult | null>(() => {
    if (initialSession?.ticket) {
      return checkTicketCancelEligibility(initialSession.ticket, Date.now());
    }
    return null;
  });
  const [confirmedFeeRate, setConfirmedFeeRate] = useState<number | null>(() => {
    if (initialSession?.ticket) {
      const res = checkTicketCancelEligibility(initialSession.ticket, Date.now());
      return res.cancelFeeRate ?? null;
    }
    return null;
  });
  const [feeRateChangedWarning, setFeeRateChangedWarning] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(() =>
    Boolean(
      initialSession &&
        !initialSession.ticket &&
        initialSession.ticketCode &&
        initialSession.phoneNumber,
    ),
  );
  const [isCancelling, setIsCancelling] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [ticketCodeError, setTicketCodeError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelResult, setCancelResult] = useState<CancelTicketResult | null>(null);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [ineligibleModal, setIneligibleModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant: 'warning' | 'error' | 'info';
  }>(() => {
    if (initialSession?.ticket) {
      const res = checkTicketCancelEligibility(initialSession.ticket, Date.now());
      if (!res.eligible) {
        return {
          isOpen: true,
          title: res.title,
          message: res.message,
          variant: 'warning',
        };
      }
    }
    return {
      isOpen: false,
      title: '',
      message: '',
      variant: 'warning',
    };
  });

  const handleLookup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    setGeneralError(null);
    setPhoneError(null);
    setTicketCodeError(null);

    let hasError = false;
    const cleanPhone = phone.trim();
    const cleanCode = ticketCode.trim();

    if (!cleanPhone) {
      setPhoneError('Vui lòng nhập số điện thoại.');
      hasError = true;
    } else if (!VIETNAM_PHONE_REGEX.test(cleanPhone)) {
      setPhoneError('Số điện thoại không đúng định dạng (VD: 0912345678).');
      hasError = true;
    }

    if (!cleanCode) {
      setTicketCodeError('Vui lòng nhập mã vé.');
      hasError = true;
    }

    if (hasError) return;

    setIsLoading(true);
    setCancelError(null);

    try {
      const response = await ticketsApi.lookupTicket(cleanCode, cleanPhone);
      const ticketData = response.data;
      const result = checkTicketCancelEligibility(ticketData, Date.now());
      setEligibility(result);
      setConfirmedFeeRate(result.cancelFeeRate ?? null);
      setFeeRateChangedWarning(null);
      if (!result.eligible) {
        setIneligibleModal({
          isOpen: true,
          title: result.title,
          message: result.message,
          variant: 'warning',
        });
        return;
      }
      setTicket(ticketData);
      setStep(2);
    } catch (err: unknown) {
      const apiError = err as { status?: number; message?: string };
      if (apiError?.status === 404) {
        setGeneralError('Không tìm thấy thông tin vé hoặc số điện thoại xác minh không khớp.');
      } else if (apiError?.status === 429) {
        setGeneralError('Bạn đã tra cứu quá nhiều lần. Vui lòng thử lại sau giây lát.');
      } else {
        setGeneralError(apiError?.message || 'Không thể tra cứu thông tin vé. Vui lòng thử lại.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!initialSession) return;

    if (initialSession.ticket) {
      clearCancelSession();
    } else if (initialSession.ticketCode && initialSession.phoneNumber) {
      let isMounted = true;
      ticketsApi
        .lookupTicket(initialSession.ticketCode.trim(), initialSession.phoneNumber.trim())
        .then((res) => {
          if (!isMounted) return;
          const ticketData = res.data;
          const result = checkTicketCancelEligibility(ticketData, Date.now());
          setEligibility(result);
          setConfirmedFeeRate(result.cancelFeeRate ?? null);
          setFeeRateChangedWarning(null);
          if (!result.eligible) {
            setIneligibleModal({
              isOpen: true,
              title: result.title,
              message: result.message,
              variant: 'warning',
            });
            return;
          }
          setTicket(ticketData);
          setStep(2);
        })
        .catch((err: unknown) => {
          if (!isMounted) return;
          const apiError = err as { status?: number; message?: string };
          if (apiError?.status === 404) {
            setGeneralError('Không tìm thấy thông tin vé hoặc số điện thoại xác minh không khớp.');
          } else {
            setGeneralError(apiError?.message || 'Không thể tra cứu thông tin vé.');
          }
        })
        .finally(() => {
          if (isMounted) setIsLoading(false);
          clearCancelSession();
        });

      return () => {
        isMounted = false;
      };
    }
  }, [initialSession]);

  useEffect(() => {
    if (step !== 2 || !ticket) return;

    const interval = setInterval(() => {
      const fresh = checkTicketCancelEligibility(ticket, Date.now());
      setEligibility(fresh);
      if (
        confirmedFeeRate !== null &&
        fresh.cancelFeeRate !== undefined &&
        fresh.cancelFeeRate !== confirmedFeeRate
      ) {
        setFeeRateChangedWarning(
          `Mức phí hủy vé đã thay đổi từ ${Math.round((confirmedFeeRate ?? 0) * 100)}% thành ${Math.round((fresh.cancelFeeRate ?? 0) * 100)}% do thời gian đến lúc khởi hành đã bước qua mốc quy định mới. Vui lòng kiểm tra lại số tiền hoàn trước khi xác nhận.`,
        );
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [step, ticket, confirmedFeeRate]);

  const handleConfirmCancel = async () => {
    if (!ticket) return;

    const currentEligibility = checkTicketCancelEligibility(ticket, Date.now());
    setEligibility(currentEligibility);
    if (!currentEligibility.eligible) {
      setIneligibleModal({
        isOpen: true,
        title: currentEligibility.title,
        message: currentEligibility.message,
        variant: 'warning',
      });
      return;
    }

    if (currentEligibility.cancelFeeRate === undefined) {
      const message =
        'Chưa thể xác định mức phí hủy vé. Vui lòng tra cứu lại vé.';
      setCancelError(message);
      setIneligibleModal({
        isOpen: true,
        title: 'Chưa thể xác nhận mức hoàn tiền',
        message,
        variant: 'error',
      });
      return;
    }

    if (
      confirmedFeeRate !== null &&
      currentEligibility.cancelFeeRate !== undefined &&
      currentEligibility.cancelFeeRate !== confirmedFeeRate
    ) {
      setConfirmedFeeRate(currentEligibility.cancelFeeRate);
      setFeeRateChangedWarning(
        `Mức phí hủy vé đã thay đổi từ ${Math.round((confirmedFeeRate ?? 0) * 100)}% thành ${Math.round((currentEligibility.cancelFeeRate ?? 0) * 100)}% do thời gian đến lúc khởi hành đã bước qua mốc quy định mới. Vui lòng kiểm tra lại số tiền hoàn trước khi xác nhận.`,
      );
      setIneligibleModal({
        isOpen: true,
        title: 'Mức phí hủy vé đã thay đổi',
        message: `Thời gian đến giờ khởi hành đã bước qua mốc quy định mới. Mức phí hủy vé đã thay đổi từ ${Math.round((confirmedFeeRate ?? 0) * 100)}% thành ${Math.round((currentEligibility.cancelFeeRate ?? 0) * 100)}%. Vui lòng kiểm tra lại số tiền hoàn và bấm xác nhận lại.`,
        variant: 'info',
      });
      return;
    }

    setIsCancelling(true);
    setCancelError(null);

    try {
      const res = await ticketsApi.cancelTicket(
        ticket.ticketCode,
        phone || ticket.passengerPhone || '',
        undefined,
        currentEligibility.cancelFeeRate,
      );
      setCancelResult(res.data);
      setStep(3);
    } catch (err: unknown) {
      if (isCancellationQuoteExpiredError(err)) {
        let refreshedTicket: TicketItem | null = null;
        try {
          refreshedTicket = (
            await ticketsApi.lookupTicket(
              ticket.ticketCode,
              phone || ticket.passengerPhone || '',
            )
          ).data;
        } catch {
          const currentQuote = err.details?.currentQuote;
          if (isCancellationQuote(currentQuote)) {
            refreshedTicket = { ...ticket, cancellation: currentQuote };
          }
        }

        if (!refreshedTicket) {
          const message =
            'Mức phí hủy vé đã thay đổi nhưng chưa thể tải lại báo giá. Vui lòng tra cứu lại vé.';
          setCancelError(message);
          setIneligibleModal({
            isOpen: true,
            title: 'Chưa thể cập nhật mức hoàn tiền',
            message,
            variant: 'error',
          });
          return;
        }

        const fresh = checkTicketCancelEligibility(refreshedTicket, Date.now());
        setTicket(refreshedTicket);
        setEligibility(fresh);
        setConfirmedFeeRate(fresh.cancelFeeRate ?? null);
        if (!fresh.eligible) {
          setFeeRateChangedWarning(null);
          setIneligibleModal({
            isOpen: true,
            title: fresh.title,
            message: fresh.message,
            variant: 'warning',
          });
          return;
        }
        setFeeRateChangedWarning(
          `Mức phí hủy vé đã thay đổi do thời gian đến lúc khởi hành. Vui lòng kiểm tra lại số tiền hoàn trước khi bấm xác nhận lại.`,
        );
        setIneligibleModal({
          isOpen: true,
          title: 'Mức phí hủy vé đã thay đổi',
          message:
            err.message ||
            'Mức phí hủy vé đã thay đổi do thời gian đến lúc khởi hành. Vui lòng xác nhận lại mức hoàn tiền mới.',
          variant: 'info',
        });
        return;
      }

      const errorMsg =
        (err instanceof Error ? err.message : null) ||
        'Hủy vé không thành công. Vui lòng liên hệ nhà xe để được hỗ trợ.';
      setCancelError(errorMsg);
      setIneligibleModal({
        isOpen: true,
        title: 'Không thể hủy vé',
        message: errorMsg,
        variant: 'error',
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const isCancelled = (ticket?.status || '').toUpperCase() === 'HUY' || (ticket?.status || '').toUpperCase() === 'CANCELLED';
  const departureInfo = formatTimeAndDate(ticket?.departureTime);

  const isPastDeparture = eligibility?.reason === 'ALREADY_DEPARTED';
  const isNearDeparture = eligibility?.reason === 'LESS_THAN_12_HOURS';

  const cancelFeeRate = eligibility?.cancelFeeRate ?? 0;
  const cancelFee = cancelResult?.cancelFee ?? eligibility?.cancelFee ?? 0;
  const refundAmount = cancelResult?.refundAmount ?? eligibility?.refundAmount ?? 0;

  return (
    <div className="min-h-screen bg-[#F8FAF9] py-8 font-sans">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        {/* Title OUTSIDE card, centered, blue */}
        <div className="mb-6 sm:mb-8 text-center">
          <h1 className="text-2xl md:text-3xl font-black text-[#0060c4] tracking-tight uppercase">
            HỦY VÉ
          </h1>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {/* "Xem điều kiện hủy vé" button INSIDE the card */}
          <div className="flex justify-end pt-5 pr-6 sm:pt-6 sm:pr-8">
            <button
              type="button"
              onClick={() => setShowPolicyModal(true)}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-amber-500 hover:text-amber-600 hover:underline transition-all cursor-pointer"
            >
              <HelpCircle className="w-4 h-4 text-amber-500 shrink-0" />
              <span>Xem điều kiện hủy vé</span>
            </button>
          </div>

          <div className="p-6 md:p-10 pt-2 sm:pt-3">
            {/* Step 1: Input Code and Phone */}
            {step === 1 && (
              <form onSubmit={handleLookup} className="max-w-xl mx-auto space-y-5">
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
                          : 'border-slate-300 focus:border-[#0060c4] focus:ring-2 focus:ring-[#0060c4]/15'
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
                          : 'border-slate-300 focus:border-[#0060c4] focus:ring-2 focus:ring-[#0060c4]/15'
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
                        <span>Đang kiểm tra...</span>
                      </>
                    ) : (
                      <span>Hủy vé</span>
                    )}
                  </button>
                </div>

                {generalError && (
                  <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-3 animate-in fade-in">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
                    <span>{generalError}</span>
                  </div>
                )}
              </form>
            )}

            {/* Step 2: Show Ticket Details & Confirmation */}
            {step === 2 && ticket && (
              <div className="max-w-xl mx-auto space-y-6">
                {cancelError && (
                  <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-3 animate-in fade-in">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
                    <span>{cancelError}</span>
                  </div>
                )}

                {isCancelled ? (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 flex gap-4 items-start">
                    <XCircle className="w-6 h-6 text-rose-600 shrink-0" />
                    <div>
                      <h3 className="font-bold text-rose-900 text-[15px]">Vé đã hủy trước đó</h3>
                      <p className="text-[14px] text-rose-700 mt-1">Vé này đã hoàn tất thủ tục hủy và không thể hủy lại.</p>
                    </div>
                  </div>
                ) : isPastDeparture ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 flex gap-4 items-start">
                    <ShieldAlert className="w-6 h-6 text-amber-600 shrink-0" />
                    <div>
                      <h3 className="font-bold text-amber-900 text-[15px]">Chuyến xe đã khởi hành</h3>
                      <p className="text-[14px] text-amber-700 mt-1">Không thể hủy vé sau khi chuyến xe đã xuất bến theo chính sách nhà xe.</p>
                    </div>
                  </div>
                ) : isNearDeparture ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 flex gap-4 items-start">
                    <ShieldAlert className="w-6 h-6 text-amber-600 shrink-0" />
                    <div>
                      <h3 className="font-bold text-amber-900 text-[15px]">Vé không đủ điều kiện hủy</h3>
                      <p className="text-[14px] text-amber-700 mt-1">
                        Chuyến xe khởi hành vào lúc {departureInfo.time}, ngày {departureInfo.date} (dưới 12 tiếng). Vui lòng liên hệ tổng đài nhà xe để được hỗ trợ.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-[#D1FAE5] bg-[#F0FDF4] p-5 flex gap-4 items-start">
                    <CheckCircle2 className="w-6 h-6 text-[#059669] shrink-0" />
                    <div>
                      <h3 className="font-bold text-[#065F46] text-[15px]">Vé đủ điều kiện hủy</h3>
                      <p className="text-[14px] text-[#065F46]/80 mt-1">
                        Chuyến xe khởi hành lúc {departureInfo.time} ngày {departureInfo.date}. Bạn đủ điều kiện hủy vé có hoàn tiền.
                      </p>
                    </div>
                  </div>
                )}

                {feeRateChangedWarning && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex gap-3 items-start">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-amber-800 text-[14px]">
                        Thông báo cập nhật mức phí
                      </h4>
                      <p className="text-[13px] text-amber-700 mt-0.5">
                        {feeRateChangedWarning}
                      </p>
                    </div>
                  </div>
                )}

                {/* Ticket Details Box */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
                    <div>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                        Tuyến hành trình
                      </span>
                      <span className="font-black text-[#1D2939] text-base">
                        {ticket.origin} ➔ {ticket.destination}
                      </span>
                    </div>
                    <span className="text-xs font-mono font-bold px-3 py-1 bg-white border border-slate-200 rounded-lg text-slate-700 shadow-xs">
                      {ticket.ticketCode}
                    </span>
                  </div>

                  <div className="p-5 space-y-3.5 text-[15px]">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-slate-400" />
                        Giờ khởi hành:
                      </span>
                      <span className="font-bold text-[#1D2939]">
                        {departureInfo.time}, {departureInfo.date}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-slate-400" />
                        Chỗ ngồi:
                      </span>
                      <span className="font-bold text-[#0060c4]">
                        Ghế {ticket.seatNumber} ({ticket.seatPosition || 'Ghế tiêu chuẩn'})
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 flex items-center gap-1.5">
                        <User className="w-4 h-4 text-slate-400" />
                        Hành khách:
                      </span>
                      <span className="font-bold text-slate-800">
                        {ticket.passengerName || 'Hành khách'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                      <span className="text-slate-500">Giá trị vé:</span>
                      <span className="font-bold text-slate-900 text-base">
                        {formatCurrency(ticket.price)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Refund & Fee Policy Box */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                  <h3 className="font-bold text-slate-900 text-[15px]">Chính sách phí hủy vé</h3>
                  <div className="space-y-3 text-[15px]">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">
                        Phí hủy quy định ({Math.round(cancelFeeRate * 100)}%):
                      </span>
                      <span className="font-bold text-rose-600">-{formatCurrency(cancelFee)}</span>
                    </div>
                    <div className="flex justify-between items-center text-base pt-3 border-t border-slate-200">
                      <span className="font-bold text-slate-900">Số tiền hoàn lại:</span>
                      <span className="font-black text-rose-600 text-lg">
                        {formatCurrency(refundAmount)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-[13px] text-slate-500 text-center">
                  Tiền sẽ được xử lý hoàn về phương thức{' '}
                  <strong className="text-slate-700">
                    {mapPaymentMethod(ticket.paymentMethod)} ({formatPhoneDisplay(ticket.passengerPhone || phone)})
                  </strong>{' '}
                  trong vòng 1-3 ngày làm việc.
                </div>

                {!isCancelled && !isPastDeparture && (
                  <label className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors">
                    <input
                      type="checkbox"
                      checked={isConfirmed}
                      onChange={(e) => setIsConfirmed(e.target.checked)}
                      className="mt-1 w-4 h-4 rounded border-slate-300 text-[#E04115] focus:ring-[#E04115] cursor-pointer"
                    />
                    <span className="text-sm text-slate-700 font-medium">
                      Tôi đã đọc, hiểu và đồng ý với chính sách phí hủy vé của nhà xe.
                    </span>
                  </label>
                )}

                <div className="flex gap-4 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="flex-1 h-12 bg-white text-slate-700 font-bold rounded-xl border border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Quay lại
                  </button>
                  <button
                    type="button"
                    disabled={!isConfirmed || isCancelling || isCancelled || isPastDeparture || isNearDeparture}
                    onClick={handleConfirmCancel}
                    className={`flex-1 h-12 font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer ${
                      isConfirmed && !isCancelling && !isCancelled && !isPastDeparture && !isNearDeparture
                        ? 'bg-[#E04115] text-white hover:bg-[#c93a12]'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    {isCancelling ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Đang xử lý hủy vé...</span>
                      </>
                    ) : (
                      <span>Xác nhận hủy vé</span>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Success Screen */}
            {step === 3 && (
              <div className="text-center py-8 space-y-6 max-w-xl mx-auto">
                <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900">Hủy vé thành công!</h2>
                  <p className="text-slate-600 mt-2 max-w-md mx-auto text-sm leading-relaxed">
                    Vé <strong className="font-mono text-slate-800">{ticket?.ticketCode}</strong> đã được hủy và hệ thống đã giải phóng ghế{' '}
                    <strong className="text-slate-800">{ticket?.seatNumber}</strong>. Số tiền{' '}
                    <strong className="text-rose-600 font-black">{formatCurrency(refundAmount)}</strong> đang được xử lý hoàn về phương thức thanh toán ban đầu.
                  </p>
                </div>
                <div className="pt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <Link
                    href="/"
                    className="w-full sm:w-auto h-12 px-8 flex items-center justify-center bg-[#0060c4] hover:bg-blue-700 text-white font-bold rounded-xl transition-colors shadow-md shadow-[#0060c4]/20"
                  >
                    Trở về trang chủ
                  </Link>
                  <Link
                    href="/tickets/lookup"
                    className="w-full sm:w-auto h-12 px-8 flex items-center justify-center bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded-xl transition-colors"
                  >
                    Tra cứu vé
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cancellation Policy Modal */}
      {showPolicyModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-amber-500" />
                <h3 className="font-black text-slate-900 text-lg">
                  Điều kiện & Chính sách hủy vé
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPolicyModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
                title="Đóng"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-4 text-sm text-slate-600 leading-relaxed max-h-[70vh] overflow-y-auto">
              <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 text-amber-900 space-y-1.5">
                <p className="font-bold text-sm text-amber-900">Quy định về thời gian hủy:</p>
                <ul className="list-disc list-inside space-y-1 text-xs sm:text-sm text-amber-800">
                  <li><strong>Trước giờ khởi hành {'>'} 24 tiếng:</strong> Phí hủy 10% giá vé, hoàn lại 90%.</li>
                  <li><strong>Trước giờ khởi hành từ 12 - 24 tiếng:</strong> Phí hủy 20% giá vé, hoàn lại 80%.</li>
                  <li><strong>Trước giờ khởi hành {'<'} 12 tiếng:</strong> Không áp dụng hủy trực tuyến.</li>
                  <li><strong>Sau khi chuyến xe đã khởi hành:</strong> Vé không còn giá trị hủy hoặc hoàn tiền.</li>
                </ul>
              </div>

              <div className="space-y-2">
                <p className="font-bold text-slate-800 text-sm">Quy định hoàn tiền:</p>
                <ul className="list-disc list-inside space-y-1 text-xs sm:text-sm text-slate-600">
                  <li>Tiền hoàn sẽ được chuyển về đúng phương thức thanh toán ban đầu (Ví MoMo, VNPay, ZaloPay, Thẻ ngân hàng).</li>
                  <li>Thời gian hoàn tiền: từ 1 đến 3 ngày làm việc (không tính Thứ 7, Chủ Nhật và ngày lễ).</li>
                  <li>Mỗi vé chỉ được thực hiện hủy một lần duy nhất. Ghế sẽ được giải phóng ngay sau khi hủy thành công.</li>
                </ul>
              </div>
            </div>

            <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowPolicyModal(false)}
                className="px-6 py-2.5 bg-[#0060c4] hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition-colors cursor-pointer shadow-sm"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ineligibility / Error Modal */}
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

export default function CancelTicketPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-500 font-medium">Đang tải...</div>}>
      <CancelTicketContent />
    </Suspense>
  );
}
