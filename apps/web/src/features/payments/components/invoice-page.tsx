'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import {
  Download,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Package,
  Printer,
  MapPin,
  Ticket,
  Copy,
  Check,
  Bus,
  RotateCcw,
  User,
  Phone,
  Mail,
  CreditCard,
} from 'lucide-react';
import { bookingsApi } from '@/features/account/services/bookings.api';
import { useAuthSession } from '@/features/auth/auth-session';
import { PAYMENT_DRAFT_STORAGE_PREFIX } from '@/features/booking/services/payment-draft';

interface InvoiceLeg {
  bookingCode?: string;
  route: string;
  departureTime: string;
  seats: string[];
  pickup: string;
  dropoff: string;
  busCompanyName: string;
  vehicleType: string;
  fare?: number;
}

interface InvoiceTicket {
  ticketId: number;
  ticketCode: string;
  seatNumber: string;
  seatPosition?: string;
  price: number;
  status: string;
  legIndex?: number;
  legTitle?: string;
  bookingCode?: string;
  route?: string;
  departureTime?: string;
  pickup?: string;
  dropoff?: string;
  busCompanyName?: string;
}

interface InvoiceModel {
  bookingCode: string;
  returnBookingCode?: string;
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
  tickets: InvoiceTicket[];
  activeSeatNumbers: string[];
  cancelledSeatNumbers: string[];
  paymentStatus: string;
  paymentMethod: string;
  createdAt: string;
}

