'use client';

import React, { useState, useEffect, useMemo, useCallback, useSyncExternalStore, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Info, ScanLine, X } from 'lucide-react';
import {
  PAYMENT_DRAFT_STORAGE_PREFIX,
  validatePaymentDraft,
  type BookingPaymentDraft,
  type PaymentDraft,
} from '@/features/booking/services/payment-draft';
import { bookingsApi } from '@/features/account/services/bookings.api';
import {
  PaymentApiError,
  paymentsApi,
} from '@/features/payments/services/payments.api';
import { ApiError, shipmentsApi } from '@/features/shipments/services/shipments.api';
import { useAuthSession } from '@/features/auth/auth-session';
import {
  createVietQrImageUrl,
  readVietQrAccountConfig,
} from '@/features/payments/services/vietqr-config';

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

type PaymentReadSnapshot = {
  draftId: string;
  resourceKey: string;
  expectedOrderCode: string;
  expectedTotalAmount: number;
  orderCode: string | null;
  totalAmount: number | null;
  promotionCode: string | null;
  originalTicketSubtotal: number | null;
  discountAmount: number | null;
  ticketSubtotal: number | null;
  cargoFee: number | null;
  paymentExpiresAt: string | null;
  serverTimeOffsetMs: number;
  terminalStatus: 'paid' | 'cancelled' | 'expired' | 'verification-needed' | 'failed' | 'reconciliation-required' | null;
};

type PaymentStatusPayload = {
  promotionCode?: string | null;
  paymentId?: number;
  bookingId?: number;
  bookingCode?: string;
  shipmentId?: number | null;
  waybillCode?: string;
  orderCode?: string | null;
  amount?: number | string;
  totalAmount?: number | string;
  status?: string;
  orderStatus?: string | null;
  paymentStatus?: string | null;
  bookingStatus?: string | null;
  shipmentStatus?: string | null;
  requiresReconciliation?: boolean;
  provider?: string | null;
  paymentMethod?: string | null;
  paymentExpiresAt?: string | null;
  serverTime?: string;
  originalTicketSubtotal?: number | string;
  discountAmount?: number | string;
  ticketSubtotal?: number | string;
  cargoFee?: number | string;
};

const PAYMENT_POLL_INTERVAL_MS = 2500;
// Four guest lookups per minute leaves room for a second tab and manual lookups under the IP limit.
const PUBLIC_SHIPMENT_POLL_INTERVAL_MS = 15_000;
const PUBLIC_SHIPMENT_RATE_LIMIT_BACKOFF_MS = 60_000;
const MAX_INITIAL_STATUS_READ_FAILURES = 3;
const PAYMENT_STATUS_REQUEST_TIMEOUT_MS = 10_000;

function readRetryAfterDelayMs(retryAfter: string | null): number | null {
  if (!retryAfter?.trim()) return null;
  const delaySeconds = Number(retryAfter);
  if (Number.isFinite(delaySeconds) && delaySeconds >= 0) {
    return Math.ceil(delaySeconds * 1000);
  }
  const retryAt = Date.parse(retryAfter);
  return Number.isFinite(retryAt) ? Math.max(0, retryAt - Date.now()) : null;
}

function getShipmentPaymentStatusPresentation(
  hasVerifiedSnapshot: boolean,
  terminalStatus: PaymentReadSnapshot['terminalStatus'],
): { label: string; className: string } {
  if (!hasVerifiedSnapshot || terminalStatus === 'verification-needed') {
    return { label: 'Đang xác minh', className: 'text-slate-600' };
  }
  switch (terminalStatus) {
    case 'paid':
      return { label: 'Đã thanh toán', className: 'text-emerald-700' };
    case 'cancelled':
      return { label: 'Đã hủy', className: 'text-rose-700' };
    case 'expired':
      return { label: 'Hết hạn', className: 'text-rose-700' };
    case 'failed':
      return { label: 'Thanh toán thất bại', className: 'text-rose-700' };
    case 'reconciliation-required':
      return { label: 'Cần đối soát', className: 'text-amber-700' };
    default:
      return { label: 'Chờ thanh toán', className: 'text-amber-700' };
  }
}

