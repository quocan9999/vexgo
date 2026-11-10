'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  HelpCircle,
  Loader2,
  MapPin,
  Phone,
  RotateCcw,
  ShieldAlert,
  Ticket,
  User,
  X,
  XCircle,
} from 'lucide-react';
import { AlertModal } from '@/components/ui/alert-modal';
import {
  ticketsApi,
  ApiError,
  isCancellationCutoffPassedError,
  isCancellationQuoteExpiredError,
  type TicketItem,
  type CancelTicketResult,
  type TicketCancellationQuote,
} from '@/features/account/services/tickets.api';
import {
  checkTicketCancelEligibility,
  startCancellationQuoteRefresh,
  type CancelEligibilityResult,
} from '@/features/tickets/services/cancel-eligibility';
import {
  getCancelSession,
  clearCancelSession,
} from '@/features/tickets/services/cancel-session';

function formatCurrency(amount: number | string | null | undefined, locale = 'vi'): string {
  if (amount == null || amount === '') return '0 đ';
  const num = typeof amount === 'number' ? amount : Number(amount);
  if (isNaN(num)) return '0 đ';
  return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(num);
}

function formatTimeAndDate(isoString: string | null | undefined, fallbackText = 'Chưa cập nhật'): { time: string; date: string } {
  if (!isoString) return { time: '--:--', date: fallbackText };
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
  const t = useTranslations('tickets');
  const tLookup = useTranslations('lookup');
  const tCommon = useTranslations('common');
  const locale = useLocale();

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
  const [selectedTicketCodes, setSelectedTicketCodes] = useState<string[]>(() => {
    if (initialSession?.ticket) {
      const tickets = initialSession.ticket.bookingTickets || [initialSession.ticket];
      return tickets
        .filter((tItem) => (tItem.status || '').toUpperCase() !== 'HUY' && (tItem.status || '').toUpperCase() !== 'CANCELLED')
        .map((tItem) => tItem.ticketCode);
    }
    return [];
  });
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
      setPhoneError(tLookup('phoneErrorEmpty'));
      hasError = true;
    } else if (!VIETNAM_PHONE_REGEX.test(cleanPhone)) {
      setPhoneError(tLookup('phoneErrorInvalid'));
      hasError = true;
    }

    if (!cleanCode) {
      setTicketCodeError(tLookup('ticketCodeErrorEmpty'));
      hasError = true;
    }

    if (hasError) return;

    setIsLoading(true);
    setCancelError(null);

    try {
      const response = await ticketsApi.lookupTicket(cleanCode, cleanPhone);
      const ticketData = response.data;
      const allTickets =
        ticketData.bookingTickets && ticketData.bookingTickets.length > 0
          ? ticketData.bookingTickets
          : [ticketData];
      const cancellable = allTickets.filter(
        (tItem) =>
          (tItem.status || '').toUpperCase() !== 'HUY' &&
          (tItem.status || '').toUpperCase() !== 'CANCELLED',
      );

      const repTicket = cancellable.length > 0 ? cancellable[0] : ticketData;
      const result = checkTicketCancelEligibility(repTicket, Date.now());
      setEligibility(result);
      setConfirmedFeeRate(result.cancelFeeRate ?? null);
      setFeeRateChangedWarning(null);

      if (!result.eligible) {
        setIneligibleModal({
          isOpen: true,
          title: result.title,
          message:
            cancellable.length === 0 && (result.reason === 'ALREADY_CANCELLED' || !result.reason)
              ? t('allTicketsCancelled')
              : result.message,
          variant: 'warning',
        });
        return;
      }

      setTicket({
        ...repTicket,
        bookingTickets: allTickets,
      });
      setSelectedTicketCodes(cancellable.map((tItem) => tItem.ticketCode));
      setStep(2);
    } catch (err: unknown) {
      const apiError = err as { status?: number; message?: string };
      if (apiError?.status === 404) {
        setGeneralError(t('ticketNotFoundOrMismatch'));
      } else if (apiError?.status === 429) {
        setGeneralError(t('tooManyRequests'));
      } else {
        setGeneralError(apiError?.message || t('lookupErrorDefault'));
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
          const allTickets =
            ticketData.bookingTickets && ticketData.bookingTickets.length > 0
              ? ticketData.bookingTickets
              : [ticketData];
          const cancellable = allTickets.filter(
            (tItem) =>
              (tItem.status || '').toUpperCase() !== 'HUY' &&
              (tItem.status || '').toUpperCase() !== 'CANCELLED',
          );
          const repTicket = cancellable.length > 0 ? cancellable[0] : ticketData;
          const result = checkTicketCancelEligibility(repTicket, Date.now());
          setEligibility(result);
          setConfirmedFeeRate(result.cancelFeeRate ?? null);
          setFeeRateChangedWarning(null);

          if (!result.eligible) {
            setIneligibleModal({
              isOpen: true,
              title: result.title,
              message:
                cancellable.length === 0 && (result.reason === 'ALREADY_CANCELLED' || !result.reason)
                  ? t('allTicketsCancelled')
                  : result.message,
              variant: 'warning',
            });
            return;
          }

          setTicket({
            ...repTicket,
            bookingTickets: allTickets,
          });
          setSelectedTicketCodes(cancellable.map((tItem) => tItem.ticketCode));
          setStep(2);
        })
        .catch((err: unknown) => {
          if (!isMounted) return;
          const apiError = err as { status?: number; message?: string };
          if (apiError?.status === 404) {
            setGeneralError(t('ticketNotFoundOrMismatch'));
          } else {
            setGeneralError(apiError?.message || t('lookupErrorDefault'));
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
  }, [initialSession, t]);

  const activeTicketCode = ticket?.ticketCode ?? '';
  const activePhone = phone || ticket?.passengerPhone || '';

  useEffect(() => {
    if (
      step !== 2 ||
      !activeTicketCode ||
      !activePhone ||
      eligibility?.eligible === false
    ) {
      return;
    }

    return startCancellationQuoteRefresh({
      ticketCode: activeTicketCode,
      phoneNumber: activePhone,
      lookupTicket: ticketsApi.lookupTicket,
      onRefresh: (refreshedTicket, fresh) => {
        setTicket(refreshedTicket);
        setEligibility(fresh);

        if (!fresh.eligible) {
          setIsConfirmed(false);
          setFeeRateChangedWarning(null);
          setIneligibleModal({
            isOpen: true,
            title: fresh.title,
            message: fresh.message,
            variant: 'warning',
          });
          return;
        }

        if (
          confirmedFeeRate !== null &&
          fresh.cancelFeeRate !== undefined &&
          fresh.cancelFeeRate !== confirmedFeeRate
        ) {
          setFeeRateChangedWarning(
            t('feeRateChangedDesc', {
              oldRate: Math.round(confirmedFeeRate * 100),
              newRate: Math.round(fresh.cancelFeeRate * 100),
            }),
          );
        }
      },
    });
  }, [
    activePhone,
    activeTicketCode,
    confirmedFeeRate,
    eligibility?.eligible,
    step,
    t,
  ]);

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
      const message = t('cannotDetermineCancelFee');
      setCancelError(message);
      setIneligibleModal({
        isOpen: true,
        title: t('cannotConfirmRefundTitle'),
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
        t('feeRateChangedDesc', {
          oldRate: Math.round((confirmedFeeRate ?? 0) * 100),
          newRate: Math.round((currentEligibility.cancelFeeRate ?? 0) * 100),
        }),
      );
      setIneligibleModal({
        isOpen: true,
        title: t('feeRateChangedTitle'),
        message: t('feeRateChangedModalDesc', {
          oldRate: Math.round((confirmedFeeRate ?? 0) * 100),
          newRate: Math.round((currentEligibility.cancelFeeRate ?? 0) * 100),
        }),
        variant: 'info',
      });
      return;
    }

    const bookingTickets =
      ticket.bookingTickets && ticket.bookingTickets.length > 0
        ? ticket.bookingTickets
        : [ticket];
    const isMultiTicket = bookingTickets.length > 1;

    if (isMultiTicket && selectedTicketCodes.length === 0) {
      const msg = t('selectAtLeastOneTicket');
      setCancelError(msg);
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
        isMultiTicket ? selectedTicketCodes : undefined,
      );
      setCancelResult(res.data);
      setStep(3);
    } catch (err: unknown) {
      if (isCancellationCutoffPassedError(err) || (err instanceof ApiError && err.error === 'TICKET_CANCELLATION_ACTIVE_SHIPMENT')) {
        const cutoffTicket: TicketItem = {
          ...ticket,
          cancellation: {
            eligible: false,
            reason: err instanceof ApiError && err.error === 'TICKET_CANCELLATION_ACTIVE_SHIPMENT' ? 'ACTIVE_SHIPMENT' : 'LESS_THAN_4_HOURS',
            cancelFeeRate: 0,
            cancelFee: 0,
            refundAmount: 0,
          },
        };
        const cutoffEligibility = checkTicketCancelEligibility(cutoffTicket);
        setTicket(cutoffTicket);
        setEligibility(cutoffEligibility);
        setIsConfirmed(false);
        setFeeRateChangedWarning(null);
        setCancelError(null);
        setIneligibleModal({
          isOpen: true,
          title: cutoffEligibility.title,
          message: cutoffEligibility.message,
          variant: 'warning',
        });
        return;
      }

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
          const message = t('cannotDetermineCancelFee');
          setCancelError(message);
          setIneligibleModal({
            isOpen: true,
            title: t('cannotConfirmRefundTitle'),
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
          t('feeRateChangedDesc', {
            oldRate: Math.round((confirmedFeeRate ?? 0) * 100),
            newRate: Math.round((fresh.cancelFeeRate ?? 0) * 100),
          }),
        );
        setIneligibleModal({
          isOpen: true,
          title: t('feeRateChangedTitle'),
          message:
            err.message ||
            t('feeRateChangedModalDesc', {
              oldRate: Math.round((confirmedFeeRate ?? 0) * 100),
              newRate: Math.round((fresh.cancelFeeRate ?? 0) * 100),
            }),
          variant: 'info',
        });
        return;
      }

      const errorMsg =
        (err instanceof Error ? err.message : null) ||
        t('cancelFailure');
      setCancelError(errorMsg);
      setIneligibleModal({
        isOpen: true,
        title: t('cancelFailure'),
        message: errorMsg,
        variant: 'error',
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const bookingTickets =
    ticket?.bookingTickets && ticket.bookingTickets.length > 0
      ? ticket.bookingTickets
      : ticket
        ? [ticket]
        : [];
  const isMultiTicket = bookingTickets.length > 1;
  const cancellableTickets = bookingTickets.filter(
    (tItem) =>
      (tItem.status || '').toUpperCase() !== 'HUY' &&
      (tItem.status || '').toUpperCase() !== 'CANCELLED',
  );
  const selectedTickets = bookingTickets.filter((tItem) =>
    selectedTicketCodes.includes(tItem.ticketCode),
  );

  const isCancelled = isMultiTicket
    ? cancellableTickets.length === 0
    : (ticket?.status || '').toUpperCase() === 'HUY' ||
      (ticket?.status || '').toUpperCase() === 'CANCELLED';

  const departureInfo = formatTimeAndDate(ticket?.departureTime, t('notUpdated'));

  const isPastDeparture = eligibility?.reason === 'ALREADY_DEPARTED';
  const isNearDeparture =
    eligibility?.reason === 'LESS_THAN_2_HOURS_30_MINUTES' ||
    eligibility?.reason === 'LESS_THAN_4_HOURS' ||
    eligibility?.reason === 'LESS_THAN_12_HOURS';

  const cancelFeeRate = eligibility?.cancelFeeRate ?? 0;

  const selectedSubtotal = isMultiTicket
    ? selectedTickets.reduce((sum, tItem) => sum + (tItem.price || 0), 0)
    : (ticket?.price ?? 0);

  const calculatedCancelFee = Math.round(selectedSubtotal * cancelFeeRate);
  const calculatedRefundAmount = Math.max(
    0,
    selectedSubtotal - calculatedCancelFee,
  );

  const cancelFee =
    cancelResult?.cancelFee ??
    (isMultiTicket ? calculatedCancelFee : (eligibility?.cancelFee ?? 0));
  const refundAmount =
    cancelResult?.refundAmount ??
    (isMultiTicket
      ? calculatedRefundAmount
      : (eligibility?.refundAmount ?? 0));

  const handleToggleSelectAll = () => {
    if (selectedTicketCodes.length === cancellableTickets.length) {
      setSelectedTicketCodes([]);
    } else {
      setSelectedTicketCodes(cancellableTickets.map((tItem) => tItem.ticketCode));
    }
  };

  const handleToggleTicket = (code: string) => {
    setSelectedTicketCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  };

  return (
    <div className="min-h-screen bg-[#F4F6F8] font-sans pb-24">
      {/* HERO BANNER SECTION */}
      <div className="bg-[#17223B] text-white pt-10 pb-20 px-4 sm:px-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-6xl mx-auto relative z-10">
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-2">
              {t('cancelHeroTitle')} , <br className="hidden sm:inline" />
              <span className="text-[#FF7D42]">{t('cancelHeroSubtitle')}</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl leading-relaxed">
              {t('cancelHeroDesc')}
            </p>
          </div>
        </div>
      </div>

      {/* Floating Card Container */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 -mt-10 relative z-20">
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
          {/* Top card bar: Header & "Xem điều kiện hủy vé" */}
          <div className="px-6 sm:px-8 py-5 bg-gradient-to-r from-rose-50/70 via-white to-slate-50 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100/60 shadow-xs">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-900">
                  {t('cancelProcTitle')}
                </h2>
                <p className="text-xs text-slate-500">
                  {step === 1 ? t('cancelStep1Desc') : step === 2 ? t('cancelStep2Desc') : t('cancelStep3Desc')}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowPolicyModal(true)}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-amber-600 hover:text-amber-700 hover:underline transition-all cursor-pointer bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200/60"
            >
              <HelpCircle className="w-4 h-4 text-amber-500 shrink-0" />
              <span>{t('viewCancelPolicy')}</span>
            </button>
          </div>

          <div className="p-6 md:p-10 pt-6 sm:pt-8">
            {/* Step 1: Input Code and Phone */}
            {step === 1 && (
              <form onSubmit={handleLookup} className="max-w-xl mx-auto space-y-5">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    {t('phone')} <span className="text-rose-500">*</span>
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
                      placeholder={tLookup('phonePlaceholder')}
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
                    {t('ticketCode')} <span className="text-rose-500">*</span>
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
                      placeholder={tLookup('ticketCodePlaceholder')}
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
                        <span>{tCommon('loading')}</span>
                      </>
                    ) : (
                      <span>{t('cancelTicket')}</span>
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
                      <h3 className="font-bold text-rose-900 text-[15px]">{t('allTicketsAlreadyCancelled')}</h3>
                      <p className="text-[14px] text-rose-700 mt-1">{t('allTicketsAlreadyCancelledDesc')}</p>
                    </div>
                  </div>
                ) : isPastDeparture ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 flex gap-4 items-start">
                    <ShieldAlert className="w-6 h-6 text-amber-600 shrink-0" />
                    <div>
                      <h3 className="font-bold text-amber-900 text-[15px]">{eligibility?.title || t('statusExpired')}</h3>
                      <p className="text-[14px] text-amber-700 mt-1">{t('tripAlreadyDepartedDesc')}</p>
                    </div>
                  </div>
                ) : isNearDeparture ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 flex gap-4 items-start">
                    <ShieldAlert className="w-6 h-6 text-amber-600 shrink-0" />
                    <div>
                      <h3 className="font-bold text-amber-900 text-[15px]">{t('ineligibleForOnlineCancel')}</h3>
                      <p className="text-[14px] text-amber-700 mt-1">
                        {eligibility?.message || t('ineligibleNearDepartureDesc', { time: departureInfo.time, date: departureInfo.date })}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-[#D1FAE5] bg-[#F0FDF4] p-5 flex gap-4 items-start">
                    <CheckCircle2 className="w-6 h-6 text-[#059669] shrink-0" />
                    <div>
                      <h3 className="font-bold text-[#065F46] text-[15px]">
                        {isMultiTicket ? t('bookingEligibleForCancel') : t('eligibleForCancel')}
                      </h3>
                      <p className="text-[14px] text-[#065F46]/80 mt-1">
                        {t('eligibleCancelNotice', { time: departureInfo.time, date: departureInfo.date })}
                      </p>
                    </div>
                  </div>
                )}

                {feeRateChangedWarning && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex gap-3 items-start">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-amber-800 text-[14px]">
                        {t('feeRateChangedTitle')}
                      </h4>
                      <p className="text-[13px] text-amber-700 mt-0.5">
                        {feeRateChangedWarning}
                      </p>
                    </div>
                  </div>
                )}

                {/* Chuyến xe & Đơn đặt vé Header Box */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50">
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                        {t('routeJourney')}
                      </span>
                      <span className="font-black text-[#1D2939] text-base">
                        {ticket.origin} ➔ {ticket.destination}
                      </span>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        {ticket.busCompanyName} • {ticket.vehicleType || t('vehicleTypeStandard')}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-mono font-bold px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-700 shadow-xs block">
                        {ticket.bookingCode ? `${t('bookingCode')}: ${ticket.bookingCode}` : ticket.ticketCode}
                      </span>
                      <span className="text-[11px] text-slate-500 font-semibold mt-1 block">
                        {t('departurePrefix')} {departureInfo.time}
                      </span>
                    </div>
                  </div>

                  {/* Single Ticket Info */}
                  {!isMultiTicket && (
                    <div className="p-5 space-y-3 text-[14px]">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 flex items-center gap-1.5">
                          <MapPin className="w-4 h-4 text-slate-400" />
                          {t('seatAndPosition')}
                        </span>
                        <span className="font-bold text-[#0060c4]">
                          {t('seatNumberWithLabel', { seatNumber: ticket.seatNumber || 'N/A' })} ({ticket.seatPosition || t('seatStandard')})
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 flex items-center gap-1.5">
                          <User className="w-4 h-4 text-slate-400" />
                          {t('passenger')}:
                        </span>
                        <span className="font-bold text-slate-800">
                          {ticket.passengerName || t('passenger')}
                        </span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                        <span className="text-slate-500">{t('ticketValue')}</span>
                        <span className="font-bold text-slate-900 text-base">
                          {formatCurrency(ticket.price, locale)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Danh sách vé để chọn hủy (khi đơn có nhiều vé) */}
                {isMultiTicket && (
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between gap-2 p-4 bg-slate-50 border-b border-slate-200">
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">
                          {t('selectTicketsToCancelCount', { count: bookingTickets.length })}
                        </h4>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                          {t('selectedCancellableCount', {
                            selected: selectedTicketCodes.length,
                            total: cancellableTickets.length,
                          })}
                        </p>
                      </div>
                      {cancellableTickets.length > 0 && (
                        <button
                          type="button"
                          onClick={handleToggleSelectAll}
                          className="text-xs font-bold text-[#0060c4] hover:underline cursor-pointer px-2.5 py-1 rounded-md bg-blue-50 border border-blue-200 transition-colors"
                        >
                          {selectedTicketCodes.length === cancellableTickets.length
                            ? t('deselectAll')
                            : t('selectAll')}
                        </button>
                      )}
                    </div>

                    <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
                      {bookingTickets.map((item, idx) => {
                        const itemCancelled =
                          (item.status || '').toUpperCase() === 'HUY' ||
                          (item.status || '').toUpperCase() === 'CANCELLED';
                        const isChecked = selectedTicketCodes.includes(item.ticketCode);

                        return (
                          <div
                            key={item.ticketCode || idx}
                            onClick={() => {
                              if (!itemCancelled) handleToggleTicket(item.ticketCode);
                            }}
                            className={`p-3.5 sm:p-4 flex items-center justify-between gap-3 transition-colors ${
                              itemCancelled
                                ? 'bg-slate-50/70 opacity-60 cursor-not-allowed'
                                : isChecked
                                  ? 'bg-blue-50/40 hover:bg-blue-50 cursor-pointer'
                                  : 'hover:bg-slate-50 cursor-pointer'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                disabled={itemCancelled}
                                onChange={() => handleToggleTicket(item.ticketCode)}
                                onClick={(e) => e.stopPropagation()}
                                className="w-4 h-4 rounded border-slate-300 text-[#0060c4] focus:ring-[#0060c4] cursor-pointer"
                              />
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-extrabold text-slate-900 text-sm">
                                    {t('seatNumberWithLabel', { seatNumber: item.seatNumber || t('unassignedSeat') })}
                                  </span>
                                  <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                    {item.ticketCode}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-500 font-medium mt-0.5">
                                  {item.seatPosition || t('seatStandard')} • {item.passengerName || ticket.passengerName || t('passenger')}
                                </p>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <span className="font-bold text-slate-900 text-sm block">
                                {formatCurrency(item.price, locale)}
                              </span>
                              {itemCancelled ? (
                                <span className="text-[11px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                  {t('statusCancelled')}
                                </span>
                              ) : (
                                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                  {t('cancellableStatus')}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Refund & Fee Policy Box */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                  <h3 className="font-bold text-slate-900 text-[15px]">
                    {t('feeAndRefundPolicy')}
                  </h3>
                  <div className="space-y-3 text-[14px]">
                    {isMultiTicket && (
                      <div className="flex justify-between items-center text-slate-600">
                        <span>{t('selectedTicketsCountLabel')}</span>
                        <span className="font-bold text-slate-800">
                          {selectedTicketCodes.length} {t('unitTickets')}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between items-center text-slate-600">
                      <span>{t('totalSelectedTicketsValueLabel')}</span>
                      <span className="font-bold text-slate-800">
                        {formatCurrency(selectedSubtotal, locale)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">
                        {t('standardCancelFee', { rate: Math.round(cancelFeeRate * 100) })}
                      </span>
                      <span className="font-bold text-rose-600">
                        -{formatCurrency(cancelFee, locale)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-base pt-3 border-t border-slate-200">
                      <span className="font-bold text-slate-900">{t('estimatedRefund')}:</span>
                      <span className="font-black text-emerald-600 text-lg">
                        {formatCurrency(refundAmount, locale)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm space-y-1.5 shadow-xs">
                  <div className="flex items-center gap-2 font-bold text-amber-950">
                    <Phone className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>{t('refundNoticeTitle')}</span>
                  </div>
                  <p className="leading-relaxed text-amber-800">
                    {t('refundNoticeDesc', { operator: ticket.busCompanyName || 'nhà xe' })}
                  </p>
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
                      {t('agreeCancelTerms')}
                    </span>
                  </label>
                )}

                <div className="flex gap-4 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="flex-1 h-12 bg-white text-slate-700 font-bold rounded-xl border border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    {t('back')}
                  </button>
                  <button
                    type="button"
                    disabled={
                      !isConfirmed ||
                      isCancelling ||
                      isCancelled ||
                      isPastDeparture ||
                      isNearDeparture ||
                      eligibility?.eligible === false ||
                      (isMultiTicket && selectedTicketCodes.length === 0)
                    }
                    onClick={handleConfirmCancel}
                    className={`flex-1 h-12 font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer ${
                      isConfirmed &&
                      !isCancelling &&
                      !isCancelled &&
                      !isPastDeparture &&
                      !isNearDeparture &&
                      eligibility?.eligible !== false &&
                      (!isMultiTicket || selectedTicketCodes.length > 0)
                        ? 'bg-[#E04115] text-white hover:bg-[#c93a12]'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    {isCancelling ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>{t('processingCancellation')}</span>
                      </>
                    ) : (
                      <span>
                        {isMultiTicket && selectedTicketCodes.length > 1
                          ? t('confirmCancelMultiple', { count: selectedTicketCodes.length })
                          : t('confirmCancelSingle')}
                      </span>
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
                  <h2 className="text-2xl font-black text-slate-900">{t('cancelSuccessTitle')}</h2>
                  <p className="text-slate-600 mt-2 max-w-md mx-auto text-sm leading-relaxed">
                    {cancelResult?.cancelledTicketCodes && cancelResult.cancelledTicketCodes.length > 1 ? (
                      t('cancelSuccessMultiDesc', {
                        count: cancelResult.cancelledTicketCodes.length,
                        codes: cancelResult.cancelledTicketCodes.join(', '),
                        seats: cancelResult.cancelledSeatNumbers?.join(', ') || ticket?.seatNumber || '',
                      })
                    ) : (
                      t('cancelSuccessSingleDesc', {
                        code: cancelResult?.ticketCode || ticket?.ticketCode || '',
                        seat: ticket?.seatNumber || '',
                      })
                    )}
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-amber-50/90 border border-amber-200 text-left max-w-md mx-auto space-y-2.5 shadow-xs">
                  <div className="flex items-center gap-2 font-black text-amber-950 text-base">
                    <Phone className="w-5 h-5 text-amber-600 shrink-0" />
                    <span>{t('contactOperatorForRefundTitle')}</span>
                  </div>
                  {cancelResult?.refundAmount !== undefined && cancelResult.refundAmount > 0 && (
                    <div className="p-3 bg-white/80 rounded-xl border border-amber-200/60 flex items-center justify-between text-sm">
                      <span className="text-slate-600 font-medium">{t('estimatedRefund')}:</span>
                      <strong className="font-black text-emerald-600 text-base">{formatCurrency(cancelResult.refundAmount, locale)}</strong>
                    </div>
                  )}
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {t('refundNoticeSuccess', { operator: ticket?.busCompanyName || 'nhà xe' })}
                  </p>
                </div>

                <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <Link
                    href="/"
                    className="w-full sm:w-auto h-12 px-8 flex items-center justify-center bg-[#0060c4] hover:bg-blue-700 text-white font-bold rounded-xl transition-colors shadow-md shadow-[#0060c4]/20"
                  >
                    {t('backToHome')}
                  </Link>
                  <Link
                    href="/tickets/lookup"
                    className="w-full sm:w-auto h-12 px-8 flex items-center justify-center bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded-xl transition-colors"
                  >
                    {t('tabBusTicket')}
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
                  {t('policyModalTitle')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPolicyModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
                title={tCommon('close')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-4 text-sm text-slate-600 leading-relaxed max-h-[70vh] overflow-y-auto">
              <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 text-amber-900 space-y-1.5">
                <p className="font-bold text-sm text-amber-900">{t('policyTimeHeading')}</p>
                <ul className="list-disc list-inside space-y-1 text-xs sm:text-sm text-amber-800">
                  <li>{t('policyTimeRule1')}</li>
                  <li>{t('policyTimeRule2')}</li>
                  <li>{t('policyTimeRule3')}</li>
                </ul>
              </div>

              <div className="space-y-2">
                <p className="font-bold text-slate-800 text-sm">{t('policyFeeHeading')}</p>
                <ul className="list-disc list-inside space-y-1.5 text-xs sm:text-sm text-slate-600">
                  <li>{t('policyFeeRule1')}</li>
                  <li>{t('policyFeeRule2')}</li>
                  <li>{t('policyFeeRule3')}</li>
                  <li>{t('policyFeeRule4')}</li>
                  <li>{t('policyFeeRule5')}</li>
                </ul>
              </div>
            </div>

            <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowPolicyModal(false)}
                className="px-6 py-2.5 bg-[#0060c4] hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition-colors cursor-pointer shadow-sm"
              >
                {t('modalUnderstood')}
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
        confirmText={t('modalUnderstood')}
        onClose={() => setIneligibleModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}

export default function CancelTicketPage() {
  const tCommon = useTranslations('common');
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-500 font-medium">{tCommon('loading')}</div>}>
      <CancelTicketContent />
    </Suspense>
  );
}
