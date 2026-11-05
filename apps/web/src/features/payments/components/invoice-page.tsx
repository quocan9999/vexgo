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
import {
  bookingsApi,
  type BookingResponseData,
} from '@/features/account/services/bookings.api';
import { useAuthSession } from '@/features/auth/auth-session';
import {
  createPaymentDraftFromBooking,
  PAYMENT_DRAFT_STORAGE_PREFIX,
} from '@/features/booking/services/payment-draft';

interface InvoiceLeg {
  bookingCode?: string;
  route: string;
  departureTime: string;
  seats: string[];
  pickup: string;
  dropoff: string;
  pickupAddress?: string | null;
  transferStationName?: string | null;
  checkInMinutes?: number;
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
  checkInMinutes?: number;
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
    note?: string | null;
    legIndex?: number;
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

function mapPaymentMethod(method?: string | null): string {
  if (!method || method === '—') return 'Chuyển khoản VietQR';
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

          {/* Hàng 3: Điểm đón, Điểm trả & Thời gian có mặt */}
          {(() => {
            const currentLeg = invoice.legs[t.legIndex ?? 0];
            const legCargoItems = invoice.cargoItems.filter(
              (item) => (item.legIndex ?? 0) === (t.legIndex ?? 0),
            );
            const hasMotorbike = legCargoItems.some((item) =>
              (item.name || '').toLowerCase().includes('xe máy'),
            );
            const hasBicycle = legCargoItems.some((item) =>
              (item.name || '').toLowerCase().includes('xe đạp'),
            );
            const checkInMinutes =
              t.checkInMinutes ?? currentLeg?.checkInMinutes ?? 20;

            return (
              <>
                <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100 space-y-2.5 text-xs">
                  <div className="flex items-start gap-2">
                    <Clock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-slate-400 font-medium block">
                        Khởi hành lúc
                      </span>
                      <strong className="text-slate-800 text-sm">
                        {t.departureTime || currentLeg?.departureTime}
                      </strong>
                      <div className="mt-1 inline-flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                        {hasMotorbike ? (
                          <span>
                            Có mặt trước giờ khởi hành{' '}
                            <strong>90–120 phút</strong> (bàn giao xe máy &amp; xuất trình cà-vẹt gốc)
                          </span>
                        ) : hasBicycle ? (
                          <span>
                            Có mặt tại điểm đón trước giờ khởi hành{' '}
                            <strong>20–30 phút</strong> (hỗ trợ xếp xe đạp)
                          </span>
                        ) : (
                          <span>
                            Có mặt tại điểm đón trước giờ khởi hành ít nhất{' '}
                            <strong>{checkInMinutes} phút</strong>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-slate-400 font-medium block">
                        Điểm đón
                      </span>
                      <span className="font-bold text-slate-800 leading-snug">
                        {t.pickup || currentLeg?.pickup}
                      </span>
                      {currentLeg?.pickupAddress && (
                        <span className="block text-[11px] text-slate-500 mt-0.5">
                          {currentLeg.pickupAddress}
                        </span>
                      )}
                      {currentLeg?.transferStationName && (
                        <span className="block text-[11px] font-semibold text-[#0060c4] mt-0.5">
                          Xe trung chuyển đón về bến: {currentLeg.transferStationName}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-[#f05123] shrink-0 mt-0.5" />
                    <div>
                      <span className="text-slate-400 font-medium block">
                        Điểm trả
                      </span>
                      <span className="font-bold text-slate-800 leading-snug">
                        {t.dropoff || currentLeg?.dropoff}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Hàng 3.5: Thông tin Hành lý gửi kèm */}
                <div className="rounded-2xl bg-slate-50/80 p-3.5 border border-slate-100 space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-700 flex items-center gap-1.5 uppercase text-[11px] tracking-wider">
                      <Package className="w-3.5 h-3.5 text-[#0060c4]" />
                      Hành lý gửi kèm theo vé
                    </span>
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                      {legCargoItems.length > 0
                        ? `${legCargoItems.reduce((s, i) => s + (i.quantity || 1), 0)} kiện ký gửi`
                        : 'Không có'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 space-y-1">
                    {legCargoItems.length > 0 ? (
                      <div className="space-y-1">
                        <div className="font-semibold text-slate-800">
                          Kiện hành lý ký gửi hầm xe:
                        </div>
                        {legCargoItems.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between pl-3 text-slate-700 bg-white rounded-lg px-2.5 py-1.5 border border-slate-200/70"
                          >
                            <span>
                              <strong>{item.quantity}x {item.name}</strong>
                              {item.note ? ` (${item.note})` : ''}
                            </span>
                            <span className="font-mono font-bold text-slate-800 shrink-0 ml-2">
                              {item.weight} kg
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-slate-500">
                        Không có hành lý ký gửi kèm vé.
                      </div>
                    )}
                  </div>
                </div>
              </>
            );
          })()}

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
  const [pendingBookingForPayment, setPendingBookingForPayment] =
    useState<BookingResponseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [activeLegFilter, setActiveLegFilter] = useState<number>(0);
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
      setPendingBookingForPayment(null);
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

      const storages: Storage[] = [];
      try {
        if (typeof sessionStorage !== 'undefined') storages.push(sessionStorage);
      } catch {}
      try {
        if (typeof localStorage !== 'undefined') storages.push(localStorage);
      } catch {}

      for (const storage of storages) {
        if (guestCredentials) break;
        for (let index = 0; index < storage.length; index++) {
          const key = storage.key(index);
          if (!key?.startsWith(PAYMENT_DRAFT_STORAGE_PREFIX)) continue;
          const raw = storage.getItem(key);
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
              note: item.note ?? null,
              legIndex: 0,
            })),
            ...(returnBooking.cargoItems || []).map((item) => ({
              name: item.name || 'Hàng gửi kèm (Lượt về)',
              quantity: item.quantity ?? 1,
              weight: item.weight ?? 0,
              category: item.category,
              categoryName: item.categoryName || 'Hàng gửi kèm',
              note: item.note ?? null,
              legIndex: 1,
            })),
          ];

          const outSnap = booking.diemDonSnapshot as
            | {
                diaChi?: string;
                phutCoMatTruoc?: number;
                benTrungChuyen?: { tenDiem?: string } | null;
              }
            | null
            | undefined;
          const retSnap = returnBooking.diemDonSnapshot as
            | {
                diaChi?: string;
                phutCoMatTruoc?: number;
                benTrungChuyen?: { tenDiem?: string } | null;
              }
            | null
            | undefined;

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
            checkInMinutes: Number(outSnap?.phutCoMatTruoc) || 20,
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
            checkInMinutes: Number(retSnap?.phutCoMatTruoc) || 20,
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
                pickupAddress: outSnap?.diaChi ?? null,
                transferStationName: outSnap?.benTrungChuyen?.tenDiem ?? null,
                checkInMinutes: Number(outSnap?.phutCoMatTruoc) || 20,
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
                pickupAddress: retSnap?.diaChi ?? null,
                transferStationName: retSnap?.benTrungChuyen?.tenDiem ?? null,
                checkInMinutes: Number(retSnap?.phutCoMatTruoc) || 20,
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
            if (
              booking.status === 'CHO_THANH_TOAN' &&
              booking.paymentStatus === 'CHO_THANH_TOAN'
            ) {
              setPendingBookingForPayment(booking);
            }
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
          note: item.note ?? null,
          legIndex: 0,
        }));
        const oneWaySnap = booking.diemDonSnapshot as
          | {
              diaChi?: string;
              phutCoMatTruoc?: number;
              benTrungChuyen?: { tenDiem?: string } | null;
            }
          | null
          | undefined;
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
              pickupAddress: oneWaySnap?.diaChi ?? null,
              transferStationName: oneWaySnap?.benTrungChuyen?.tenDiem ?? null,
              checkInMinutes: Number(oneWaySnap?.phutCoMatTruoc) || 20,
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
            checkInMinutes: Number(oneWaySnap?.phutCoMatTruoc) || 20,
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
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            {pendingBookingForPayment && (
              <button
                type="button"
                onClick={() => {
                  const draft = createPaymentDraftFromBooking(
                    pendingBookingForPayment,
                  );
                  if (draft && typeof window !== 'undefined') {
                    window.location.assign(
                      `/payment?draftId=${encodeURIComponent(draft.id)}`,
                    );
                  }
                }}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-accent px-4 text-sm font-bold text-white hover:bg-accent-hover cursor-pointer shadow-xs"
              >
                <CreditCard className="h-4 w-4" />
                <span>Thanh toán ngay</span>
              </button>
            )}
            <Link
              href="/"
              className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-bold text-white hover:bg-slate-800"
            >
              Về trang chủ
            </Link>
          </div>
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
  const allTickets: InvoiceTicket[] = isRoundTrip
    ? [...outboundTickets, ...returnTickets]
    : invoice.tickets && invoice.tickets.length > 0
      ? invoice.tickets
      : outboundTickets;