function readNonNegativeAmount(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

function isForbiddenApiResponse(error: unknown): boolean {
  return error instanceof PaymentApiError && error.status === 403;
}

function getCargoItemQuantity(quantity?: number): number | null {
  return typeof quantity === 'number' && Number.isSafeInteger(quantity) && quantity > 0
    ? quantity
    : null;
}

function getCargoPackageCount(items?: Array<{ quantity?: number }>): number | null {
  if (!items?.length) return null;
  let total = 0;
  for (const item of items) {
    const quantity = getCargoItemQuantity(item.quantity);
    if (quantity === null) return null;
    total += quantity;
    if (!Number.isSafeInteger(total)) return null;
  }
  return total;
}

type PaymentPriceBreakdownRowsProps = {
  originalTicketSubtotal: number | null | undefined;
  discountAmount: number | null | undefined;
  promotionCode: string | null | undefined;
  ticketSubtotal: number | null | undefined;
  totalAmount: number | null | undefined;
  hasVerifiedPaymentAmount: boolean;
  showCargoFee: boolean;
  cargoFeeText: string;
  cargoFeeClassName: string;
  formatConfirmedAmount: (amount: number | null | undefined) => string;
  showTotal?: boolean;
};

function PaymentPriceBreakdownRows({
  originalTicketSubtotal,
  discountAmount,
  promotionCode,
  ticketSubtotal,
  totalAmount,
  hasVerifiedPaymentAmount,
  showCargoFee,
  cargoFeeText,
  cargoFeeClassName,
  formatConfirmedAmount,
  showTotal = true,
}: PaymentPriceBreakdownRowsProps) {
  const showDiscount = hasVerifiedPaymentAmount &&
    (discountAmount === null || discountAmount === undefined || discountAmount > 0);

  return (
    <div className="space-y-2.5 text-sm">
      <div className="flex justify-between gap-3">
        <span className="text-slate-500">Giá vé gốc</span>
        <span className="font-bold text-slate-700 text-right">
          {formatConfirmedAmount(originalTicketSubtotal)}
        </span>
      </div>
      {promotionCode && (
        <div className="flex justify-between gap-3">
          <span className="text-slate-500">Mã khuyến mãi</span>
          <strong className="font-mono font-bold text-emerald-700 text-right">
            {promotionCode}
          </strong>
        </div>
      )}
      {showDiscount && (
        <div className="flex justify-between gap-3">
          <span className="text-slate-500">Giảm giá</span>
          <span className="font-bold text-emerald-700 text-right">
            {discountAmount === null || discountAmount === undefined
              ? 'Chưa có dữ liệu từ máy chủ'
              : `−${discountAmount.toLocaleString('vi-VN')}đ`}
          </span>
        </div>
      )}
      <div className="flex justify-between gap-3">
        <span className="text-slate-500">Tổng tiền vé sau ưu đãi</span>
        <span className="font-bold text-red-600 text-right">
          {formatConfirmedAmount(ticketSubtotal)}
        </span>
      </div>
      {showCargoFee && (
        <div className="flex justify-between gap-3">
          <span className="text-slate-500">
            Cước hàng
          </span>
          <span className={`font-bold text-right ${cargoFeeClassName}`}>
            {cargoFeeText}
          </span>
        </div>
      )}
      {showTotal && (
        <div className="flex justify-between gap-3 pt-3 border-t border-slate-200 text-base">
          <span className="text-slate-500 font-bold">Tổng thanh toán</span>
          <span className="font-bold text-red-600 text-lg">
            {formatConfirmedAmount(totalAmount)}
          </span>
        </div>
      )}
    </div>
  );
}

function PaymentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isHydrated, executeWithAuth } = useAuthSession();
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
  const shipmentDraft = draft?.kind === 'shipment' ? draft : null;
  const bookingDraft = draft && draft.kind !== 'shipment' ? draft : null;
  const isRoundTripBooking = Boolean(
    bookingDraft &&
    bookingDraft.tripType === 'round-trip' &&
    bookingDraft.legs.length > 1,
  );
  const paymentResourceKey = shipmentDraft
    ? `shipment:${shipmentDraft.shipmentId}:${shipmentDraft.paymentId}:${shipmentDraft.waybillCode}:${shipmentDraft.sender.phoneNumber}`
    : isRoundTripBooking && bookingDraft
      ? `round-trip:${bookingDraft.id}:${bookingDraft.legs[0]?.bookingId}:${bookingDraft.legs[1]?.bookingId}:${bookingDraft.passenger.phoneNumber}`
      : bookingDraft?.bookingId
        ? `booking:${bookingDraft.bookingId}:${bookingDraft.bookingCode}:${bookingDraft.passenger.phoneNumber}`
        : null;

  const [selectedLegIndex, setSelectedLegIndex] = useState(0);
  const [legSnapshots, setLegSnapshots] = useState<[PaymentReadSnapshot | null, PaymentReadSnapshot | null]>([null, null]);
  const [clockTick, setClockTick] = useState(0);
  const [paymentReadSnapshot, setPaymentReadSnapshot] =
    useState<PaymentReadSnapshot | null>(null);
  const [showTripDetailModal, setShowTripDetailModal] = useState(false);
  const [showCargoDetailModal, setShowCargoDetailModal] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const activeLegSnapshot = isRoundTripBooking ? legSnapshots[selectedLegIndex] : null;
  const activePaymentReadSnapshot = isRoundTripBooking
    ? (activeLegSnapshot?.draftId === draft?.id &&
       activeLegSnapshot?.resourceKey === paymentResourceKey
        ? activeLegSnapshot
        : null)
    : (paymentReadSnapshot?.draftId === draft?.id &&
       paymentReadSnapshot?.resourceKey === paymentResourceKey &&
       paymentReadSnapshot?.expectedOrderCode === draft?.orderCode?.trim() &&
       paymentReadSnapshot?.expectedTotalAmount === draft?.totalFare
        ? paymentReadSnapshot
        : null);

  useEffect(() => {
    if (!showTripDetailModal && !showCargoDetailModal) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setShowTripDetailModal(false);
      setShowCargoDetailModal(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [showTripDetailModal, showCargoDetailModal]);
  const hasValidBookingId = isRoundTripBooking && bookingDraft
    ? Number.isSafeInteger(bookingDraft.legs[0]?.bookingId) &&
      (bookingDraft.legs[0]?.bookingId ?? 0) > 0 &&
      Number.isSafeInteger(bookingDraft.legs[1]?.bookingId) &&
      (bookingDraft.legs[1]?.bookingId ?? 0) > 0
    : Number.isSafeInteger(bookingDraft?.bookingId) && (bookingDraft?.bookingId ?? 0) > 0;
  const hasValidShipmentPayment = Boolean(
    shipmentDraft &&
    Number.isSafeInteger(shipmentDraft.shipmentId) && shipmentDraft.shipmentId > 0 &&
    Number.isSafeInteger(shipmentDraft.paymentId) && shipmentDraft.paymentId > 0,
  );
  const hasValidPaymentResource = hasValidBookingId || hasValidShipmentPayment;
  const paymentExpiresAt = activePaymentReadSnapshot?.paymentExpiresAt ?? null;
  const serverTimeOffsetMs =
    activePaymentReadSnapshot?.serverTimeOffsetMs ?? 0;
  const paymentTerminalStatus = activePaymentReadSnapshot?.terminalStatus ??
    (draft && !hasValidPaymentResource ? 'verification-needed' : null);
  const deadlineMs = paymentExpiresAt ? Date.parse(paymentExpiresAt) : NaN;
  const timeLeft = clockTick > 0 && Number.isFinite(deadlineMs)
    ? Math.max(
        0,
        Math.ceil(
          (deadlineMs - (clockTick + serverTimeOffsetMs)) / 1000,
        ),
      )
    : null;
  const shipmentPaymentStatusPresentation = getShipmentPaymentStatusPresentation(
    activePaymentReadSnapshot !== null,
    paymentTerminalStatus ?? (timeLeft === 0 ? 'verification-needed' : null),
  );

  const readBookingDetailTarget = useCallback(
    (
      target: { bookingId?: number; bookingCode?: string; phoneNumber: string },
      signal?: AbortSignal,
    ) => {
      const bookingId = target.bookingId;
      if (!bookingId) {
        throw new Error('Mã đặt vé không hợp lệ.');
      }
      if (isAuthenticated) {
        return executeWithAuth((token) =>
          bookingsApi.getPublicBookingDetail(bookingId, {
            signal,
            accessToken: token,
            bookingCode: target.bookingCode,
            phoneNumber: target.phoneNumber,
          }),
        );
      }
      return bookingsApi.getPublicBookingDetail(bookingId, {
        signal,
        bookingCode: target.bookingCode,
        phoneNumber: target.phoneNumber,
      });
    },
    [executeWithAuth, isAuthenticated],
  );

  const readBookingDetail = useCallback(
    (bookingDraft: BookingPaymentDraft, signal?: AbortSignal) => {
      return readBookingDetailTarget(
        {
          bookingId: bookingDraft.bookingId,
          bookingCode: bookingDraft.bookingCode,
          phoneNumber: bookingDraft.passenger.phoneNumber,
        },
        signal,
      );
    },
    [readBookingDetailTarget],
  );

  useEffect(() => {
    if (!paymentExpiresAt) return;
    const timer = setInterval(() => setClockTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [paymentExpiresAt]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const transferContent = activePaymentReadSnapshot?.orderCode ?? '';

  const vietQrConfig = useMemo(
    () =>
      readVietQrAccountConfig({
        bankId: process.env.NEXT_PUBLIC_SEPAY_BANK_ID,
        accountNumber: process.env.NEXT_PUBLIC_SEPAY_ACCOUNT_NUMBER,
        accountName: process.env.NEXT_PUBLIC_SEPAY_ACCOUNT_NAME,
      }),
    [],
  );
  const vietQrUrl = useMemo(
    () =>
      activePaymentReadSnapshot &&
      !activePaymentReadSnapshot.terminalStatus &&
      activePaymentReadSnapshot.totalAmount !== null &&
      activePaymentReadSnapshot.totalAmount > 0
        ? createVietQrImageUrl(
            vietQrConfig,
            activePaymentReadSnapshot.totalAmount,
            transferContent,
          )
        : null,
    [activePaymentReadSnapshot, transferContent, vietQrConfig],
  );

  // Booking and shipment both use API-verified order details before the shared QR is rendered.
  useEffect(() => {
    const currentDraft: PaymentDraft | null = shipmentDraft ?? bookingDraft;
    const expectedOrderCode = isRoundTripBooking
      ? bookingDraft?.legs[0]?.orderCode?.trim()
      : currentDraft?.orderCode?.trim();
    const resourceKey = paymentResourceKey;
    if (
      !isHydrated ||
      !currentDraft?.id ||
      (!vietQrConfig && currentDraft.totalFare !== 0) ||
      !hasValidPaymentResource ||
      (!expectedOrderCode && !isRoundTripBooking) ||
      !resourceKey
    ) return;

    let isSubscribed = true;
    let hasNavigated = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    let activeRequestController: AbortController | null = null;
    let observedDeadlineMs: number | null = null;
    let observedServerTimeOffsetMs = 0;
    let consecutiveFailures = 0;
    let consecutivePublicLookupRateLimits = 0;

    const stopWithStatus = (
      terminalStatus: NonNullable<PaymentReadSnapshot['terminalStatus']>,
      paymentExpiresAt: string | null = null,
    ) => {
      if (!isSubscribed) return;
      if (isRoundTripBooking && bookingDraft) {
        setLegSnapshots([
          {
            draftId: currentDraft.id,
            resourceKey,
            expectedOrderCode: bookingDraft.legs[0]?.orderCode?.trim() || '',
            expectedTotalAmount: bookingDraft.legs[0]?.subtotal ?? 0,
            orderCode: null,
            totalAmount: null,
            promotionCode: null,
            originalTicketSubtotal: null,
            discountAmount: null,
            ticketSubtotal: null,
            cargoFee: null,
            paymentExpiresAt,
            serverTimeOffsetMs: observedServerTimeOffsetMs,
            terminalStatus,
          },
          {
            draftId: currentDraft.id,
            resourceKey,
            expectedOrderCode: bookingDraft.legs[1]?.orderCode?.trim() || '',
            expectedTotalAmount: bookingDraft.legs[1]?.subtotal ?? 0,
            orderCode: null,
            totalAmount: null,
            promotionCode: null,
            originalTicketSubtotal: null,
            discountAmount: null,
            ticketSubtotal: null,
            cargoFee: null,
            paymentExpiresAt,
            serverTimeOffsetMs: observedServerTimeOffsetMs,
            terminalStatus,
          },
        ]);
      }
      setPaymentReadSnapshot({
        draftId: currentDraft.id,
        resourceKey,
        expectedOrderCode: expectedOrderCode || '',
        expectedTotalAmount: currentDraft.totalFare,
        orderCode: null,
        totalAmount: null,
        promotionCode: null,
        originalTicketSubtotal: null,
        discountAmount: null,
        ticketSubtotal: null,
        cargoFee: null,
        paymentExpiresAt,
        serverTimeOffsetMs: observedServerTimeOffsetMs,
        terminalStatus,
      });
    };

    const scheduleNextRead = (delayMs: number, stopAtDeadlineIfRetryBlocked = false) => {
      if (!isSubscribed) return;
      const remainingMs = observedDeadlineMs === null
        ? null
        : observedDeadlineMs - (Date.now() + observedServerTimeOffsetMs);
      if (remainingMs !== null && remainingMs <= 0) {
        stopWithStatus(
          'verification-needed',
          new Date(observedDeadlineMs!).toISOString(),
        );
        return;
      }
      if (stopAtDeadlineIfRetryBlocked && remainingMs !== null && delayMs >= remainingMs) {
        timeout = setTimeout(
          () => stopWithStatus('verification-needed', new Date(observedDeadlineMs!).toISOString()),
          remainingMs,
        );
        return;
      }
      const nextDelay = remainingMs === null ? delayMs : Math.min(delayMs, remainingMs);
      timeout = setTimeout(() => void checkPaymentStatus(), nextDelay);
    };

    const checkPaymentStatus = async () => {
      const requestController = new AbortController();
      activeRequestController = requestController;
      let usedPublicShipmentLookup = false;
      let rateLimitBackoffMs: number | null = null;
      const requestTimeout = setTimeout(
        () => requestController.abort(),
        PAYMENT_STATUS_REQUEST_TIMEOUT_MS,
      );
      try {
        if (isRoundTripBooking && bookingDraft) {
          const [res0, res1] = await Promise.all([
            readBookingDetailTarget(
              {
                bookingId: bookingDraft.legs[0].bookingId,
                bookingCode: bookingDraft.legs[0].bookingCode,
                phoneNumber: bookingDraft.passenger.phoneNumber,
              },
              requestController.signal,
            ),
            readBookingDetailTarget(
              {
                bookingId: bookingDraft.legs[1].bookingId,
                bookingCode: bookingDraft.legs[1].bookingCode,
                phoneNumber: bookingDraft.passenger.phoneNumber,
              },
              requestController.signal,
            ),
          ]);

          if (!isSubscribed) return;
          if (requestController.signal.aborted) throw new Error('Payment status request timed out');

          const b0 = res0.data;
          const b1 = res1.data;

          const amount0 = readNonNegativeAmount(b0.totalAmount);
          const amount1 = readNonNegativeAmount(b1.totalAmount);

          const isMatching0 =
            b0.bookingId === bookingDraft.legs[0].bookingId &&
            (!bookingDraft.legs[0].bookingCode || b0.bookingCode === bookingDraft.legs[0].bookingCode) &&
            b0.orderCode === bookingDraft.legs[0].orderCode &&
            amount0 === bookingDraft.legs[0].subtotal;

          const isMatching1 =
            b1.bookingId === bookingDraft.legs[1].bookingId &&
            (!bookingDraft.legs[1].bookingCode || b1.bookingCode === bookingDraft.legs[1].bookingCode) &&
            b1.orderCode === bookingDraft.legs[1].orderCode &&
            amount1 === bookingDraft.legs[1].subtotal;

          if (!isMatching0 || !isMatching1 || amount0 === null || amount1 === null) {
            stopWithStatus('verification-needed');
            return;
          }

          const getLegTerminalStatus = (b: typeof b0): PaymentReadSnapshot['terminalStatus'] => {
            if (b.requiresReconciliation === true || b.paymentStatus === 'CAN_DOI_SOAT') return 'reconciliation-required';
            if (['DA_HUY', 'HUY'].includes(b.status ?? '') || ['DA_HUY', 'HUY'].includes(b.paymentStatus ?? '')) return 'cancelled';
            if (b.status === 'EXPIRED' || b.status === 'HET_HAN' || b.paymentStatus === 'HET_HAN') return 'expired';
            if (b.status === 'FAILED' || ['THAT_BAI', 'DA_THAT_BAI', 'FAILED'].includes(b.paymentStatus ?? '')) return 'failed';
            if (b.paymentStatus === 'DA_THANH_TOAN' && ['DA_THANH_TOAN', 'HOAN_TAT'].includes(b.status ?? '')) return 'paid';
            return null;
          };

          const term0 = getLegTerminalStatus(b0);
          const term1 = getLegTerminalStatus(b1);

          const isPaid0 = term0 === 'paid';
          const isPaid1 = term1 === 'paid';

          if (isPaid0 && isPaid1 && !hasNavigated) {
            hasNavigated = true;
            stopWithStatus('paid');
            router.push(`/invoice/${bookingDraft.legs[0].bookingId}?returnBookingId=${bookingDraft.legs[1].bookingId}`);
            return;
          }

          if (term0 === 'reconciliation-required' || term1 === 'reconciliation-required') {
            stopWithStatus('reconciliation-required', b0.paymentExpiresAt || b1.paymentExpiresAt || null);
            return;
          }
          if (term0 === 'cancelled' || term1 === 'cancelled') {
            stopWithStatus('cancelled', b0.paymentExpiresAt || b1.paymentExpiresAt || null);
            return;
          }
          if (term0 === 'expired' && term1 === 'expired') {
            stopWithStatus('expired', b0.paymentExpiresAt || b1.paymentExpiresAt || null);
            return;
          }
          if (term0 === 'failed' || term1 === 'failed') {
            stopWithStatus('failed', b0.paymentExpiresAt || b1.paymentExpiresAt || null);
            return;
          }

          const serverTimeMs0 = typeof b0.serverTime === 'string' ? Date.parse(b0.serverTime) : NaN;
          const serverTimeMs1 = typeof b1.serverTime === 'string' ? Date.parse(b1.serverTime) : NaN;
          const serverOffset0 = Number.isFinite(serverTimeMs0) ? serverTimeMs0 - Date.now() : 0;
          const serverOffset1 = Number.isFinite(serverTimeMs1) ? serverTimeMs1 - Date.now() : 0;

          const snap0: PaymentReadSnapshot = {
            draftId: currentDraft.id,
            resourceKey,
            expectedOrderCode: bookingDraft.legs[0].orderCode!,
            expectedTotalAmount: bookingDraft.legs[0].subtotal,
            orderCode: b0.orderCode!,
            totalAmount: amount0,
            promotionCode: typeof b0.promotionCode === 'string' ? b0.promotionCode : null,
            originalTicketSubtotal: readNonNegativeAmount(b0.originalTicketSubtotal),
            discountAmount: readNonNegativeAmount(b0.discountAmount),
            ticketSubtotal: readNonNegativeAmount(b0.ticketSubtotal),
            cargoFee: readNonNegativeAmount(b0.cargoFee),
            paymentExpiresAt: b0.paymentExpiresAt ?? null,
            serverTimeOffsetMs: serverOffset0,
            terminalStatus: term0,
          };

          const snap1: PaymentReadSnapshot = {
            draftId: currentDraft.id,
            resourceKey,
            expectedOrderCode: bookingDraft.legs[1].orderCode!,
            expectedTotalAmount: bookingDraft.legs[1].subtotal,
            orderCode: b1.orderCode!,
            totalAmount: amount1,
            promotionCode: typeof b1.promotionCode === 'string' ? b1.promotionCode : null,
            originalTicketSubtotal: readNonNegativeAmount(b1.originalTicketSubtotal),
            discountAmount: readNonNegativeAmount(b1.discountAmount),
            ticketSubtotal: readNonNegativeAmount(b1.ticketSubtotal),
            cargoFee: readNonNegativeAmount(b1.cargoFee),
            paymentExpiresAt: b1.paymentExpiresAt ?? null,
            serverTimeOffsetMs: serverOffset1,
            terminalStatus: term1,
          };

          setLegSnapshots([snap0, snap1]);
          setClockTick(Date.now());
          consecutiveFailures = 0;

          const deadline0Ms = typeof b0.paymentExpiresAt === 'string' ? Date.parse(b0.paymentExpiresAt) : NaN;
          const deadline1Ms = typeof b1.paymentExpiresAt === 'string' ? Date.parse(b1.paymentExpiresAt) : NaN;
          const validDeadlines = [deadline0Ms, deadline1Ms].filter((d) => Number.isFinite(d));
          if (validDeadlines.length > 0) {
            observedDeadlineMs = Math.min(...validDeadlines);
            observedServerTimeOffsetMs = serverOffset0;
          }

          if (isPaid0 && !isPaid1) {
            setSelectedLegIndex((prev) => (prev === 0 ? 1 : prev));
          } else if (isPaid1 && !isPaid0) {
            setSelectedLegIndex((prev) => (prev === 1 ? 0 : prev));
          }
        } else {
        let payload: PaymentStatusPayload;
        if (shipmentDraft) {
          const readVerifiedShipmentLookup = async (): Promise<PaymentStatusPayload> => {
            usedPublicShipmentLookup = true;
            const response = await shipmentsApi.lookupShipment(
              {
                waybillCode: shipmentDraft.waybillCode,
                phoneNumber: shipmentDraft.sender.phoneNumber,
              },
              { signal: requestController.signal },
            );
            return {
              ...response.data,
              shipmentStatus: response.data.status,
              provider: response.data.paymentMethod,
            };
          };

          if (isAuthenticated) {
            try {
              const response = await executeWithAuth((token) =>
                paymentsApi.getPaymentStatus(shipmentDraft.paymentId, {
                  signal: requestController.signal,
                  accessToken: token,
                }),
              );
              payload = response.data;
            } catch (error) {
              if (!isForbiddenApiResponse(error)) throw error;
              payload = await readVerifiedShipmentLookup();
            }
          } else {
            payload = await readVerifiedShipmentLookup();
          }
        } else if (bookingDraft) {
          const response = await readBookingDetail(bookingDraft, requestController.signal);
          const booking = response.data;
          payload = {
            bookingId: booking.bookingId,
            bookingCode: booking.bookingCode,
            orderCode: booking.orderCode,
            amount: booking.totalAmount,
            orderStatus: booking.paymentStatus,
            bookingStatus: booking.status,
            paymentStatus: booking.paymentStatus,
            paymentExpiresAt: booking.paymentExpiresAt,
            serverTime: booking.serverTime,
            promotionCode: booking.promotionCode,
            originalTicketSubtotal: booking.originalTicketSubtotal,
            discountAmount: booking.discountAmount,
            ticketSubtotal: booking.ticketSubtotal,
            cargoFee: booking.cargoFee,
          };
        } else {
          stopWithStatus('verification-needed');
          return;
        }

        if (!isSubscribed) return;
        if (requestController.signal.aborted) throw new Error('Payment status request timed out');
        if (usedPublicShipmentLookup) consecutivePublicLookupRateLimits = 0;
        const amount = readNonNegativeAmount(payload.amount ?? payload.totalAmount);
        const hasMatchingPayment = shipmentDraft
          ? payload.orderCode === expectedOrderCode &&
            amount === currentDraft.totalFare &&
            payload.provider === 'SEPAY' &&
            (usedPublicShipmentLookup
              ? payload.waybillCode === shipmentDraft.waybillCode
              : payload.paymentId === shipmentDraft.paymentId &&
                payload.shipmentId === shipmentDraft.shipmentId)
          : Boolean(
            bookingDraft &&
            payload.bookingId === bookingDraft.bookingId &&
            (!bookingDraft.bookingCode || payload.bookingCode === bookingDraft.bookingCode) &&
            payload.orderCode === expectedOrderCode &&
            amount === currentDraft.totalFare,
          );

        if (!hasMatchingPayment || amount === null) {
          stopWithStatus('verification-needed');
          return;
        }

        const paymentStatus = payload.paymentStatus ?? '';
        const orderStatus = payload.orderStatus ?? '';
        const bookingStatus = payload.bookingStatus ?? '';
        const shipmentStatus = payload.shipmentStatus ?? '';
        if (payload.requiresReconciliation === true || paymentStatus === 'CAN_DOI_SOAT') {
          stopWithStatus('reconciliation-required', payload.paymentExpiresAt ?? null);
          return;
        }
        if (
          [orderStatus, bookingStatus, shipmentStatus].some((status) =>
            ['DA_HUY', 'HUY'].includes(status),
          )
        ) {
          stopWithStatus('cancelled', payload.paymentExpiresAt ?? null);
          return;
        }
        if (
          payload.status === 'EXPIRED' ||
          paymentStatus === 'HET_HAN' ||
          orderStatus === 'HET_HAN' ||
          bookingStatus === 'HET_HAN'
        ) {
          stopWithStatus('expired', payload.paymentExpiresAt ?? null);
          return;
        }
        if (
          payload.status === 'FAILED' ||
          ['THAT_BAI', 'DA_THAT_BAI', 'FAILED'].includes(paymentStatus)
        ) {
          stopWithStatus('failed', payload.paymentExpiresAt ?? null);
          return;
        }

        const isShipmentPaid = Boolean(
          shipmentDraft &&
          paymentStatus === 'THANH_CONG' &&
          orderStatus === 'DA_THANH_TOAN' &&
          shipmentStatus !== 'DA_HUY',
        );
        const isBookingPaid = Boolean(
          bookingDraft &&
          bookingStatus === 'DA_THANH_TOAN' &&
          paymentStatus === 'DA_THANH_TOAN',
        );
        if (isShipmentPaid) {
          const serverTimeMs = typeof payload.serverTime === 'string'
            ? Date.parse(payload.serverTime)
            : NaN;
          observedServerTimeOffsetMs = Number.isFinite(serverTimeMs)
            ? serverTimeMs - Date.now()
            : 0;
          setPaymentReadSnapshot({
            draftId: currentDraft.id,
            resourceKey,
            expectedOrderCode: expectedOrderCode || '',
            expectedTotalAmount: currentDraft.totalFare,
            orderCode: expectedOrderCode || null,
            totalAmount: amount,
            promotionCode: null,
            originalTicketSubtotal: null,
            discountAmount: null,
            ticketSubtotal: null,
            cargoFee: null,
            paymentExpiresAt: payload.paymentExpiresAt ?? null,
            serverTimeOffsetMs: observedServerTimeOffsetMs,
            terminalStatus: 'paid',
          });
          return;
        }
        if (isBookingPaid && bookingDraft?.bookingId && !hasNavigated) {
          hasNavigated = true;
          stopWithStatus('paid');
          router.push(`/invoice/${bookingDraft.bookingId}`);
          return;
        }

        if (shipmentDraft) {
          const isPending =
            orderStatus === 'CHO_THANH_TOAN' &&
            ['DANG_XU_LY', 'CHO_THANH_TOAN'].includes(paymentStatus);
          if (!isPending) {
            stopWithStatus('verification-needed', payload.paymentExpiresAt ?? null);
            return;
          }
        } else if (
          ![orderStatus, bookingStatus].every((status) => status === 'CHO_THANH_TOAN')
        ) {
          stopWithStatus('verification-needed');
          return;
        }

        if (amount === 0) {
          stopWithStatus('verification-needed');
          return;
        }
        const deadline = payload.paymentExpiresAt;
        const serverTime = payload.serverTime;
        const responseDeadlineMs = typeof deadline === 'string' ? Date.parse(deadline) : NaN;
        const serverTimeMs = typeof serverTime === 'string' ? Date.parse(serverTime) : NaN;
        if (!Number.isFinite(responseDeadlineMs) || !Number.isFinite(serverTimeMs)) {
          stopWithStatus('verification-needed');
          return;
        }

        observedDeadlineMs = responseDeadlineMs;
        observedServerTimeOffsetMs = serverTimeMs - Date.now();
        consecutiveFailures = 0;
        setClockTick(Date.now());
        if (responseDeadlineMs <= serverTimeMs) {
          stopWithStatus('expired', deadline!);
          return;
        }

        setPaymentReadSnapshot({
          draftId: currentDraft.id,
          resourceKey,
          expectedOrderCode: expectedOrderCode || '',
          expectedTotalAmount: currentDraft.totalFare,
          orderCode: payload.orderCode!,
          totalAmount: amount,
          promotionCode: bookingDraft && typeof payload.promotionCode === 'string'
            ? payload.promotionCode : null,
          originalTicketSubtotal: readNonNegativeAmount(payload.originalTicketSubtotal),
          discountAmount: readNonNegativeAmount(payload.discountAmount),
          ticketSubtotal: readNonNegativeAmount(payload.ticketSubtotal),
          cargoFee: readNonNegativeAmount(payload.cargoFee),
          paymentExpiresAt: deadline!,
          serverTimeOffsetMs: observedServerTimeOffsetMs,
          terminalStatus: null,
        });
        }
      } catch (error) {
        if (!isSubscribed) return;
        consecutiveFailures += 1;
        if (
          usedPublicShipmentLookup &&
          error instanceof ApiError &&
          error.status === 429
        ) {
          consecutivePublicLookupRateLimits += 1;
          const retryAfterMs = readRetryAfterDelayMs(error.retryAfter);
          rateLimitBackoffMs = retryAfterMs === null
            ? PUBLIC_SHIPMENT_RATE_LIMIT_BACKOFF_MS *
              2 ** Math.min(consecutivePublicLookupRateLimits - 1, 3)
            : Math.max(PUBLIC_SHIPMENT_POLL_INTERVAL_MS, retryAfterMs);
        }
        if (observedDeadlineMs === null && consecutiveFailures >= MAX_INITIAL_STATUS_READ_FAILURES) {
          stopWithStatus('verification-needed');
          return;
        }
      } finally {
        clearTimeout(requestTimeout);
        if (activeRequestController === requestController) {
          activeRequestController = null;
        }
      }

      if (!isSubscribed || hasNavigated) return;
      const defaultDelayMs = usedPublicShipmentLookup
        ? PUBLIC_SHIPMENT_POLL_INTERVAL_MS
        : observedDeadlineMs === null
          ? PAYMENT_POLL_INTERVAL_MS * 2 ** Math.max(0, consecutiveFailures - 1)
          : PAYMENT_POLL_INTERVAL_MS;
      const delayMs = rateLimitBackoffMs ?? defaultDelayMs;
      scheduleNextRead(
        usedPublicShipmentLookup ? delayMs : Math.min(delayMs, 15_000),
        rateLimitBackoffMs !== null,
      );
    };

    void checkPaymentStatus();

    return () => {
      isSubscribed = false;
      if (timeout) clearTimeout(timeout);
      activeRequestController?.abort();
    };
  }, [
    bookingDraft,
    executeWithAuth,
    hasValidPaymentResource,
    isAuthenticated,
    isHydrated,
    isRoundTripBooking,
    paymentResourceKey,
    readBookingDetail,
    readBookingDetailTarget,
    router,
    shipmentDraft,
    vietQrConfig,
  ]);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const totalFareText = activePaymentReadSnapshot?.totalAmount === null ||
    activePaymentReadSnapshot?.totalAmount === undefined
      ? '—'
      : `${activePaymentReadSnapshot.totalAmount.toLocaleString('vi-VN')}đ`;
  const hasVerifiedPaymentAmount = Boolean(
    activePaymentReadSnapshot &&
    (!activePaymentReadSnapshot.terminalStatus || activePaymentReadSnapshot.terminalStatus === 'paid') &&
    activePaymentReadSnapshot.totalAmount !== null,
  );
  const formatConfirmedAmount = (amount: number | null | undefined) =>
    !hasVerifiedPaymentAmount
      ? 'Đang xác minh từ máy chủ'
      : amount === null || amount === undefined
        ? 'Chưa có dữ liệu từ máy chủ'
        : `${amount.toLocaleString('vi-VN')}đ`;
  const confirmedCargoFee = activePaymentReadSnapshot?.cargoFee ?? null;
  const shouldShowCargoFeeBreakdown = Boolean(
    bookingDraft?.luggage ||
    (hasVerifiedPaymentAmount && confirmedCargoFee !== null && confirmedCargoFee > 0),
  );
  const cargoFeeText = !hasVerifiedPaymentAmount
    ? 'Đang xác minh từ máy chủ'
    : confirmedCargoFee === null
      ? 'Chưa có dữ liệu cước từ máy chủ'
      : confirmedCargoFee === 0
        ? 'Miễn phí'
        : `${confirmedCargoFee.toLocaleString('vi-VN')}đ`;
  const cargoFeeClassName = confirmedCargoFee === null
    ? 'text-slate-600'
    : confirmedCargoFee === 0
      ? 'text-emerald-600'
      : 'text-red-600';
  const cargoPackageCount = getCargoPackageCount(bookingDraft?.luggage?.items);
  const paymentResourceLabel = shipmentDraft ? 'phiếu gửi hàng' : 'đơn đặt vé';
  const priceBreakdownProps = {
    originalTicketSubtotal: activePaymentReadSnapshot?.originalTicketSubtotal,
    discountAmount: activePaymentReadSnapshot?.discountAmount,
    promotionCode: activePaymentReadSnapshot?.promotionCode,
    ticketSubtotal: activePaymentReadSnapshot?.ticketSubtotal,
    totalAmount: activePaymentReadSnapshot?.totalAmount,
    hasVerifiedPaymentAmount,
    showCargoFee: shouldShowCargoFeeBreakdown,
    cargoFeeText,
    cargoFeeClassName,
    formatConfirmedAmount,
  };

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

  const methods = [
    {
      id: 'vietqr',
      name: 'Chuyển khoản VietQR',
      extra: 'Quét mã VietQR bằng mọi ứng dụng Ngân hàng (MB, VCB, BIDV, Techcombank...).',
    },
  ];

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
                      Quét mã và hoàn tất chuyển khoản trong ứng dụng ngân hàng
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Cột 2: QR Code & Thông tin chuyển khoản */}
          <div className="flex-1 flex flex-col items-center">
            {isRoundTripBooking && bookingDraft && (
              <div className="flex items-center justify-center gap-3 mb-6 w-full max-w-[520px]">
                {bookingDraft.legs.map((leg, idx) => {
                  const isSelected = selectedLegIndex === idx;
                  const snap = legSnapshots[idx];
                  const isPaid = snap?.terminalStatus === 'paid';
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedLegIndex(idx)}
                      className={`flex-1 py-3 px-4 rounded-2xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'border-brand bg-brand/5 ring-2 ring-brand/20 shadow-sm'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-black uppercase text-accent">
                          {idx === 0 ? 'Chặng 1: Lượt đi' : 'Chặng 2: Lượt về'}
                        </span>
                        {isPaid ? (
                          <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                            ✓ Đã thanh toán
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                            Chờ thanh toán
                          </span>
                        )}
                      </div>
                      <div className="font-bold text-slate-800 text-sm truncate">
                        {leg.route}
                      </div>
                      <div className="text-xs font-black text-red-600 mt-1">
                        {leg.subtotal.toLocaleString('vi-VN')}đ
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            <p className="text-sm font-semibold text-slate-500 mb-1">
              {isRoundTripBooking
                ? `Thanh toán ${selectedLegIndex === 0 ? 'Chặng 1 (Lượt đi)' : 'Chặng 2 (Lượt về)'}`
                : 'Tổng thanh toán'}
            </p>
            <h1 className="text-5xl font-bold text-red-600 mb-2 tracking-tight">
              {totalFareText}
            </h1>
            {isRoundTripBooking && (
              <p className="text-xs font-semibold text-slate-500 mb-6">
                Tổng 2 chặng: <strong className="text-slate-700">{bookingDraft?.totalFare.toLocaleString('vi-VN')}đ</strong>
              </p>
            )}

            <div className="w-full max-w-[520px] bg-white rounded-3xl p-7 shadow-sm border border-slate-200 flex flex-col items-center">
              {paymentExpiresAt && !paymentTerminalStatus && (
                <p className="text-sm font-semibold text-amber-600 mb-4">
                  {timeLeft === null
                    ? 'Đang kiểm tra thời hạn thanh toán.'
                    : `Thời gian thanh toán còn lại ${formatTime(timeLeft)}`}
                </p>
              )}

              {/* VietQR Image động thật - Kích thước lớn dễ quét */}
              <div className="w-full max-w-[420px] aspect-square border-2 border-slate-200 rounded-3xl p-3 mb-6 bg-white flex items-center justify-center overflow-hidden shadow-2xs">
                {paymentTerminalStatus ? (
                  paymentTerminalStatus === 'paid' && isRoundTripBooking ? (
                    <div className="flex flex-col items-center gap-3 py-6 px-4 text-center">
                      <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                        <CheckCircle2 className="w-8 h-8" />
                      </div>
                      <p className="text-base font-bold text-emerald-800">
                        {selectedLegIndex === 0 ? 'Chặng 1 (Lượt đi)' : 'Chặng 2 (Lượt về)'} đã được thanh toán thành công!
                      </p>
                      {selectedLegIndex === 0 && legSnapshots[1]?.terminalStatus !== 'paid' ? (
                        <button
                          type="button"
                          onClick={() => setSelectedLegIndex(1)}
                          className="mt-2 h-10 px-5 rounded-xl bg-brand hover:bg-brand-hover text-white text-xs font-bold transition-colors shadow-sm cursor-pointer"
                        >
                          Chuyển sang Chặng 2 (Lượt về) để thanh toán
                        </button>
                      ) : selectedLegIndex === 1 && legSnapshots[0]?.terminalStatus !== 'paid' ? (
                        <button
                          type="button"
                          onClick={() => setSelectedLegIndex(0)}
                          className="mt-2 h-10 px-5 rounded-xl bg-brand hover:bg-brand-hover text-white text-xs font-bold transition-colors shadow-sm cursor-pointer"
                        >
                          Chuyển sang Chặng 1 (Lượt đi) để thanh toán
                        </button>
                      ) : null}
                    </div>
                  ) : (
                  <p
                    role={paymentTerminalStatus === 'verification-needed' ? 'alert' : 'status'}
                    aria-live="polite"
                    className="px-5 text-center text-sm font-semibold text-amber-800"
                  >
                    {paymentTerminalStatus === 'verification-needed'
                      ? `Không thể xác minh thông tin ${paymentResourceLabel} với máy chủ. Mã QR đã được ẩn; vui lòng tải lại trang hoặc liên hệ hỗ trợ.`
                      : paymentTerminalStatus === 'cancelled'
                        ? `${shipmentDraft ? 'Phiếu gửi hàng' : 'Đơn đặt vé'} đã bị hủy. Mã QR thanh toán không còn khả dụng.`
                        : paymentTerminalStatus === 'reconciliation-required'
                          ? `Khoản tiền đã được ghi nhận nhưng ${shipmentDraft ? 'phiếu gửi hàng' : 'đơn đặt vé'} đã bị hủy. Đơn không được khôi phục; vui lòng liên hệ hỗ trợ để đối soát.`
                        : paymentTerminalStatus === 'failed'
                          ? `Giao dịch thanh toán ${paymentResourceLabel} chưa thành công. Mã QR đã được ẩn; vui lòng liên hệ hỗ trợ.`
                          : paymentTerminalStatus === 'paid'
                            ? `Thanh toán ${paymentResourceLabel} đã được xác nhận.`
                            : `${shipmentDraft ? 'Phiếu gửi hàng' : 'Đơn đặt vé'} đã hết hạn. Mã QR thanh toán không còn khả dụng.`}
                  </p>
                  )
                ) : timeLeft === 0 ? (
                  <p role="status" aria-live="polite" className="px-5 text-center text-sm font-semibold text-amber-800">
                    Đang xác nhận trạng thái đơn sau thời hạn thanh toán.
                  </p>
                ) : vietQrUrl ? (
                  <img
                    src={vietQrUrl}
                    alt="Mã QR thanh toán VietQR"
                    className="w-full h-full object-contain"
                  />
                ) : !vietQrConfig ? (
                  <div
                    role="alert"
                    className="flex flex-col items-center gap-3 px-5 text-center text-sm font-semibold text-amber-800"
                  >
                    <Info aria-hidden="true" className="h-6 w-6 shrink-0" />
                    <p>
                      VietQR chưa được cấu hình đầy đủ nên chưa thể hiển thị mã thanh toán. Vui lòng liên hệ bộ phận hỗ trợ.
                    </p>
                  </div>
                ) : !draft.orderCode?.trim() ? (
                  <div role="alert" className="px-5 text-center text-sm font-semibold text-amber-800">
                    {shipmentDraft
                      ? 'Phiếu gửi hàng chưa có mã giao dịch hợp lệ nên chưa thể tạo mã VietQR. Vui lòng liên hệ bộ phận hỗ trợ.'
                      : 'Đơn đặt vé chưa có mã giao dịch hợp lệ nên chưa thể tạo mã VietQR. Vui lòng liên hệ bộ phận hỗ trợ.'}
                  </div>
                ) : (
                  <p role="status" aria-live="polite" className="px-5 text-center text-sm font-semibold text-slate-600">
                    Đang xác minh đơn hàng với máy chủ. Mã QR sẽ hiển thị sau khi thông tin được xác nhận.
                  </p>
                )}
              </div>

              {vietQrUrl && !paymentTerminalStatus && (
                <p
                  role="status"
                  aria-live="polite"
                  className="w-full max-w-[420px] mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm font-semibold text-amber-800"
                >
                  Đang chờ hệ thống xác nhận thanh toán từ ngân hàng.
                </p>
              )}

              {/* Thông tin chuyển khoản sao chép */}
              {vietQrUrl && vietQrConfig && !paymentTerminalStatus && timeLeft !== 0 && (
                <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-5 text-[13px] space-y-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Mã ngân hàng:</span>
                    <span className="font-bold text-slate-900">{vietQrConfig.bankId}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Chủ tài khoản:</span>
                    <span className="font-bold text-slate-900">{vietQrConfig.accountName}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Số tài khoản:</span>
                    <div className="flex items-center gap-2">
                      <strong className="text-slate-950 font-black tracking-wide">
                        {vietQrConfig.accountNumber}
                      </strong>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(vietQrConfig.accountNumber, 'stk')}
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
              )}

              <div className="w-full text-center">
                {vietQrUrl && !paymentTerminalStatus && timeLeft !== 0 && (
                  <p className="text-xs font-semibold text-slate-600 mb-3 flex items-center justify-center gap-1.5">
                    <ScanLine className="w-4 h-4 text-emerald-600 inline-block" />
                    Quét mã qua bất kỳ App Ngân hàng
                  </p>
                )}

              </div>
            </div>
          </div>

          {/* Cột 3: Thông tin chi tiết */}
          <div className="w-full lg:w-[360px] shrink-0 space-y-4">
            {shipmentDraft ? (
              <>
                <section className="bg-white rounded-xl border border-slate-200 p-5">
                  <h3 className="font-bold text-slate-900 text-base mb-4">
                    Thông tin phiếu gửi
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="block text-xs font-semibold text-slate-500 mb-1">
                        Mã vận đơn
                      </span>
                      <strong className="break-all text-brand">{shipmentDraft.waybillCode}</strong>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-500">Tuyến xe</span>
                      <strong className="min-w-0 max-w-[65%] break-words text-right text-slate-800">
                        {shipmentDraft.route.origin} → {shipmentDraft.route.destination}
                      </strong>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-500">Trạng thái thanh toán</span>
                      <strong className={`min-w-0 max-w-[65%] text-right ${shipmentPaymentStatusPresentation.className}`}>
                        {shipmentPaymentStatusPresentation.label}
                      </strong>
                    </div>
                  </div>
                </section>

                <section className="bg-white rounded-xl border border-slate-200 p-5">
                  <h3 className="font-bold text-slate-900 text-base mb-4">Người gửi</h3>
                  <div className="space-y-2.5 text-sm">
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-500">Họ và tên</span>
                      <strong className="min-w-0 max-w-[65%] break-words text-right text-slate-800">{shipmentDraft.sender.fullName}</strong>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-500">Số điện thoại</span>
                      <strong className="min-w-0 max-w-[65%] break-words text-right text-slate-800">{shipmentDraft.sender.phoneNumber}</strong>
                    </div>
                    {shipmentDraft.sender.email && (
                      <div className="flex justify-between gap-3">
                        <span className="text-slate-500">Email</span>
                        <strong className="min-w-0 max-w-[65%] break-all text-right text-slate-800">{shipmentDraft.sender.email}</strong>
                      </div>
                    )}
                  </div>
                </section>

                <section className="bg-white rounded-xl border border-slate-200 p-5">
                  <h3 className="font-bold text-slate-900 text-base mb-4">Người nhận</h3>
                  <div className="space-y-2.5 text-sm">
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-500">Họ và tên</span>
                      <strong className="min-w-0 max-w-[65%] break-words text-right text-slate-800">{shipmentDraft.receiver.fullName}</strong>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-500">Số điện thoại</span>
                      <strong className="min-w-0 max-w-[65%] break-words text-right text-slate-800">{shipmentDraft.receiver.phoneNumber}</strong>
                    </div>
                    <div className="border-t border-slate-100 pt-3">
                      <p className="text-xs font-semibold text-slate-500 mb-1">Điểm gửi</p>
                      <strong className="block break-words text-slate-800">{shipmentDraft.pickupPoint.name}</strong>
                      <p className="mt-1 break-words text-xs text-slate-600">{shipmentDraft.pickupPoint.address}</p>
                    </div>
                    <div className="border-t border-slate-100 pt-3">
                      <p className="text-xs font-semibold text-slate-500 mb-1">Điểm nhận</p>
                      <strong className="block break-words text-slate-800">{shipmentDraft.dropoffPoint.name}</strong>
                      <p className="mt-1 break-words text-xs text-slate-600">{shipmentDraft.dropoffPoint.address}</p>
                    </div>
                  </div>
                </section>

                <section className="bg-white rounded-xl border border-slate-200 p-5">
                  <h3 className="font-bold text-slate-900 text-base mb-4">Chi tiết giá</h3>
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="text-slate-500">Cước gửi hàng</span>
                    <strong className="text-right text-slate-900">{formatConfirmedAmount(activePaymentReadSnapshot?.totalAmount)}</strong>
                  </div>
                </section>
              </>
            ) : bookingDraft ? (
              <>
            {/* Thông tin hành khách */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="font-bold text-slate-900 text-base mb-4">
                Thông tin hành khách
              </h3>
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Họ và tên</span>
                  <span className="font-bold text-slate-800">
                    {bookingDraft.passenger.fullName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Số điện thoại</span>
                  <span className="font-bold text-slate-800">
                    {bookingDraft.passenger.phoneNumber}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Email</span>
                  <span className="font-bold text-slate-800">
                    {bookingDraft.passenger.email}
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
                {bookingDraft.legs.map((leg, index) => (
                  <div
                    key={index}
                    className={
                      index > 0 ? 'pt-4 border-t border-slate-200' : ''
                    }
                  >
                    {bookingDraft.legs.length > 1 && (
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
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Card Hàng gửi hầm xe */}
            {bookingDraft.luggage && (
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-center justify-between mb-3.5">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 text-base">
                      Hàng gửi hầm xe
                    </h3>
                  </div>
                  {bookingDraft.luggage.items && bookingDraft.luggage.items.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowCargoDetailModal(true)}
                      className="text-xs text-rose-500 font-bold underline cursor-pointer hover:text-rose-600 transition-colors"
                      aria-label="Chi tiết hàng gửi hầm xe"
                    >
                      Chi tiết
                    </button>
                  )}
                </div>

                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200/60 text-xs font-bold text-rose-700 mb-3.5">
                  <span>{cargoPackageCount === null ? 'Chưa rõ số kiện' : `${cargoPackageCount} kiện`}</span>
                  <span>•</span>
                  <span>{bookingDraft.luggage.weight}kg</span>
                </div>

                {bookingDraft.luggage.items && bookingDraft.luggage.items.length > 0 && (
                  <div className="space-y-2">
                    {bookingDraft.luggage.items.slice(0, 2).map((item, idx) => {
                      const quantity = getCargoItemQuantity(item.quantity);
                      const actualW = typeof item.weight === 'number' && Number.isFinite(item.weight)
                        ? item.weight
                        : null;
                      const totalItemWeight = actualW === null || quantity === null
                        ? null
                        : actualW * quantity;
                      const volW =
                        item.length && item.width && item.height
                          ? Math.round(((item.length * item.width * item.height) / 5000) * 10) / 10
                          : 0;
                      const isMotorbike = item.type === 'Xe máy';
                      const isBicycle = item.type === 'Xe đạp';

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
                                    : `Loại hàng ${idx + 1}: ${item.type || 'Vali'}`}
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
                            <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                              <span>Số lượng: {quantity ?? 'chưa rõ'} kiện</span>
                              {actualW !== null && (
                                <>
                                  <span className="text-slate-300">•</span>
                                  <span>
                                    {actualW} kg/kiện
                                    {totalItemWeight === null
                                      ? ' • chưa rõ khối lượng tổng'
                                      : ` • ${totalItemWeight} kg tổng`}
                                  </span>
                                </>
                              )}
                              {item.length && item.width && item.height && (
                                <>
                                  <span className="text-slate-300">•</span>
                                  <span>{item.length}×{item.width}×{item.height}cm</span>
                                </>
                              )}
                              {isBicycle && <span>• Gửi hầm xe</span>}
                              {isMotorbike && item.licensePlate && (
                                <span className="bg-slate-200 text-slate-800 font-bold px-1.5 py-0.2 rounded text-[10px]">
                                  Biển số: {item.licensePlate}
                                </span>
                              )}
                            </div>
                            {actualW !== null && volW > actualW && (
                              <span className="inline-block mt-1 text-[10px] text-accent font-bold bg-accent/10 px-1.5 py-0.2 rounded">
                                (Tính cước: {volW}kg quy đổi/kiện)
                              </span>
                            )}
                          </div>
                          <span className="text-slate-500 font-semibold text-right shrink-0">
                            Cước tính chung theo đơn
                          </span>
                        </div>
                      );
                    })}
                    {bookingDraft.luggage.items.length > 2 && (
                      <button
                        type="button"
                        onClick={() => setShowCargoDetailModal(true)}
                        className="text-[11px] text-slate-500 hover:text-slate-800 font-medium pt-1 text-center w-full block cursor-pointer"
                      >
                        + Xem thêm {bookingDraft.luggage.items.length - 2} loại hàng khác
                      </button>
                    )}
                  </div>
                )}
                <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80 flex items-center justify-between gap-3 text-xs">
                  <span className="text-slate-600 font-medium">Cước hàng theo đơn</span>
                  <strong className={`${cargoFeeClassName} font-extrabold text-right`}>
                    {cargoFeeText}
                  </strong>
                </div>
              </div>
            )}

            {/* Chi tiết giá */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="font-bold text-slate-900 text-base mb-4 flex items-center gap-2">
                Chi tiết giá
                <Info className="w-4 h-4 text-red-600" />
              </h3>
              <PaymentPriceBreakdownRows {...priceBreakdownProps} />
            </div>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {/* Modal Chi tiết chuyến đi thật */}
      {showTripDetailModal && bookingDraft && (
        <div
          className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-xs px-4 py-6 flex items-center justify-center animate-in fade-in duration-200"
          onClick={() => setShowTripDetailModal(false)}
        >
          <div
            className="w-full max-w-[440px] rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 flex flex-col max-h-[85vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="payment-trip-detail-heading"
            tabIndex={-1}
          >
            {/* Header Modal */}
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-accent/10 text-accent flex items-center justify-center font-bold text-xs">
                  <Info className="w-4 h-4" />
                </span>
                <h3 id="payment-trip-detail-heading" className="text-base font-black text-slate-900">
                  Chi tiết chuyến đi
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowTripDetailModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Đóng chi tiết chuyến đi"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Modal */}
            <div className="py-4 space-y-4 overflow-y-auto pr-0.5 text-xs">
              {bookingDraft.legs.map((leg, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-4 space-y-3"
                >
                  {bookingDraft.legs.length > 1 && (
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
                  <span className="font-bold text-slate-900">{bookingDraft.passenger.fullName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Số điện thoại:</span>
                  <span className="font-bold text-slate-900">{bookingDraft.passenger.phoneNumber}</span>
                </div>
                {bookingDraft.passenger.email && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Email:</span>
                    <span className="font-medium text-slate-700">{bookingDraft.passenger.email}</span>
                  </div>
                )}
              </div>

              {/* Thông tin hành lý nếu có */}
              {bookingDraft.luggage && (
                <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 space-y-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Hành lý ký gửi hầm xe
                  </span>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Khối lượng:</span>
                    <span className="font-bold text-slate-900">
                      {cargoPackageCount === null ? 'Chưa rõ số kiện' : `${cargoPackageCount} kiện`}
                      {' • '}{bookingDraft.luggage.weight} kg
                    </span>
                  </div>
                  {bookingDraft.luggage.items && bookingDraft.luggage.items.length > 0 && (
                    <div className="space-y-2 border-t border-slate-100 pt-2">
                      <span className="text-slate-500 font-medium">Chi tiết kiện hàng:</span>
                      {bookingDraft.luggage.items.map((item, index) => {
                        const quantity = getCargoItemQuantity(item.quantity);
                        const unitWeight = typeof item.weight === 'number' && Number.isFinite(item.weight)
                          ? item.weight
                          : null;
                        const itemName = item.type === 'Xe máy'
                          ? `Xe máy: ${item.motorbikeType || 'Xe số'}`
                          : item.type === 'Xe đạp'
                            ? `Xe đạp: ${item.bicycleType || 'Xe đạp thường'}`
                            : item.type || 'Kiện hàng';

                        return (
                          <div key={item.id || index} className="rounded-lg bg-slate-50 px-3 py-2">
                            <div className="font-semibold text-slate-800">{itemName}</div>
                            <div className="mt-0.5 text-slate-600">
                              {quantity === null ? 'Chưa rõ số lượng kiện' : `${quantity} kiện`}
                              {unitWeight === null
                                ? ''
                                : quantity === null
                                  ? ` • ${unitWeight} kg/kiện • chưa rõ khối lượng tổng`
                                  : ` • ${unitWeight} kg/kiện • ${unitWeight * quantity} kg`}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className="rounded-xl border border-slate-200/90 bg-white p-3.5">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-3">
                  Chi tiết giá từ máy chủ
                </span>
                <PaymentPriceBreakdownRows {...priceBreakdownProps} showTotal={false} />
              </div>

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
      {showCargoDetailModal && bookingDraft?.luggage?.items && (
        <div
          className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-xs px-4 py-6 flex items-center justify-center animate-in fade-in duration-200"
          onClick={() => setShowCargoDetailModal(false)}
        >
          <div
            className="w-full max-w-[440px] rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 flex flex-col max-h-[85vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="payment-cargo-detail-heading"
            tabIndex={-1}
          >
            <div className="flex items-start justify-between gap-3 pb-3.5 border-b border-slate-100 shrink-0">
              <div>
                <h3 id="payment-cargo-detail-heading" className="text-base font-black text-slate-900">
                  Chi tiết hàng gửi hầm xe
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Tổng cộng: {cargoPackageCount === null ? 'Chưa rõ số kiện' : `${cargoPackageCount} kiện`}
                  {' • '}{bookingDraft.luggage.weight}kg
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCargoDetailModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Đóng chi tiết hàng gửi hầm xe"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-3.5 space-y-2.5 overflow-y-auto pr-0.5 max-h-[55vh]">
              {bookingDraft.luggage.items.map((item, idx) => {
                const quantity = getCargoItemQuantity(item.quantity);
                const actualW = typeof item.weight === 'number' && Number.isFinite(item.weight)
                  ? item.weight
                  : null;
                const volW =
                  item.length && item.width && item.height
                    ? Math.round(((item.length * item.width * item.height) / 5000) * 10) / 10
                    : 0;
                const isMotorbike = item.type === 'Xe máy';
                const isBicycle = item.type === 'Xe đạp';

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
                              : `Loại hàng ${idx + 1}: ${item.type || 'Vali'}`}
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
                          <span>Số lượng: {quantity ?? 'chưa rõ'} xe</span>
                          {actualW !== null && (
                            <span>
                              • {actualW} kg/kiện • {quantity === null ? 'chưa rõ khối lượng tổng' : `${actualW * quantity} kg tổng`}
                            </span>
                          )}
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
                          <span>Số lượng: {quantity ?? 'chưa rõ'} xe</span>
                          <span className="text-slate-300">•</span>
                          <span>Gửi hầm xe</span>
                          {actualW !== null && (
                            <span>
                              • {actualW} kg/kiện • {quantity === null ? 'chưa rõ khối lượng tổng' : `${actualW * quantity} kg tổng`}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="mt-1 text-slate-600 flex items-center gap-2 flex-wrap text-[11px]">
                          <span>Số lượng: {quantity ?? 'chưa rõ'} kiện</span>
                          <span>•</span>
                          {actualW === null
                            ? <span>Chưa có khối lượng</span>
                            : <span>Khối lượng: {actualW} kg/kiện • {quantity === null ? 'chưa rõ khối lượng tổng' : `${actualW * quantity} kg tổng`}</span>}
                          {item.length && item.width && item.height && (
                            <>
                              <span>•</span>
                              <span>{item.length}×{item.width}×{item.height}cm</span>
                            </>
                          )}
                        </div>
                      )}

                      {actualW !== null && volW > actualW && (
                        <p className="mt-1 text-[10px] text-accent font-semibold bg-accent/10 px-1.5 py-0.5 rounded inline-block">
                          Tính cước: {volW}kg quy đổi
                        </p>
                      )}

                      {item.note && (
                        <p className="mt-1 text-[11px] text-slate-500 italic">
                          &quot;{item.note}&quot;
                        </p>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-slate-500 font-semibold">
                        Cước tính chung theo đơn
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between shrink-0">
              <div>
                <span className="text-[11px] text-slate-500 font-medium block">
                  Cước hàng theo đơn
                </span>
                <strong className={`${cargoFeeClassName} font-extrabold text-sm`}>
                  {cargoFeeText}
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