function formatInvoiceDateTime(timeStr?: string | null): string {
  if (!timeStr) return '—';
  const date = new Date(timeStr);
  if (Number.isNaN(date.getTime())) return timeStr;
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${hours}:${minutes} • ${day}/${month}/${year}`;
}

function CopyCodeBlock({
  label,
  code,
  copiedCode,
  onCopy,
}: {
  label?: string;
  code: string;
  copiedCode: string | null;
  onCopy: (code: string) => void;
}) {
  const isCopied = copiedCode === code;
  return (
    <button
      type="button"
      onClick={() => onCopy(code)}
      className="group relative w-full text-left bg-white hover:bg-blue-50/40 border border-slate-200 hover:border-blue-400 p-3 rounded-xl transition-all cursor-pointer shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
      title="Nhấp để sao chép"
    >
      <div className="flex items-center justify-between mb-1.5 gap-2">
        {label && (
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            {label}
          </span>
        )}
        <div className="flex items-center gap-1 text-[11px] font-semibold shrink-0">
          {isCopied ? (
            <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md font-bold flex items-center gap-1">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              Đã sao chép!
            </span>
          ) : (
            <span className="text-slate-400 group-hover:text-blue-600 group-hover:bg-blue-50 border border-transparent group-hover:border-blue-200 px-2 py-0.5 rounded-md flex items-center gap-1 transition-all">
              <Copy className="w-3.5 h-3.5" />
              <span className="text-[10px]">Sao chép</span>
            </span>
          )}
        </div>
      </div>
      <div className="font-mono font-bold text-xs sm:text-sm text-slate-900 break-all select-all tracking-wide">
        {code}
      </div>
    </button>
  );
}

function CopyBadge({
  code,
  copiedCode,
  onCopy,
  className = '',
  variant = 'light',
}: {
  code: string;
  copiedCode: string | null;
  onCopy: (code: string) => void;
  className?: string;
  variant?: 'light' | 'dark';
}) {
  const isCopied = copiedCode === code;
  const isDark = variant === 'dark';

  return (
    <button
      type="button"
      onClick={() => onCopy(code)}
      className={`group relative inline-flex items-center gap-2 px-2.5 py-1 rounded-lg font-mono text-xs transition-all cursor-pointer ${
        isDark
          ? 'bg-white/10 hover:bg-white/20 border border-white/15 hover:border-blue-400/50 text-white shadow-2xs'
          : 'bg-slate-100 hover:bg-blue-50 hover:text-blue-700 border border-slate-200/80 hover:border-blue-300 text-slate-900'
      } ${className}`}
      title="Nhấp để sao chép"
    >
      <span
        className={`font-bold break-all ${
          isDark
            ? 'text-white group-hover:text-blue-200'
            : 'text-slate-900 group-hover:text-blue-800'
        }`}
      >
        {code}
      </span>
      {isCopied ? (
        <span
          className={`text-[10px] font-sans font-bold flex items-center gap-1 shrink-0 ${
            isDark
              ? 'text-emerald-300 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-500/40'
              : 'text-emerald-700'
          }`}
        >
          <Check className="w-3 h-3 text-emerald-400" />
          <span>Đã sao chép!</span>
        </span>
      ) : (
        <span
          className={`text-[10px] font-sans font-medium flex items-center gap-1 shrink-0 transition-all ${
            isDark
              ? 'text-slate-300 group-hover:text-white bg-white/5 group-hover:bg-blue-500/30 px-1.5 py-0.5 rounded border border-white/10 group-hover:border-blue-400/40'
              : 'text-slate-400 group-hover:text-blue-600'
          }`}
        >
          <Copy
            className={`w-3 h-3 ${
              isDark
                ? 'text-slate-300 group-hover:text-blue-300'
                : 'text-slate-400 group-hover:text-blue-600'
            }`}
          />
          <span>Sao chép</span>
        </span>
      )}
    </button>
  );
}

function BoardingPassCard({
  ticket: t,
  invoice,
  copiedCode,
  handleCopyCode,
  isRoundTrip,
}: {
  ticket: InvoiceTicket;
  invoice: InvoiceModel;
  copiedCode: string | null;
  handleCopyCode: (code: string) => void;
  isRoundTrip?: boolean;
}) {
  const isCancelled = t.status === 'HUY' || t.status === 'CANCELLED';
  const isReturn = t.legIndex === 1;
  const singleQrData = encodeURIComponent(
    `https://vexgo.vn/tra-cuu-ve?code=${t.ticketCode}`,
  );
  const singleQrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${singleQrData}`;
  const legBookingCode =
    t.bookingCode ||
    (isReturn && invoice.returnBookingCode
      ? invoice.returnBookingCode
      : invoice.bookingCode);

  return (
    <div
      className={`rounded-2xl border bg-white overflow-hidden transition-shadow duration-200 ${
        isCancelled
          ? 'border-rose-200 bg-white/80 opacity-90'
          : 'border-slate-200 hover:shadow-md'
      }`}
    >
      {/* Header Thẻ Vé */}
      <div className="bg-slate-900 text-white px-5 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center shrink-0 text-white">
            {isReturn ? (
              <RotateCcw className="w-3.5 h-3.5" />
            ) : (
              <Bus className="w-3.5 h-3.5" />
            )}
          </div>
          <div>
            <span className="text-[10px] font-medium text-slate-400 block leading-tight">
              Thẻ lên xe điện tử
            </span>
            <span className="text-sm font-bold text-white tracking-tight">
              {t.busCompanyName || invoice.busCompanyName}
              {t.legTitle && (
                <span className="ml-2 text-xs font-normal text-slate-300">
                  • {t.legTitle}: {t.route}
                </span>
              )}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end">
          <span className="text-[10px] uppercase font-semibold text-slate-400 block tracking-wider mb-1">
            Mã đặt chỗ {isReturn ? 'Lượt về' : isRoundTrip ? 'Lượt đi' : ''}
          </span>
          <CopyBadge
            code={legBookingCode}
            copiedCode={copiedCode}
            onCopy={handleCopyCode}
            variant="dark"
            className="text-xs sm:text-sm"
          />
        </div>
      </div>

      {/* Thân thẻ vé & Cuống vé */}
      <div className="flex flex-col md:flex-row relative">
        {/* Thân vé (Main Body) */}
        <div className="p-5 sm:p-6 flex-1 space-y-4">
          {/* Hàng 1: Số ghế & Vị trí & Giá */}
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3.5">
            <div>
              <span className="text-xs font-medium text-slate-400 block mb-0.5">
                Số ghế hành khách
              </span>
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                  {t.seatNumber}
                </span>
                {t.seatPosition && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                    {t.seatPosition}
                  </span>
                )}
                {t.legTitle && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                    {t.legTitle}
                  </span>
                )}
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs font-medium text-slate-400 block mb-0.5">
                Giá vé
              </span>
              <span className="text-lg font-bold text-slate-900">
                {typeof t.price === 'number'
                  ? t.price === 0
                    ? '0đ (Miễn phí)'
                    : `${t.price.toLocaleString('vi-VN')}đ`
                  : '—'}
              </span>
              <div className="mt-0.5">
                <span
                  className={`text-xs font-medium inline-flex items-center gap-1 ${
                    isCancelled ? 'text-rose-600' : 'text-emerald-700'
                  }`}
                >
                  {isCancelled ? '● Đã hủy' : '● Có hiệu lực'}
                </span>
              </div>
            </div>
          </div>

          {/* Hàng 2: Thông tin hành khách */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-slate-400 font-bold uppercase tracking-wider block mb-0.5">
                Hành khách
              </span>
              <strong className="text-slate-800 text-sm break-words">{invoice.passengerName}</strong>
            </div>
            <div>
              <span className="text-slate-400 font-bold uppercase tracking-wider block mb-0.5">
                Số điện thoại
              </span>
              <span className="text-slate-800 font-semibold">{invoice.passengerPhone}</span>
            </div>
          </div>

          {/* Hàng 3: Điểm đón & Trả */}
          <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100 space-y-2.5 text-xs">
            <div className="flex items-start gap-2">
              <Clock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-slate-400 font-medium block">Khởi hành lúc</span>
                <strong className="text-slate-800 text-sm">
                  {t.departureTime || invoice.legs[t.legIndex ?? 0]?.departureTime}
                </strong>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="text-slate-400 font-medium block">Điểm đón</span>
                <span className="font-bold text-slate-800 leading-snug">
                  {t.pickup || invoice.legs[t.legIndex ?? 0]?.pickup}
                </span>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-[#f05123] shrink-0 mt-0.5" />
              <div>
                <span className="text-slate-400 font-medium block">Điểm trả</span>
                <span className="font-bold text-slate-800 leading-snug">
                  {t.dropoff || invoice.legs[t.legIndex ?? 0]?.dropoff}
                </span>
              </div>
            </div>
          </div>

          {/* Hàng 4: Mã vé & Hành động */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase">Mã vé:</span>
              <CopyBadge
                code={t.ticketCode}
                copiedCode={copiedCode}
                onCopy={handleCopyCode}
              />
            </div>
          </div>
        </div>

        {/* Nếp xé răng cưa & Notch Cutout (Giữa thân và cuống vé) */}
        <div className="relative flex md:flex-col items-center justify-center">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 md:top-0 md:-left-3 md:translate-x-0 w-6 h-6 rounded-full bg-slate-100 border border-slate-200/80 z-10" />
          <div className="w-full md:w-px h-px md:h-full border-t md:border-t-0 md:border-l-2 border-dashed border-slate-200 my-3 md:my-0" />
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 md:bottom-0 md:-left-3 md:translate-x-0 w-6 h-6 rounded-full bg-slate-100 border border-slate-200/80 z-10" />
        </div>

        {/* Cuống vé QR Code (Stub) */}
        <div className="md:w-56 shrink-0 p-6 rounded-2xl md:rounded-l-none bg-slate-50/70 border-t md:border-t-0 border-slate-100 flex flex-col items-center justify-center text-center">
          <div className="relative p-2.5 bg-white rounded-2xl border border-slate-200 shadow-xs">
            <img
              src={singleQrSrc}
              alt={`Mã QR vé ${t.seatNumber}`}
              className={`w-32 h-32 object-contain ${
                isCancelled ? 'opacity-20 grayscale' : ''
              }`}
            />
            {isCancelled && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="px-3 py-1 rounded-md bg-rose-600 text-white text-xs font-black uppercase tracking-wider rotate-[-12deg] shadow-lg">
                  ĐÃ HỦY
                </span>
              </div>
            )}
          </div>
          <p className="text-xs font-black text-slate-900 mt-3 font-mono">
            Ghế {t.seatNumber}
            {t.legTitle ? ` (${t.legTitle})` : ''}
          </p>
          <span className="text-[11px] text-slate-500 font-medium leading-relaxed mt-1 block">
            {isCancelled
              ? 'Vé đã hủy, không còn hiệu lực lên xe'
              : 'Xuất trình mã QR này cho tài xế quét khi lên xe'}
          </span>
        </div>
      </div>
    </div>
  );
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
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [activeLegFilter, setActiveLegFilter] = useState<'all' | 0 | 1>('all');
  const loadKey = `${rawId}:${isAuthenticated}:${isHydrated}`;

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

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
      let returnGuestCredentials:
        | { bookingCode: string; phoneNumber: string }
        | undefined;
      let discoveredReturnBookingId: number | null = null;

      for (let index = 0; index < sessionStorage.length; index++) {
        const key = sessionStorage.key(index);
        if (!key?.startsWith(PAYMENT_DRAFT_STORAGE_PREFIX)) continue;
        const raw = sessionStorage.getItem(key);
        if (!raw) continue;
        try {
          const parsed: {
            bookingId?: number;
            bookingCode?: string;
            tripType?: string;
            passenger?: { phoneNumber?: string };
            legs?: Array<{ bookingId?: number; bookingCode?: string }>;
          } = JSON.parse(raw);
          const isMasterMatch = parsed.bookingId === numericBookingId;
          const isLeg0Match = parsed.legs?.[0]?.bookingId === numericBookingId;
          if (isMasterMatch || isLeg0Match) {
            const bCode = parsed.bookingCode || parsed.legs?.[0]?.bookingCode;
            const phone = parsed.passenger?.phoneNumber;
            if (bCode?.trim() && phone?.trim()) {
              guestCredentials = {
                bookingCode: bCode,
                phoneNumber: phone,
              };
            }
            if (parsed.tripType === 'round-trip' && parsed.legs?.[1]?.bookingId) {
              discoveredReturnBookingId = parsed.legs[1].bookingId;
              if (parsed.legs[1].bookingCode?.trim() && phone?.trim()) {
                returnGuestCredentials = {
                  bookingCode: parsed.legs[1].bookingCode,
                  phoneNumber: phone,
                };
              }
            }
            break;
          }
        } catch {
          // Ignore malformed drafts; the backend still decides access.
        }
      }

      const returnBookingIdFromSearch =
        typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search).get('returnBookingId')
          : null;
      const targetReturnBookingId = returnBookingIdFromSearch
        ? Number(returnBookingIdFromSearch)
        : discoveredReturnBookingId;
      const hasReturnBooking = Boolean(
        targetReturnBookingId &&
        Number.isSafeInteger(targetReturnBookingId) &&
        targetReturnBookingId > 0 &&
        targetReturnBookingId !== numericBookingId,
      );

      try {
        if (hasReturnBooking) {
          const [response, returnResponse] = await Promise.all([
            isAuthenticated
              ? executeWithAuth((token) =>
                  bookingsApi.getPublicBookingDetail(numericBookingId, {
                    signal: controller.signal,
                    accessToken: token,
                    ...guestCredentials,
                  }),
                )
              : bookingsApi.getPublicBookingDetail(numericBookingId, {
                  signal: controller.signal,
                  ...guestCredentials,
                }),
            isAuthenticated
              ? executeWithAuth((token) =>
                  bookingsApi.getPublicBookingDetail(targetReturnBookingId!, {
                    signal: controller.signal,
                    accessToken: token,
                    ...returnGuestCredentials,
                  }),
                )
              : bookingsApi.getPublicBookingDetail(targetReturnBookingId!, {
                  signal: controller.signal,
                  ...returnGuestCredentials,
                }),
          ]);
          if (controller.signal.aborted) return;

          const booking = response.data;
          const returnBooking = returnResponse.data;

          if (booking.bookingId !== numericBookingId || returnBooking.bookingId !== targetReturnBookingId) {
            throw new Error('Thông tin đơn đặt vé không khớp với yêu cầu.');
          }

          const isPaid1 =
            booking.paymentStatus === 'DA_THANH_TOAN' &&
            ['DA_THANH_TOAN', 'HOAN_TAT'].includes(booking.status ?? '');
          const isPaid2 =
            returnBooking.paymentStatus === 'DA_THANH_TOAN' &&
            ['DA_THANH_TOAN', 'HOAN_TAT'].includes(returnBooking.status ?? '');

          if (!isPaid1 || !isPaid2) {
            throw new Error('Thanh toán cả 2 chặng chưa hoàn tất. Vé sẽ xuất hiện sau khi hệ thống xác nhận thanh toán.');
          }

          const totalAmount = Number(booking.totalAmount) + Number(returnBooking.totalAmount);
          const ticketSubtotal =
            Number(booking.ticketSubtotal ?? booking.totalAmount) +
            Number(returnBooking.ticketSubtotal ?? returnBooking.totalAmount);
          const originalTicketSubtotal =
            (Number.isFinite(Number(booking.originalTicketSubtotal))
              ? Number(booking.originalTicketSubtotal)
              : Number(booking.ticketSubtotal ?? booking.totalAmount)) +
            (Number.isFinite(Number(returnBooking.originalTicketSubtotal))
              ? Number(returnBooking.originalTicketSubtotal)
              : Number(returnBooking.ticketSubtotal ?? returnBooking.totalAmount));
          const discountAmount =
            Number(booking.discountAmount || 0) + Number(returnBooking.discountAmount || 0);
          const cargoFee = (Number(booking.cargoFee) || 0) + (Number(returnBooking.cargoFee) || 0);

          const cargoItems = [
            ...(booking.cargoItems || []).map((item) => ({
              name: item.name || 'Hàng gửi kèm (Lượt đi)',
              quantity: item.quantity ?? 1,
              weight: item.weight ?? 0,
              category: item.category,
              categoryName: item.categoryName || 'Hàng gửi kèm',
            })),
            ...(returnBooking.cargoItems || []).map((item) => ({
              name: item.name || 'Hàng gửi kèm (Lượt về)',
              quantity: item.quantity ?? 1,
              weight: item.weight ?? 0,
              category: item.category,
              categoryName: item.categoryName || 'Hàng gửi kèm',
            })),
          ];

          const outTickets = (booking.tickets || []).map((t) => ({
            ticketId: t.ticketId,
            ticketCode: t.ticketCode,
            seatNumber: t.seatNumber || '—',
            seatPosition: t.seatPosition || '',
            price: Number(t.price || 0),
            status: t.status,
            legIndex: 0,
            legTitle: 'Lượt đi',
            bookingCode: booking.bookingCode || '',
            route: booking.route || '—',
            departureTime: formatTimeText(booking.departureTime),
            pickup: booking.pickup || booking.origin || '—',
            dropoff: booking.dropoff || booking.destination || '—',
            busCompanyName: booking.busCompanyName || '—',
          }));

          const retTickets = (returnBooking.tickets || []).map((t) => ({
            ticketId: t.ticketId,
            ticketCode: t.ticketCode,
            seatNumber: t.seatNumber || '—',
            seatPosition: t.seatPosition || '',
            price: Number(t.price || 0),
            status: t.status,
            legIndex: 1,
            legTitle: 'Lượt về',
            bookingCode: returnBooking.bookingCode || '',
            route: returnBooking.route || '—',
            departureTime: formatTimeText(returnBooking.departureTime),
            pickup: returnBooking.pickup || returnBooking.origin || '—',
            dropoff: returnBooking.dropoff || returnBooking.destination || '—',
            busCompanyName: returnBooking.busCompanyName || '—',
          }));

          setInvoice({
            bookingCode: booking.bookingCode || '',
            returnBookingCode: returnBooking.bookingCode || '',
            orderCode:
              (booking.orderCode === returnBooking.orderCode
                ? booking.orderCode
                : `${booking.orderCode || ''} • ${returnBooking.orderCode || ''}`) || '',
            tripType: 'round-trip',
            busCompanyName:
              booking.busCompanyName === returnBooking.busCompanyName
                ? (booking.busCompanyName || '—')
                : `${booking.busCompanyName || '—'} & ${returnBooking.busCompanyName || '—'}`,
            passengerName: booking.passenger?.fullName || returnBooking.passenger?.fullName || '—',
            passengerPhone: booking.passenger?.phoneNumber || returnBooking.passenger?.phoneNumber || '—',
            passengerEmail: booking.passenger?.email || returnBooking.passenger?.email || '',
            totalAmount,
            promotionCode:
              (typeof booking.promotionCode === 'string' ? booking.promotionCode : null) ||
              (typeof returnBooking.promotionCode === 'string' ? returnBooking.promotionCode : null),
            originalTicketSubtotal,
            discountAmount,
            ticketSubtotal,
            cargoFee,
            cargoItems,
            legs: [
              {
                bookingCode: booking.bookingCode || '',
                route: booking.route || '—',
                departureTime: formatTimeText(booking.departureTime),
                seats: booking.seatNumbers || [],
                pickup: booking.pickup || booking.origin || '—',
                dropoff: booking.dropoff || booking.destination || '—',
                busCompanyName: booking.busCompanyName || '—',
                vehicleType: booking.vehicleType || '—',
                fare: Number(booking.ticketSubtotal ?? booking.totalAmount),
              },
              {
                bookingCode: returnBooking.bookingCode || '',
                route: returnBooking.route || '—',
                departureTime: formatTimeText(returnBooking.departureTime),
                seats: returnBooking.seatNumbers || [],
                pickup: returnBooking.pickup || returnBooking.origin || '—',
                dropoff: returnBooking.dropoff || returnBooking.destination || '—',
                busCompanyName: returnBooking.busCompanyName || '—',
                vehicleType: returnBooking.vehicleType || '—',
                fare: Number(returnBooking.ticketSubtotal ?? returnBooking.totalAmount),
              },
            ],
            tickets: [...outTickets, ...retTickets],
            activeSeatNumbers: [
              ...((booking.activeSeatNumbers as string[]) || (booking.seatNumbers || [])),
              ...((returnBooking.activeSeatNumbers as string[]) || (returnBooking.seatNumbers || [])),
            ],
            cancelledSeatNumbers: [
              ...((booking.cancelledSeatNumbers as string[]) || []),
              ...((returnBooking.cancelledSeatNumbers as string[]) || []),
            ],
            paymentStatus: booking.paymentStatus!,
            paymentMethod: booking.paymentMethod || returnBooking.paymentMethod || '—',
            createdAt: booking.createdAt || '—',
          });
          setError(null);
        } else {
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
              bookingCode: booking.bookingCode || '',
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
          tickets: (booking.tickets || []).map((t) => ({
            ticketId: t.ticketId,
            ticketCode: t.ticketCode,
            seatNumber: t.seatNumber || '—',
            seatPosition: t.seatPosition || '',
            price: Number(t.price || 0),
            status: t.status,
            bookingCode: booking.bookingCode || '',
          })),
          activeSeatNumbers:
            (booking.activeSeatNumbers as string[]) ||
            (booking.seatNumbers || []),
          cancelledSeatNumbers:
            (booking.cancelledSeatNumbers as string[]) || [],
          paymentStatus: booking.paymentStatus!,
          paymentMethod: booking.paymentMethod || '—',
          createdAt: booking.createdAt || '—',
        });
        setError(null);
        }
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
  const outboundTickets =
    invoice.tickets && invoice.tickets.length > 0
      ? invoice.tickets.filter((t) => (t.legIndex ?? 0) === 0)
      : [
          {
            ticketId: 0,
            ticketCode: invoice.bookingCode,
            seatNumber: invoice.legs[0]?.seats.join(', ') || 'Tiêu chuẩn',
            price: invoice.ticketSubtotal || invoice.totalAmount,
            status: 'DA_THANH_TOAN',
            legIndex: 0,
            legTitle: 'Lượt đi',
          },
        ];
  const returnTickets =
    invoice.tickets && invoice.tickets.length > 0
      ? invoice.tickets.filter((t) => t.legIndex === 1)
      : invoice.legs[1]
        ? [
            {
              ticketId: 1,
              ticketCode: invoice.returnBookingCode || invoice.bookingCode,
              seatNumber: invoice.legs[1]?.seats.join(', ') || 'Tiêu chuẩn',
              price: invoice.legs[1]?.fare || 0,
              status: 'DA_THANH_TOAN',
              legIndex: 1,
              legTitle: 'Lượt về',
            },
          ]
        : [];
  const qrData = encodeURIComponent(`https://vexgo.vn/tra-cuu-ve?code=${invoice.bookingCode}`);
  const qrImageSrc = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${qrData}`;

  return (
    <div className="min-h-screen bg-slate-100 py-8 sm:py-10 font-sans print:py-0 print:bg-white">
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
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

        {/* Top Header Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-xs border border-slate-200 mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-xs font-black tracking-widest text-[#0060c4] uppercase mb-1 block">
              {isRoundTrip
                ? 'Vé xe khứ hồi điện tử (Round-trip E-Ticket)'
                : 'Vé xe điện tử (E-Ticket)'}
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {invoice.busCompanyName}
            </h1>
            <div className="text-xs font-semibold text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
              <span>Mã giao dịch:</span>
              <CopyBadge
                code={invoice.orderCode}
                copiedCode={copiedCode}
                onCopy={handleCopyCode}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-black shrink-0 shadow-2xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Đã thanh toán</span>
            </div>
          </div>
        </div>

        {/* BỐ CỤC 2 CỘT (TRÁI - PHẢI) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* ===================== CỘT TRÁI (5/12): ĐƠN ĐẶT CHỖ & HÓA ĐƠN ===================== */}
          <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-8">
            {/* THẺ GỘP: PHIẾU ĐẶT VÉ & HÓA ĐƠN THANH TOÁN */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-xs border border-slate-200 space-y-6">
              {/* Header Thẻ */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#0060c4] flex items-center justify-center shrink-0">
                    <Ticket className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 leading-tight">
                      Phiếu đặt vé
                    </h2>
                  </div>
                </div>
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 shrink-0">
                  {invoice.tickets?.length || 1} ghế
                </span>
              </div>

              {/* Khối Mã QR Tra Cứu Toàn Đơn (To, Rõ, Căn Giữa) */}
              <div className="rounded-2xl bg-slate-50 p-6 border border-slate-200/80 flex flex-col items-center text-center">
                <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-xs mb-3">
                  <img
                    src={qrImageSrc}
                    alt={`Mã QR tra cứu phiếu đặt vé & hóa đơn ${invoice.bookingCode}`}
                    className="w-36 h-36 sm:w-40 sm:h-40 object-contain"
                  />
                </div>
                <span className="text-xs font-black text-slate-900 uppercase tracking-wider block mb-1">
                  Mã QR tra cứu phiếu & hóa đơn
                </span>
                <p className="text-[11px] text-slate-500 max-w-xs leading-relaxed mb-3">
                  Quét mã để tra cứu trạng thái đơn hàng, mở lại phiếu đặt vé và hóa đơn bất cứ lúc nào.
                </p>

                {/* Mã phiếu đặt vé & Copy button */}
                {isRoundTrip && invoice.returnBookingCode && invoice.returnBookingCode !== invoice.bookingCode ? (
                  <div className="w-full space-y-2.5 pt-3 border-t border-slate-200/70">
                    <CopyCodeBlock
                      label="Mã phiếu đặt vé Lượt đi"
                      code={invoice.bookingCode}
                      copiedCode={copiedCode}
                      onCopy={handleCopyCode}
                    />
                    <CopyCodeBlock
                      label="Mã phiếu đặt vé Lượt về"
                      code={invoice.returnBookingCode}
                      copiedCode={copiedCode}
                      onCopy={handleCopyCode}
                    />
                  </div>
                ) : (
                  <div className="w-full pt-3 border-t border-slate-200/70">
                    <CopyCodeBlock
                      label="Mã phiếu đặt vé"
                      code={invoice.bookingCode}
                      copiedCode={copiedCode}
                      onCopy={handleCopyCode}
                    />
                  </div>
                )}
              </div>

              {/* Khối Thông tin hành trình & Vị trí ghế */}
              <div className="space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  Thông tin chuyến đi & Chỗ ngồi
                </span>
                {invoice.legs.map((leg, idx) => {
                  const isReturn = idx === 1;
                  const legTickets = isReturn ? returnTickets : outboundTickets;
                  return (
                    <div
                      key={idx}
                      className="rounded-2xl bg-slate-50 p-4 border border-slate-200/80 space-y-3 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          {invoice.legs.length > 1 && (
                            <span className="px-2.5 py-0.5 rounded text-white font-extrabold text-[10px] uppercase tracking-wide bg-slate-900">
                              {idx === 0 ? 'Chặng 1: Lượt đi' : 'Chặng 2: Lượt về'}
                            </span>
                          )}
                          <p className="font-black text-slate-900 text-sm flex items-center gap-1.5">
                            <Bus className={`w-3.5 h-3.5 shrink-0 ${isReturn ? 'text-purple-600' : 'text-[#0060c4]'}`} />
                            <span>{leg.route}</span>
                          </p>
                        </div>
                        <span className="text-slate-700 font-semibold text-xs flex items-center gap-1 shrink-0">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {leg.departureTime}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/60 text-slate-600">
                        <span>Vị trí ghế đã chọn:</span>
                        <div className="flex flex-wrap gap-1">
                          {legTickets.map((t) => (
                            <span
                              key={t.ticketId || t.ticketCode}
                              className="px-2 py-0.5 rounded-md font-bold bg-white text-slate-900 border border-slate-200 text-xs shadow-2xs"
                            >
                              Ghế {t.seatNumber}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-200/60 text-slate-500">
                        <div className="truncate">
                          <span className="text-slate-400 mr-1">Đón:</span>
                          <span className="font-semibold text-slate-800">{leg.pickup}</span>
                        </div>
                        <div className="truncate text-right">
                          <span className="text-slate-400 mr-1">Trả:</span>
                          <span className="font-semibold text-slate-800">{leg.dropoff}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Khối Hành khách đại diện */}
              <div className="rounded-2xl bg-slate-50 p-3.5 border border-slate-200/70 text-xs space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Người đại diện đặt vé
                </span>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <strong className="text-slate-900 text-xs">{invoice.passengerName}</strong>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-medium">{invoice.passengerPhone}</span>
                  </div>
                </div>
                {invoice.passengerEmail && (
                  <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{invoice.passengerEmail}</span>
                  </div>
                )}
              </div>

              {/* Khối Chi tiết thanh toán & Hóa đơn */}
              <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200/80 space-y-3 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5 uppercase text-[11px] tracking-wider">
                    <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                    Chi tiết thanh toán
                  </span>
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
                    Đã thanh toán đủ
                  </span>
                </div>

                {/* Hàng hóa gửi kèm nếu có */}
                {invoice.cargoItems.length > 0 && (
                  <div className="rounded-xl bg-white p-3 border border-slate-200 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-700 flex items-center gap-1">
                        <Package className="w-3.5 h-3.5 text-slate-500" />
                        Hàng gửi kèm ({invoice.cargoItems.length} kiện)
                      </span>
                      <span className="font-black text-slate-900">
                        {invoice.cargoFee > 0 ? `${invoice.cargoFee.toLocaleString('vi-VN')}đ` : 'Miễn phí'}
                      </span>
                    </div>
                    {invoice.cargoItems.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-slate-500 text-[11px]">
                        <span>• {item.quantity}x {item.name}</span>
                        <span className="font-mono">{item.weight} kg</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Khuyến mãi nếu có */}
                {invoice.promotionCode && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 font-medium">Mã khuyến mãi</span>
                      <CopyBadge
                        code={invoice.promotionCode}
                        copiedCode={copiedCode}
                        onCopy={handleCopyCode}
                        className="bg-emerald-100/70 border-emerald-300 text-emerald-800 hover:bg-emerald-100"
                      />
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 font-medium">Giá vé gốc của toàn đơn</span>
                      <strong className="text-slate-800">{invoice.originalTicketSubtotal.toLocaleString('vi-VN')}đ</strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 font-medium">Giảm giá cho toàn đơn</span>
                      <strong className="text-emerald-700">−{invoice.discountAmount.toLocaleString('vi-VN')}đ</strong>
                    </div>
                    <p className="text-[11px] font-medium text-slate-500 pt-1 border-t border-emerald-200/50">
                      Ưu đãi chỉ áp dụng cho tiền vé; cước hàng hóa không được giảm.
                    </p>
                  </div>
                )}

                {/* Dòng giá */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between text-slate-600">
                    <span>Tiền vé ({invoice.tickets?.length || 1} ghế)</span>
                    <span className="font-semibold text-slate-800">
                      {invoice.ticketSubtotal.toLocaleString('vi-VN')}đ
                    </span>
                  </div>
                  {invoice.cargoFee > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Cước hành lý / hàng hóa</span>
                      <span className="font-semibold text-slate-800">
                        {invoice.cargoFee.toLocaleString('vi-VN')}đ
                      </span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-dashed border-slate-300 flex justify-between items-baseline">
                    <span className="font-bold text-slate-700 text-xs">
                      Tổng thanh toán:
                    </span>
                    <span className="text-2xl font-black text-slate-900 tracking-tight">
                      {invoice.totalAmount.toLocaleString('vi-VN')}đ
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 block italic">
                    {isRoundTrip
                      ? 'Đã bao gồm VAT, 2 chiều đi - về và cước hành lý'
                      : 'Đã bao gồm VAT và cước hành lý (nếu có)'}
                  </span>
                </div>

                {/* Metadata */}
                <div className="pt-2.5 border-t border-slate-200/70 text-[11px] text-slate-500 space-y-1">
                  <div className="flex justify-between">
                    <span>Phương thức:</span>
                    <strong className="text-slate-700">{invoice.paymentMethod || 'Chuyển khoản / Trực tuyến'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Thời gian lập:</span>
                    <strong className="text-slate-700">{formatInvoiceDateTime(invoice.createdAt)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Hotline hỗ trợ 24/7:</span>
                    <strong className="text-[#0060c4]">1900 8888</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ===================== CỘT PHẢI (7/12): DANH SÁCH VÉ & MÃ QR ===================== */}
          <div className="lg:col-span-7 space-y-6">
            {/* Header Cột Phải */}
            <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-xs border border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                      Danh sách vé lên xe
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
                      {invoice.tickets?.length || 1} vé
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Xuất trình mã QR tương ứng cho tài xế hoặc phụ xe khi lên xe.
                  </p>
                </div>

                {/* Segmented Control cho Khứ hồi */}
                {isRoundTrip && invoice.legs.length > 1 && (
                  <div className="inline-flex items-center p-1 bg-slate-100 rounded-xl gap-0.5 shrink-0 print:hidden self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => setActiveLegFilter('all')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        activeLegFilter === 'all'
                          ? 'bg-white text-slate-900 shadow-2xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Tất cả ({invoice.tickets?.length || 0})
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveLegFilter(0)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        activeLegFilter === 0
                          ? 'bg-white text-slate-900 shadow-2xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Lượt đi ({outboundTickets.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveLegFilter(1)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        activeLegFilter === 1
                          ? 'bg-white text-slate-900 shadow-2xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Lượt về ({returnTickets.length})
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* DANH SÁCH THẺ LÊN XE BOARDING PASS */}
            <div className="space-y-6">
              {isRoundTrip ? (
                <>
                  {/* Khối chặng đi */}
                  {(activeLegFilter === 'all' || activeLegFilter === 0) && outboundTickets.length > 0 && (
                    <div className="space-y-4">
                      {activeLegFilter === 'all' && (
                        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shrink-0" />
                            <span className="text-sm font-bold text-slate-900">Vé lượt đi</span>
                            <span className="text-xs text-slate-500 font-medium">• {invoice.legs[0]?.route}</span>
                          </div>
                          <span className="text-xs text-slate-500 font-medium">
                            {outboundTickets.length} vé
                          </span>
                        </div>
                      )}

                      <div className="space-y-6">
                        {outboundTickets.map((t) => (
                          <BoardingPassCard
                            key={t.ticketId || t.ticketCode}
                            ticket={t}
                            invoice={invoice}
                            copiedCode={copiedCode}
                            handleCopyCode={handleCopyCode}
                            isRoundTrip={isRoundTrip}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Khối chặng về */}
                  {(activeLegFilter === 'all' || activeLegFilter === 1) && returnTickets.length > 0 && (
                    <div className="space-y-4 pt-2">
                      {activeLegFilter === 'all' && (
                        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-purple-600 shrink-0" />
                            <span className="text-sm font-bold text-slate-900">Vé lượt về</span>
                            <span className="text-xs text-slate-500 font-medium">• {invoice.legs[1]?.route}</span>
                          </div>
                          <span className="text-xs text-slate-500 font-medium">
                            {returnTickets.length} vé
                          </span>
                        </div>
                      )}

                      <div className="space-y-6">
                        {returnTickets.map((t) => (
                          <BoardingPassCard
                            key={t.ticketId || t.ticketCode}
                            ticket={t}
                            invoice={invoice}
                            copiedCode={copiedCode}
                            handleCopyCode={handleCopyCode}
                            isRoundTrip={isRoundTrip}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* Chuyến một chiều */
                (invoice.tickets && invoice.tickets.length > 0
                  ? invoice.tickets
                  : [
                      {
                        ticketId: 0,
                        ticketCode: invoice.bookingCode,
                        seatNumber: invoice.legs[0]?.seats.join(', ') || 'Tiêu chuẩn',
                        seatPosition: 'Ghế ngồi',
                        price: invoice.totalAmount,
                        status: 'DA_THANH_TOAN',
                      },
                    ]
                ).map((t) => (
                  <BoardingPassCard
                    key={t.ticketId || t.ticketCode}
                    ticket={t}
                    invoice={invoice}
                    copiedCode={copiedCode}
                    handleCopyCode={handleCopyCode}
                    isRoundTrip={isRoundTrip}
                  />
                ))
              )}
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