  const safeTicketIdx =
    typeof activeLegFilter === 'number' && activeLegFilter < allTickets.length
      ? activeLegFilter
      : 0;
  const currentTicket = allTickets[safeTicketIdx] || allTickets[0];
  const currentLeg = invoice.legs[currentTicket?.legIndex ?? 0] || invoice.legs[0];
  const currentLegCargoItems = (invoice.cargoItems || []).filter(
    (item) => (item.legIndex ?? 0) === (currentTicket?.legIndex ?? 0),
  );
  const isCurrentCancelled =
    currentTicket?.status === 'HUY' || currentTicket?.status === 'CANCELLED';

  const qrData = encodeURIComponent(`https://vexgo.vn/tra-cuu-ve?code=${invoice.bookingCode}`);
  const qrImageSrc = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${qrData}`;
  const currentQrData = encodeURIComponent(
    `https://vexgo.vn/tra-cuu-ve?code=${currentTicket?.ticketCode || invoice.bookingCode}`,
  );
  const currentQrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${currentQrData}`;

  const totalCargoQty = (invoice.cargoItems || []).reduce(
    (sum, item) => sum + (item.quantity || 1),
    0,
  );
  const totalCargoWeight = (invoice.cargoItems || []).reduce(
    (sum, item) => sum + (Number(item.weight) || 0),
    0,
  );

  return (
    <div className="vexgo-eticket">
      <style>{`
        .vexgo-eticket {
          --navy: #101d37;
          --ink: #162641;
          --bg: #f3f6fa;
          --line: #e5ebf3;
          --muted: #7587a0;
          --blue: #315bca;
          --green: #058060;
          --shadow: 0 9px 32px rgba(26,48,85,.038);
          font: 12px/1.55 'Be Vietnam Pro', system-ui, sans-serif;
          color: var(--ink);
          background: linear-gradient(145deg, #f6f9fd 0%, #f0f4f9 65%, #f4f7fb 100%);
          min-height: 100vh;
        }
        .vexgo-eticket * { box-sizing: border-box; }
        .vexgo-eticket button { font: inherit; cursor: pointer; }
        .vexgo-eticket .layout { max-width: 1160px; margin: auto; padding: 22px 20px 60px; }
        .vexgo-eticket .topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 17px; gap: 12px; }
        .vexgo-eticket .brand { display: flex; align-items: center; gap: 11px; font-size: 21px; font-weight: 800; letter-spacing: -.7px; color: #1b4cab; }
        .vexgo-eticket .brand-icon { display: grid; place-items: center; background: #234baf; color: white; border-radius: 12px; width: 38px; height: 38px; font-size: 19px; }
        .vexgo-eticket .back { background: none; border: 0; color: #647795; padding: 8px 0; text-decoration: none; font-weight: 600; }
        .vexgo-eticket .hero, .vexgo-eticket .panel, .vexgo-eticket .ticket-summary { background: #fff; border: 1px solid #e3eaf3; border-radius: 17px; box-shadow: 0 7px 28px rgba(34,55,85,.035); }
        .vexgo-eticket .hero { padding: 20px 25px; display: flex; justify-content: space-between; gap: 20px; align-items: center; margin-bottom: 16px; box-shadow: 0 5px 25px rgba(20,40,70,.025); }
        .vexgo-eticket .eyebrow { font-size: 9px; letter-spacing: 1.6px; font-weight: 800; color: #3368ca; text-transform: uppercase; }
        .vexgo-eticket .hero h1 { font-size: 24px; line-height: 1.3; margin: 4px 0 7px; letter-spacing: -.8px; font-weight: 800; color: var(--ink); }
        .vexgo-eticket .sub { color: var(--muted); font-size: 11px; }
        .vexgo-eticket .order-num { display: inline-flex; align-items: center; gap: 7px; flex-wrap: wrap; }
        .vexgo-eticket .mono { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; letter-spacing: -.2px; font-weight: 700; color: #354662; font-size: 10px; overflow-wrap: anywhere; }
        .vexgo-eticket .chip { border-radius: 30px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; font-size: 10px; white-space: nowrap; }
        .vexgo-eticket .chip.green { background: #e9fcf3; color: #07845a; border: 1px solid #b8f0d6; }
        .vexgo-eticket .chip.blue { background: #edf4ff; color: #235bd0; }
        .vexgo-eticket .chip.gray { background: #f1f4f9; color: #74849b; }
        .vexgo-eticket .tiny-btn { border: none; background: #f2f6fc; color: #5c718f; border-radius: 7px; font-size: 10px; padding: 5px 9px; font-weight: 600; text-decoration: none; display: inline-flex; align-items: center; gap: 4px; }
        .vexgo-eticket .hero-actions { display: flex; align-items: flex-end; flex-direction: column; gap: 14px; }
        .vexgo-eticket .action-row { display: flex; gap: 8px; flex-wrap: wrap; }
        .vexgo-eticket .btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; border: 1px solid #dce5f1; background: #fff; border-radius: 9px; padding: 9px 12px; font-size: 11px; font-weight: 700; color: #304564; transition: .15s; }
        .vexgo-eticket .btn:hover, .vexgo-eticket .tiny-btn:hover { background: #f1f5fc; }
        .vexgo-eticket .btn.primary { background: #234bac; color: #fff; border-color: #234bac; }
        .vexgo-eticket .btn.primary:hover { background: #193e9c; }
        .vexgo-eticket .columns { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 3fr); align-items: start; gap: 17px; }
        .vexgo-eticket .panel { padding: 20px; border-radius: 17px; }
        .vexgo-eticket .panel-heading { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
        .vexgo-eticket .section-title { font-size: 12px; font-weight: 800; display: flex; align-items: center; gap: 9px; margin: 0; }
        .vexgo-eticket .round-icon { width: 28px; height: 28px; display: grid; place-items: center; background: #edf4ff; color: #2560d5; border-radius: 9px; font-size: 15px; }
        .vexgo-eticket .line { border: 0; border-top: 1px solid var(--line); margin: 14px 0; }
        .vexgo-eticket .label { font-size: 9.5px; letter-spacing: 1px; color: #475569; text-transform: uppercase; font-weight: 800; margin: 0 0 8px; }
        .vexgo-eticket .route-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px; }
        .vexgo-eticket .route-top { display: flex; justify-content: space-between; gap: 6px; align-items: center; }
        .vexgo-eticket .route-top strong { font-size: 13px; color: #0f172a; }
        .vexgo-eticket .date { color: #1d4ed8; font-weight: 700; font-size: 10.5px; }
        .vexgo-eticket .path { display: grid; grid-template-columns: 10px 1fr; gap: 0 9px; margin-top: 11px; }
        .vexgo-eticket .dot { width: 9px; height: 9px; background: #2664d7; border-radius: 100%; margin-top: 7px; box-shadow: 0 0 0 3px #e0eaff; }
        .vexgo-eticket .dot.end { background: #f0764f; box-shadow: 0 0 0 3px #fff0e9; }
        .vexgo-eticket .dash { width: 1px; height: 26px; border-left: 1px dashed #b8c5d8; margin-left: 4px; }
        .vexgo-eticket .place { font-weight: 800; font-size: 12px; color: #0f172a; }
        .vexgo-eticket .place-hint { color: #64748b; font-size: 10px; }
        .vexgo-eticket .note { background: #fffbeb; border: 1px solid #fde68a; color: #b45309; border-radius: 9px; padding: 8px 10px; font-size: 10px; margin-top: 11px; line-height: 1.7; }
        .vexgo-eticket .info-line { display: flex; justify-content: space-between; gap: 12px; padding: 7px 0; border-bottom: 1px solid #ecf0f6; font-size: 11px; }
        .vexgo-eticket .info-line:last-child { border: 0; }
        .vexgo-eticket .info-line span:first-child { color: #64748b; font-weight: 500; }
        .vexgo-eticket .info-line strong { text-align: right; font-size: 11px; color: #0f172a; }
        .vexgo-eticket .price-card { background: #fffafb; border: 1px solid #fecdd3; border-radius: 12px; padding: 14px; margin-top: 12px; }
        .vexgo-eticket .sum { display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed #b8c6d9; margin-top: 9px; padding-top: 13px; font-size: 12px; font-weight: 800; color: #1e293b; }
        .vexgo-eticket .sum b { font-size: 21px; color: #dc2626; letter-spacing: -.8px; font-weight: 800; }
        .vexgo-eticket .order-qr { display: flex; align-items: center; gap: 11px; padding: 11px; border-radius: 12px; border: 1px dashed #d3dfed; background: #fcfdff; margin-top: 13px; }
        .vexgo-eticket .order-qr img { width: 66px; height: 66px; image-rendering: pixelated; border: 5px solid white; border-radius: 7px; }
        .vexgo-eticket .order-qr strong { font-size: 11px; display: block; }
        .vexgo-eticket .order-qr p { color: #8392a7; font-size: 10px; margin: 4px 0 8px; }
        .vexgo-eticket .right { min-width: 0; }
        .vexgo-eticket .ticket-summary { padding: 15px 19px; border-radius: 14px; margin-bottom: 9px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .vexgo-eticket .ticket-summary h2 { font-size: 14px; margin: 0 0 4px; letter-spacing: -.3px; font-weight: 800; }
        .vexgo-eticket .ticket-summary p { font-size: 10px; margin: 0; color: #8494aa; }
        .vexgo-eticket .ticket-tabs { display: flex; gap: 7px; flex-wrap: wrap; }
        .vexgo-eticket .tab { background: #f3f6fb; border: 1px solid #e1e9f4; color: #536682; padding: 8px 11px; border-radius: 9px; font-weight: 700; font-size: 11px; }
        .vexgo-eticket .tab.active { background: #204caa; border-color: #204caa; color: white; }
        .vexgo-eticket .boarding-hint { margin-bottom: 10px; display: flex; align-items: center; justify-content: center; min-height: 31px; padding: 7px 12px; background: #eaf7f1; border: 1px solid #d5eee3; color: #237858; font-size: 10px; font-weight: 700; border-radius: 9px; }
        .vexgo-eticket .ticket { background: white; border-radius: 15px; border: 1px solid #e3eaf3; overflow: hidden; box-shadow: 0 7px 28px rgba(34,55,85,.035); }
        .vexgo-eticket .ticket-head { background: #13203b; color: white; padding: 15px 18px; display: flex; justify-content: space-between; align-items: center; gap: 12px; position: relative; }
        .vexgo-eticket .ticket-head:before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, #4d86f3, #70d5c1); }
        .vexgo-eticket .operator { display: flex; align-items: center; gap: 12px; }
        .vexgo-eticket .operator-logo { width: 34px; height: 34px; border-radius: 10px; background: #2a3b5a; display: grid; place-items: center; font-size: 16px; }
        .vexgo-eticket .ticket-head small { display: block; color: #a8bad6; font-size: 9px; }
        .vexgo-eticket .ticket-head strong { font-size: 15px; letter-spacing: -.3px; }
        .vexgo-eticket .ticket-head .code { text-align: right; font-size: 10px; color: #b4c2dc; }
        .vexgo-eticket .ticket-head .code b { display: inline-flex; align-items: center; gap: 6px; color: white; font-size: 11px; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.14); padding: 4px 9px; border-radius: 7px; margin-top: 3px; word-break: break-all; }
        .vexgo-eticket .ticket-head .code b:hover { background: rgba(255, 255, 255, 0.15); }
        .vexgo-eticket .ticket-main { display: grid; grid-template-columns: minmax(0, 1fr) 174px; }
        .vexgo-eticket .ticket-details { padding: 18px 18px 17px; min-width: 0; }
        .vexgo-eticket .ticket-qr { border-left: 2px dashed #e4eaf4; position: relative; background: #fbfcff; padding: 18px 12px; display: flex; align-items: center; justify-content: center; flex-direction: column; text-align: center; }
        .vexgo-eticket .ticket-qr img { width: 140px; max-width: 100%; border: 7px solid white; border-radius: 11px; image-rendering: pixelated; box-shadow: 0 3px 15px rgba(20,40,75,.05); }
        .vexgo-eticket .ticket-qr b { font-size: 10px; margin-top: 11px; }
        .vexgo-eticket .ticket-qr p { font-size: 9px; color: #8797ac; max-width: 175px; line-height: 1.7; margin: 4px 0; }
        .vexgo-eticket .ticket-qr .seat-qr { font-size: 10px; background: #edf4ff; color: #2658bd; border-radius: 7px; padding: 4px 9px; margin-top: 7px; font-weight: 700; }
        .vexgo-eticket .trip-title { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0; }
        .vexgo-eticket .seat-label { font-size: 9.5px; color: #64748b; font-weight: 800; text-transform: uppercase; letter-spacing: .4px; }
        .vexgo-eticket .seat-big { font-size: 34px; font-weight: 800; line-height: 1.3; letter-spacing: -1.8px; color: #1d4ed8; }
        .vexgo-eticket .seat-type { background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; font-size: 9.5px; padding: 4px 8px; border-radius: 6px; margin-left: 6px; font-weight: 700; }
        .vexgo-eticket .fare { text-align: right; }
        .vexgo-eticket .fare strong { font-size: 19px; font-weight: 800; color: #dc2626; display: block; letter-spacing: -.6px; }
        .vexgo-eticket .fare small { color: #059368; font-weight: 700; font-size: 9px; }
        .vexgo-eticket .person-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 14px 0; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 11px; padding: 10px 13px; }
        .vexgo-eticket .person-grid .value { font-size: 12px; font-weight: 800; color: #0f172a; line-height: 1.5; margin-top: 3px; overflow-wrap: anywhere; }
        .vexgo-eticket .person-grid #phone { color: #0369a1; }
        .vexgo-eticket .timeline-box { background: #f4f8ff; border: 1px solid #dbeafe; border-radius: 13px; padding: 13px 14px; margin-bottom: 10px; }
        .vexgo-eticket .timeline-box .title { font-weight: 800; font-size: 12.5px; color: #1e3a8a; margin-top: 3px; }
        .vexgo-eticket .muted { color: #64748b; font-size: 10px; }
        .vexgo-eticket .timeline-point { display: flex; gap: 9px; margin-top: 10px; }
        .vexgo-eticket .pin { color: #2461d0; font-size: 16px; }
        .vexgo-eticket .pin.orange { color: #ea580c; }
        .vexgo-eticket .timeline-point b { display: block; font-size: 11px; color: #0f172a; font-weight: 700; }
        .vexgo-eticket .timeline-point span { display: block; font-size: 9.5px; color: #475569; font-weight: 500; }
        .vexgo-eticket .timeline-point .point-tag { font-weight: 700; color: #1d4ed8; font-size: 9.5px; }
        .vexgo-eticket .timeline-point .point-tag.dropoff { color: #ea580c; }
        .vexgo-eticket .luggage { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 11px 13px; }
        .vexgo-eticket .luggage-title { display: flex; justify-content: space-between; align-items: center; gap: 9px; font-weight: 800; font-size: 10px; color: #1e3a8a; }
        .vexgo-eticket .luggage-row { display: flex; justify-content: space-between; align-items: center; color: #334155; font-size: 10.5px; font-weight: 600; margin-top: 7px; }
        .vexgo-eticket .luggage-row strong { color: #0f172a; font-weight: 800; }
        .vexgo-eticket .ticket-foot { background: #f8fafc; border-top: 1px solid #e7edf4; padding: 11px 17px; display: flex; justify-content: space-between; align-items: center; gap: 12px; font-size: 10px; color: #64748b; }
        .vexgo-eticket .ticket-foot strong { color: #1e3a8a; }
        .vexgo-eticket .help { margin-top: 11px; padding: 13px 15px; display: flex; align-items: center; gap: 12px; border: 1px solid #dce9f9; background: #ecf4ff; border-radius: 12px; color: #547198; font-size: 11px; }
        .vexgo-eticket .help b { color: #2e508a; }
        .vexgo-eticket .footer { text-align: center; font-size: 10px; color: #9aabc0; margin: 24px 0 0; }
        .vexgo-eticket .toast { position: fixed; bottom: 22px; left: 50%; transform: translateX(-50%); padding: 11px 18px; border-radius: 10px; background: #172843; color: white; box-shadow: 0 10px 25px #14233f33; font-size: 12px; opacity: 0; pointer-events: none; transition: opacity .2s; z-index: 50; }
        .vexgo-eticket .toast.show { opacity: 1; }
        @media (min-width: 1180px) {
          .vexgo-eticket .columns { grid-template-columns: 434px minmax(0, 1fr); }
          .vexgo-eticket .right { max-width: 665px; }
        }
        @media (max-width: 760px) {
          .vexgo-eticket .layout { padding: 12px 12px 40px; }
          .vexgo-eticket .hero { padding: 17px; flex-direction: column; align-items: flex-start; gap: 15px; }
          .vexgo-eticket .hero h1 { font-size: 22px; }
          .vexgo-eticket .hero-actions { align-items: flex-start; width: 100%; gap: 10px; }
          .vexgo-eticket .columns { display: flex; flex-direction: column; gap: 12px; }
          .vexgo-eticket .right { order: 0; width: 100%; }
          .vexgo-eticket .left { order: 1; width: 100%; }
          .vexgo-eticket .ticket-summary { padding: 14px 15px; align-items: flex-start; flex-direction: column; }
          .vexgo-eticket .ticket-main { grid-template-columns: 1fr; }
          .vexgo-eticket .ticket-qr { border-left: 0; border-top: 2px dashed #e4eaf4; padding: 18px; }
        }
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          body {
            background: #fff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body header,
          body footer,
          body [class*="fixed"] {
            display: none !important;
          }
          .vexgo-eticket {
            min-height: auto !important;
            background: #fff !important;
            padding: 0 !important;
          }
          .vexgo-eticket .layout {
            padding: 0 !important;
            max-width: 100% !important;
            margin: 0 !important;
          }
          .vexgo-eticket .topbar,
          .vexgo-eticket .action-row,
          .vexgo-eticket .back,
          .vexgo-eticket .ticket-tabs,
          .vexgo-eticket .help,
          .vexgo-eticket .footer,
          .vexgo-eticket .tiny-btn,
          .vexgo-eticket .toast,
          .vexgo-eticket .boarding-hint {
            display: none !important;
          }
          .vexgo-eticket .hero {
            margin-bottom: 10px !important;
            padding: 12px 16px !important;
            box-shadow: none !important;
          }
          .vexgo-eticket .hero h1 {
            font-size: 18px !important;
            margin: 2px 0 4px !important;
          }
          .vexgo-eticket .columns {
            display: grid !important;
            grid-template-columns: 38% 60% !important;
            gap: 12px !important;
            align-items: start !important;
          }
          .vexgo-eticket .left { order: 0 !important; }
          .vexgo-eticket .right { order: 1 !important; max-width: 100% !important; }
          .vexgo-eticket .panel,
          .vexgo-eticket .ticket-summary {
            box-shadow: none !important;
            padding: 12px 14px !important;
          }
          .vexgo-eticket .ticket {
            box-shadow: none !important;
          }
          .vexgo-eticket .ticket-summary {
            margin-bottom: 8px !important;
          }
          .vexgo-eticket .ticket-head {
            padding: 10px 14px !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .vexgo-eticket .ticket-main {
            display: grid !important;
            grid-template-columns: 1fr 145px !important;
          }
          .vexgo-eticket .ticket-details {
            padding: 12px 14px !important;
          }
          .vexgo-eticket .ticket-qr {
            border-left: 2px dashed #e4eaf4 !important;
            border-top: 0 !important;
            padding: 12px 8px !important;
          }
          .vexgo-eticket .ticket-qr img {
            width: 110px !important;
          }
          .vexgo-eticket .line {
            margin: 8px 0 !important;
          }
          .vexgo-eticket .route-card,
          .vexgo-eticket .price-card,
          .vexgo-eticket .timeline-box {
            padding: 10px 12px !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .vexgo-eticket .order-qr {
            margin-top: 8px !important;
            padding: 8px !important;
          }
          .vexgo-eticket .order-qr img {
            width: 52px !important;
            height: 52px !important;
          }
        }
      `}</style>

      <div className="layout">
        <section className="hero">
          <div>
            <div className="eyebrow">
              VEXGO / CHUYẾN ĐI ĐÃ XÁC NHẬN ·{' '}
              <span>
                {isRoundTrip
                  ? 'Vé xe khứ hồi điện tử (Round-trip E-Ticket)'
                  : 'Vé xe điện tử (E-Ticket)'}
              </span>
            </div>
            <h1>Vé điện tử của bạn</h1>
            <div className="order-num">
              <span className="sub">Mã đặt vé:</span>
              <span className="mono" id="orderCode">
                {invoice.bookingCode}
              </span>
              <button
                type="button"
                className="tiny-btn"
                onClick={() => handleCopyCode(invoice.bookingCode)}
              >
                {copiedCode === invoice.bookingCode ? '✓ Đã sao chép' : '▢ Sao chép'}
              </button>
              {invoice.orderCode && invoice.orderCode !== invoice.bookingCode && (
                <>
                  <span className="sub" style={{ marginLeft: 4 }}>
                    · Mã GD:
                  </span>
                  <span className="mono">{invoice.orderCode}</span>
                </>
              )}
            </div>
          </div>

          <div className="hero-actions">
            <span className="chip green">✓ Đã thanh toán</span>
            <div className="action-row">
              <button type="button" className="btn primary" onClick={handlePrint}>
                ↓ Tải vé PDF
              </button>
            </div>
          </div>
        </section>

        <main className="columns">
          {/* CỘT TRÁI: CHI TIẾT ĐƠN HÀNG */}
          <aside className="left panel" id="orderPanel">
            <div className="panel-heading">
              <h2 className="section-title">
                <span className="round-icon">▤</span> Chi tiết đơn hàng
              </h2>
              <span className="chip gray">
                {invoice.legs.length > 1 ? `${invoice.legs.length} chặng` : '1 đơn'}
              </span>
            </div>

            <hr className="line" />
            <p className="label">Thông tin hành trình</p>

            {invoice.legs.map((leg, idx) => {
              const isReturn = idx === 1;
              const legCargoItems = (invoice.cargoItems || []).filter((item) =>
                isReturn ? item.legIndex === 1 : (item.legIndex ?? 0) === 0,
              );
              const hasMotorbike = legCargoItems.some((item) =>
                item.name?.toLowerCase().includes('xe máy'),
              );
              const hasBicycle = legCargoItems.some((item) =>
                item.name?.toLowerCase().includes('xe đạp'),
              );
              const checkInText = hasMotorbike
                ? '90 – 120 phút (do có gửi xe máy kèm vé)'
                : hasBicycle
                  ? '20 – 30 phút (do có gửi xe đạp kèm vé)'
                  : `${leg.checkInMinutes || 20} phút`;

              return (
                <div
                  key={idx}
                  className="route-card"
                  style={idx > 0 ? { marginTop: 10 } : undefined}
                >
                  {invoice.legs.length > 1 && (
                    <div style={{ marginBottom: 6 }}>
                      <span className="chip gray">
                        {idx === 0 ? 'Chặng 1: Lượt đi' : 'Chặng 2: Lượt về'}
                      </span>
                    </div>
                  )}
                  <div className="route-top">
                    <strong>{leg.route}</strong>
                    <span className="chip blue">
                      {leg.busCompanyName || invoice.busCompanyName}
                    </span>
                  </div>
                  <div className="date" style={{ marginTop: 9 }}>
                    ◷ {leg.departureTime}
                  </div>
                  <div className="path">
                    <span className="dot" />
                    <div>
                      <span className="place">{leg.pickup}</span>
                      <div className="place-hint">
                        Điểm đón
                        {leg.pickupAddress ? ` · ${leg.pickupAddress}` : ''}
                        {leg.transferStationName
                          ? ` · Trung chuyển: ${leg.transferStationName}`
                          : ''}
                      </div>
                    </div>
                    <span className="dash" />
                    <span />
                    <span className="dot end" />
                    <div>
                      <span className="place">{leg.dropoff}</span>
                      <div className="place-hint">Điểm trả</div>
                    </div>
                  </div>
                  <div className="note">
                    ◷ Có mặt tại điểm đón trước giờ khởi hành ít nhất{' '}
                    <strong>{checkInText}</strong>.
                  </div>
                </div>
              );
            })}

            <hr className="line" />
            <p className="label">Người đặt vé</p>
            <div className="info-line">
              <span>Họ và tên</span>
              <strong>{invoice.passengerName}</strong>
            </div>
            <div className="info-line">
              <span>Số điện thoại</span>
              <strong>{invoice.passengerPhone}</strong>
            </div>
            {invoice.passengerEmail && (
              <div className="info-line">
                <span>Email</span>
                <strong style={{ overflowWrap: 'anywhere' }}>{invoice.passengerEmail}</strong>
              </div>
            )}

            <hr className="line" />
            <p className="label">Chi tiết thanh toán</p>
            <div className="info-line">
              <span>Vé xe ({allTickets.length} ghế)</span>
              <strong style={{ color: '#dc2626' }}>
                {invoice.ticketSubtotal.toLocaleString('vi-VN')}đ
              </strong>
            </div>
            {(invoice.cargoItems.length > 0 || invoice.cargoFee > 0) && (
              <div className="info-line">
                <span>
                  Hành lý ký gửi
                  {totalCargoQty > 0
                    ? ` (${totalCargoQty} kiện · ${totalCargoWeight} kg)`
                    : ''}
                </span>
                <strong>
                  {invoice.cargoFee > 0
                    ? `${invoice.cargoFee.toLocaleString('vi-VN')}đ`
                    : 'Miễn phí'}
                </strong>
              </div>
            )}
            {invoice.promotionCode && (
              <>
                <div className="info-line">
                  <span>Mã khuyến mãi</span>
                  <strong>{invoice.promotionCode}</strong>
                </div>
                <div className="info-line">
                  <span>Giá vé gốc của toàn đơn</span>
                  <strong>{invoice.originalTicketSubtotal.toLocaleString('vi-VN')}đ</strong>
                </div>
                <div className="info-line">
                  <span>Giảm giá cho toàn đơn</span>
                  <strong style={{ color: '#058060' }}>
                    −{invoice.discountAmount.toLocaleString('vi-VN')}đ
                  </strong>
                </div>
                <div className="sub" style={{ marginTop: 4 }}>
                  Ưu đãi chỉ áp dụng cho tiền vé; cước hàng hóa không được giảm.
                </div>
              </>
            )}

            <div className="price-card">
              <div className="sum" style={{ marginTop: 0, border: 0, padding: 0 }}>
                <span>Tổng đã thanh toán</span>
                <b>{invoice.totalAmount.toLocaleString('vi-VN')}đ</b>
              </div>
              <div className="sub" style={{ marginTop: 5 }}>
                Đã bao gồm các khoản phí hiển thị trong đơn.
              </div>
            </div>

            <div className="info-line" style={{ marginTop: 10 }}>
              <span>Phương thức</span>
              <strong>{mapPaymentMethod(invoice.paymentMethod)}</strong>
            </div>
            <div className="info-line">
              <span>Thanh toán lúc</span>
              <strong>{formatInvoiceDateTime(invoice.createdAt)}</strong>
            </div>

            <div className="order-qr">
              <img alt="QR tra cứu đơn hàng" src={qrImageSrc} />
              <div>
                <strong>QR tra cứu đơn hàng</strong>
                <p>Dùng để xem lại đơn đặt vé, không dùng để lên xe.</p>
                <a
                  className="tiny-btn"
                  href={qrImageSrc}
                  download={`QR-tra-cuu-don-hang-${invoice.bookingCode}.png`}
                  target="_blank"
                  rel="noreferrer"
                >
                  ↓ Lưu QR
                </a>
              </div>
            </div>
          </aside>

          {/* CỘT PHẢI: THẺ LÊN XE & MÃ QR */}
          <section className="right">
            <div className="ticket-summary">
              <div>
                <h2>
                  Thẻ lên xe{' '}
                  <span className="chip gray" id="countLabel">
                    {allTickets.length} vé
                  </span>
                </h2>
                <p>Xuất trình mã QR riêng của từng vé cho nhân viên khi lên xe.</p>
              </div>
              {allTickets.length > 1 && (
                <div className="ticket-tabs" id="tabs">
                  {allTickets.map((t, i) => (
                    <button
                      key={t.ticketId || `${t.ticketCode}-${i}`}
                      type="button"
                      className={`tab ${safeTicketIdx === i ? 'active' : ''}`}
                      onClick={() => setActiveLegFilter(i)}
                      aria-pressed={safeTicketIdx === i}
                    >
                      Ghế {t.seatNumber}
                      {isRoundTrip && t.legTitle ? ` (${t.legTitle})` : ''}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="boarding-hint">
              ✓ Chỉ cần xuất trình mã QR bên dưới khi lên xe
            </div>

            {currentTicket && (
              <div className="ticket" id="captureTicket">
                <div className="ticket-head">
                  <div className="operator">
                    <div className="operator-logo">▦</div>
                    <div>
                      <small>Thẻ lên xe điện tử · VexGo</small>
                      <strong>
                        {currentTicket.busCompanyName || invoice.busCompanyName}
                      </strong>
                    </div>
                  </div>
                  <div className="code">
                    <span style={{ display: 'block' }}>MÃ VÉ</span>
                    <b
                      id="ticketCode"
                      title="Nhấp để sao chép mã vé"
                      onClick={() => handleCopyCode(currentTicket.ticketCode)}
                      style={{ cursor: 'pointer' }}
                    >
                      <span>{currentTicket.ticketCode}</span>
                      <span
                        style={{
                          fontSize: 9,
                          color:
                            copiedCode === currentTicket.ticketCode
                              ? '#6ee7b7'
                              : '#93c5fd',
                          fontFamily: "'Be Vietnam Pro', system-ui, sans-serif",
                        }}
                      >
                        {copiedCode === currentTicket.ticketCode ? '✓' : '▢'}
                      </span>
                    </b>
                  </div>
                </div>

                <div className="ticket-main">
                  <div className="ticket-details">
                    <div className="trip-title">
                      <div>
                        <div className="seat-label">SỐ GHẾ HÀNH KHÁCH</div>
                        <div>
                          <span className="seat-big" id="seat">
                            {currentTicket.seatNumber}
                          </span>
                          <span className="seat-type">
                            {currentTicket.seatPosition ||
                              currentTicket.legTitle ||
                              'Dãy tiêu chuẩn'}
                          </span>
                        </div>
                      </div>
                      <div className="fare">
                        <div className="seat-label">GIÁ VÉ</div>
                        <strong>
                          {(currentTicket.price || 0).toLocaleString('vi-VN')}đ
                        </strong>
                        <small
                          style={isCurrentCancelled ? { color: '#e11d48' } : undefined}
                        >
                          {isCurrentCancelled
                            ? 'Vé đã hủy'
                            : 'Giá vé chưa gồm hành lý'}
                        </small>
                      </div>
                    </div>

                    <div className="person-grid">
                      <div>
                        <div className="seat-label">HÀNH KHÁCH</div>
                        <div className="value" id="passenger">
                          {invoice.passengerName}
                        </div>
                      </div>
                      <div>
                        <div className="seat-label">SỐ ĐIỆN THOẠI</div>
                        <div className="value" id="phone">
                          {invoice.passengerPhone}
                        </div>
                      </div>
                    </div>

                    <div className="timeline-box">
                      <div className="seat-label">THÔNG TIN CHUYẾN ĐI</div>
                      <div className="title">
                        ◷ {currentTicket.departureTime || currentLeg?.departureTime}
                      </div>
                      {(() => {
                        const hasMotorbike = currentLegCargoItems.some((item) =>
                          item.name?.toLowerCase().includes('xe máy'),
                        );
                        const hasBicycle = currentLegCargoItems.some((item) =>
                          item.name?.toLowerCase().includes('xe đạp'),
                        );
                        const currentCheckInText = hasMotorbike
                          ? '90 – 120 phút (do có gửi xe máy kèm vé)'
                          : hasBicycle
                            ? '20 – 30 phút (do có gửi xe đạp kèm vé)'
                            : `${currentTicket.checkInMinutes || currentLeg?.checkInMinutes || 20} phút`;
                        return (
                          <div className="note" style={{ marginTop: 8 }}>
                            ◷ Có mặt tại điểm đón trước giờ khởi hành ít nhất{' '}
                            <strong>{currentCheckInText}</strong>.
                          </div>
                        );
                      })()}
                      <div className="timeline-point">
                        <span className="pin">♧</span>
                        <div>
                          <span className="point-tag">Điểm đón</span>
                          <b>{currentTicket.pickup || currentLeg?.pickup}</b>
                          {currentLeg?.pickupAddress && (
                            <span>{currentLeg.pickupAddress}</span>
                          )}
                          {currentLeg?.transferStationName && (
                            <span>Trung chuyển: {currentLeg.transferStationName}</span>
                          )}
                        </div>
                      </div>
                      <div className="timeline-point">
                        <span className="pin orange">♧</span>
                        <div>
                          <span className="point-tag dropoff">Điểm trả</span>
                          <b>{currentTicket.dropoff || currentLeg?.dropoff}</b>
                        </div>
                      </div>
                    </div>

                    <div className="luggage">
                      <div className="luggage-title">
                        <span>♧ HÀNH LÝ ĐI KÈM VÉ</span>
                        <span className="chip green" id="luggageBadge">
                          {currentLegCargoItems.length > 0
                            ? `${currentLegCargoItems.reduce((s, i) => s + (i.quantity || 1), 0)} kiện ký gửi`
                            : 'Không ký gửi'}
                        </span>
                      </div>
                      {currentLegCargoItems.length > 0 ? (
                        <>
                          {currentLegCargoItems.map((item, idx) => (
                            <div className="luggage-row" key={idx}>
                              <span id={idx === 0 ? 'luggageName' : undefined}>
                                {item.quantity}× {item.name}
                                {item.note ? ` (${item.note})` : ''}
                              </span>
                              <strong id={idx === 0 ? 'luggageKg' : undefined}>
                                {item.weight} kg
                              </strong>
                            </div>
                          ))}
                          <div className="muted" style={{ marginTop: 7 }}>
                            Đã tính phí trong đơn hàng · Không thu lại khi lên xe
                          </div>
                        </>
                      ) : (
                        <div className="luggage-row">
                          <span id="luggageName">Không có hành lý ký gửi</span>
                          <strong id="luggageKg">—</strong>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="ticket-qr">
                    <img
                      alt="Mã QR lên xe riêng cho hành khách"
                      id="boardingQr"
                      src={currentQrSrc}
                      style={
                        isCurrentCancelled
                          ? { opacity: 0.25, filter: 'grayscale(1)' }
                          : undefined
                      }
                    />
                    <b>QUÉT MÃ ĐỂ LÊN XE</b>
                    <p>
                      Đưa mã này cho nhân viên nhà xe. Mỗi ghế sử dụng một mã riêng.
                    </p>
                    <span className="seat-qr" id="qrSeat">
                      Vé ghế {currentTicket.seatNumber}
                    </span>
                    <a
                      className="tiny-btn"
                      href={currentQrSrc}
                      download={`QR-len-xe-${currentTicket.seatNumber}.png`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ marginTop: 12 }}
                    >
                      ↓ Lưu mã QR
                    </a>
                  </div>
                </div>

                <div className="ticket-foot">
                  <span>
                    Vui lòng kiểm tra đúng chuyến, ngày và ghế trước khi lên xe.
                  </span>
                  <strong>VexGo · E-ticket</strong>
                </div>
              </div>
            )}
          </section>
        </main>

        <footer className="footer">
          Vé điện tử có giá trị như vé xe thông thường. Nếu cần hỗ trợ thay đổi
          thông tin, vui lòng liên hệ nhà xe hoặc VexGo.
        </footer>
      </div>

      <div
        aria-live="polite"
        className={`toast ${copiedCode ? 'show' : ''}`}
        role="status"
      >
        {copiedCode ? 'Đã sao chép mã' : ''}
      </div>
    </div>
  );
}
