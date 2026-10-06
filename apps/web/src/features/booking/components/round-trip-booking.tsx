'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, Info, Mail, Phone, User } from 'lucide-react';
import type { Post } from '@/features/posts/types/post';
import type { ApiTripSeat } from '@/features/trips/services/trips.api';
import {
  calculateRoundTripFare,
  getReturnTripLocations,
} from '../utils/round-trip-booking';
import { formatTripDateTime } from '../utils/one-way-booking';
import { validatePassengerInfo } from '../utils/passenger-validation';
import { createPaymentDraft } from '../services/payment-draft';
import { FeaturePlaceholderModal } from './feature-placeholder-modal';
import { useAuthSession } from '@/features/auth/auth-session';
import { customerApi } from '@/features/account/services/customer.api';
import { hydrateUntouchedProfileField } from '../utils/profile-hydration';

export interface RoundTripBookingProps {
  outboundPost: Post;
  returnPost: Post;
  departureDate: string;
  returnDate: string;
  outboundTripSeats: ApiTripSeat[];
  returnTripSeats: ApiTripSeat[];
}

const ChairIcon = ({ className = 'w-7 h-9' }: { className?: string }) => (
  <svg
    viewBox="0 0 40 48"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <g strokeWidth="2.5">
      <rect x="1" y="14" width="8" height="20" rx="3" />
      <rect x="31" y="14" width="8" height="20" rx="3" />
      <rect x="9" y="34" width="22" height="12" rx="3" />
      <rect x="7" y="2" width="26" height="38" rx="5" />
    </g>
  </svg>
);

const SeatIcon = ChairIcon;

interface SeatButtonProps {
  seat: string;
  booked: boolean;
  selected: boolean;
  onToggle: (seat: string) => void;
}

const SeatButton = ({
  seat,
  booked,
  selected,
  onToggle,
}: SeatButtonProps) => {
  const seatClass = booked
    ? 'fill-slate-200 stroke-slate-300'
    : selected
      ? 'fill-[#F5A623] stroke-[#D98A12]'
      : 'fill-sky-100 stroke-sky-300 group-hover:fill-sky-200 group-hover:stroke-sky-400';
  const textClass = booked
    ? 'text-slate-400'
    : selected
      ? 'text-white'
      : 'text-sky-600';

  return (
    <button
      type="button"
      disabled={booked}
      aria-label={`${seat}${booked ? ' đã bán' : selected ? ' đang chọn' : ' còn trống'}`}
      aria-pressed={selected}
      onClick={() => onToggle(seat)}
      className="group relative min-h-11 min-w-11 inline-flex items-center justify-center rounded-md disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      <ChairIcon className={`w-7 h-9 transition-colors ${seatClass}`} />
      <span
        className={`absolute top-[8px] text-[9px] font-bold ${textClass}`}
      >
        {seat}
      </span>
    </button>
  );
};

interface SeatGridProps {
  title: string;
  date: string;
  vehicleType?: string;
  tripSeats: ApiTripSeat[];
  selectedSeats: string[];
  onToggle: (seat: string) => void;
  onVehicleInfoClick?: () => void;
}

const SeatGrid = ({
  title,
  date,
  vehicleType,
  tripSeats,
  selectedSeats,
  onToggle,
  onVehicleInfoClick,
}: SeatGridProps) => {
  const isSleeper =
    vehicleType?.toUpperCase().includes('GIƯỜNG') ||
    tripSeats.some((s) => s.position?.includes('Tầng'));

  const seatGroups = Object.entries(
    tripSeats.reduce<Record<string, ApiTripSeat[]>>((groups, seat) => {
      let label = seat.position?.trim() || 'Sơ đồ ghế';
      if (isSleeper) {
        if (
          seat.seatNumber?.toUpperCase().startsWith('B') ||
          seat.position?.toLowerCase().includes('trên')
        ) {
          label = 'Tầng trên';
        } else {
          label = 'Tầng dưới';
        }
      }
      (groups[label] ??= []).push(seat);
      return groups;
    }, {}),
  );

  seatGroups.forEach(([, seats]) => {
    seats.sort((a, b) => a.seatNumber.localeCompare(b.seatNumber, undefined, { numeric: true }));
  });
  seatGroups.sort(([a], [b]) => {
    if (a.toLowerCase().includes('dưới')) return -1;
    if (b.toLowerCase().includes('dưới')) return 1;
    return a.localeCompare(b);
  });

  const leftSeats: ApiTripSeat[] = [];
  const rightSeats: ApiTripSeat[] = [];
  if (!isSleeper) {
    const unassigned: ApiTripSeat[] = [];
    tripSeats.forEach((seat) => {
      const pos = seat.position?.toLowerCase() || '';
      if (pos.includes('trái')) {
        leftSeats.push(seat);
      } else if (pos.includes('phải')) {
        rightSeats.push(seat);
      } else {
        unassigned.push(seat);
      }
    });

    if (leftSeats.length === 0 && rightSeats.length === 0) {
      const sorted = [...tripSeats].sort((a, b) =>
        a.seatNumber.localeCompare(b.seatNumber, undefined, { numeric: true }),
      );
      for (let i = 0; i < sorted.length; i += 4) {
        if (i < sorted.length) leftSeats.push(sorted[i]);
        if (i + 1 < sorted.length) leftSeats.push(sorted[i + 1]);
        if (i + 2 < sorted.length) rightSeats.push(sorted[i + 2]);
        if (i + 3 < sorted.length) rightSeats.push(sorted[i + 3]);
      }
    } else if (unassigned.length > 0) {
      unassigned.forEach((seat) => {
        if (leftSeats.length <= rightSeats.length) {
          leftSeats.push(seat);
        } else {
          rightSeats.push(seat);
        }
      });
    }
    leftSeats.sort((a, b) => a.seatNumber.localeCompare(b.seatNumber, undefined, { numeric: true }));
    rightSeats.sort((a, b) => a.seatNumber.localeCompare(b.seatNumber, undefined, { numeric: true }));
  }

  return (
    <div className="min-w-0 flex-1 p-4 md:p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-black text-slate-950">Chọn ghế</h2>
            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
              {tripSeats.length} chỗ
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-amber-50 text-amber-700 border-amber-200">
              {isSleeper ? 'Giường nằm' : 'Ghế ngồi'}
            </span>
          </div>
          <p className="text-xs font-bold text-slate-500 mt-1">
            {title} - {date}
          </p>
        </div>
        <button
          type="button"
          onClick={onVehicleInfoClick}
          className="min-h-11 px-2 text-xs font-bold text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-md cursor-pointer"
        >
          Thông tin xe
        </button>
      </div>

      {isSleeper ? (
        /* XE GIƯỜNG NẰM: 2 TẦNG */
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {seatGroups.map(([label, seats]) => (
            <div
              key={label}
              className="bg-slate-50/80 border border-slate-200 rounded-xl p-3 flex flex-col items-center"
            >
              <div className="w-full flex items-center justify-between pb-2 mb-3 border-b border-dashed border-slate-200 px-1">
                <span className="text-[10px] font-bold text-slate-400">Tài xế</span>
                <h3 className="text-[11px] font-black text-[#0060c4] uppercase">
                  {label}
                </h3>
                <span className="text-[9px] font-bold text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                  Cửa lên
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1 sm:gap-2 justify-items-center">
                {seats.map((seat) => (
                  <SeatButton
                    key={seat.tripSeatId}
                    seat={seat.seatNumber}
                    booked={seat.status !== 'TRONG'}
                    selected={selectedSeats.includes(seat.seatNumber)}
                    onToggle={onToggle}
                  />
                ))}
              </div>
              <div className="w-full text-center pt-2 mt-3 border-t border-dashed border-slate-200 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                Cuối xe
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* XE GHẾ NGỒI: 1 TẦNG VỚI LỐI ĐI Ở GIỮA */
        <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-3.5 max-w-[420px] mx-auto">
          {/* Đầu xe */}
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-dashed border-slate-200 px-1">
            <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
              Tài xế
            </span>
            <span className="text-[10px] font-bold text-slate-400 uppercase">
              Đầu xe
            </span>
            <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
              Cửa lên
            </span>
          </div>

          {/* Dãy trái | Lối đi | Dãy phải */}
          <div className="grid grid-cols-[1fr_36px_1fr] gap-1.5 items-start">
            <div>
              <p className="text-[10px] font-black text-center text-slate-600 uppercase mb-2">
                Dãy trái
              </p>
              <div className="grid grid-cols-2 gap-1.5 justify-items-center">
                {leftSeats.map((seat) => (
                  <SeatButton
                    key={seat.tripSeatId}
                    seat={seat.seatNumber}
                    booked={seat.status !== 'TRONG'}
                    selected={selectedSeats.includes(seat.seatNumber)}
                    onToggle={onToggle}
                  />
                ))}
              </div>
            </div>

            {/* Lối đi */}
            <div className="h-full min-h-[140px] flex flex-col items-center justify-center py-2 border-x border-dashed border-slate-200 bg-slate-100/50 rounded">
              <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest [writing-mode:vertical-lr] my-auto">
                Lối đi
              </span>
            </div>

            <div>
              <p className="text-[10px] font-black text-center text-slate-600 uppercase mb-2">
                Dãy phải
              </p>
              <div className="grid grid-cols-2 gap-1.5 justify-items-center">
                {rightSeats.map((seat) => (
                  <SeatButton
                    key={seat.tripSeatId}
                    seat={seat.seatNumber}
                    booked={seat.status !== 'TRONG'}
                    selected={selectedSeats.includes(seat.seatNumber)}
                    onToggle={onToggle}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Cuối xe */}
          <div className="text-center pt-2 mt-3 border-t border-dashed border-slate-200 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
            Cuối xe
          </div>
        </div>
      )}
    </div>
  );
};

function formatDisplayPhone(phone?: string | null): string {
  if (!phone) return '';
  const trimmed = phone.trim();
  if (trimmed.startsWith('+84')) return '0' + trimmed.slice(3);
  if (trimmed.startsWith('84') && trimmed.length === 11) return '0' + trimmed.slice(2);
  return trimmed;
}

export const RoundTripBooking: React.FC<RoundTripBookingProps> = ({
  outboundPost,
  returnPost,
  departureDate,
  returnDate,
  outboundTripSeats,
  returnTripSeats,
}) => {
  const router = useRouter();
  const { user, executeWithAuth, isAuthenticated } = useAuthSession();
  const [userNameOverride, setUserNameOverride] = useState<string | null>(null);
  const [userPhoneOverride, setUserPhoneOverride] = useState<string | null>(null);
  const [customerEmail, setCustomerEmail] = useState('');
  const [outboundSeats, setOutboundSeats] = useState<string[]>([]);
  const [returnSeats, setReturnSeats] = useState<string[]>([]);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [showVehicleInfoModal, setShowVehicleInfoModal] = useState(false);
  const [showTripDetailModal, setShowTripDetailModal] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    let active = true;
    executeWithAuth((token) => customerApi.getMe(token))
      .then((res) => {
        if (!active || !res?.data) return;
        if (res.data.email) {
          setCustomerEmail((curr) => curr || res.data.email || '');
        }
        if (res.data.fullName) {
          setUserNameOverride((current) => hydrateUntouchedProfileField(current, res.data.fullName));
        }
        if (res.data.phoneNumber) {
          setUserPhoneOverride((current) => hydrateUntouchedProfileField(current, formatDisplayPhone(res.data.phoneNumber)));
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [isAuthenticated, executeWithAuth]);

  const customerName =
    userNameOverride !== null ? userNameOverride : user?.fullName || '';
  const customerPhone =
    userPhoneOverride !== null
      ? userPhoneOverride
      : formatDisplayPhone(user?.phoneNumber) || '';

  const handleReloadUserInfo = () => {
    if (user?.fullName) setUserNameOverride(user.fullName);
    if (user?.phoneNumber) setUserPhoneOverride(formatDisplayPhone(user.phoneNumber));
    executeWithAuth((token) => customerApi.getMe(token))
      .then((res) => {
        if (res?.data) {
          if (res.data.fullName) setUserNameOverride(res.data.fullName);
          if (res.data.phoneNumber) setUserPhoneOverride(formatDisplayPhone(res.data.phoneNumber));
          if (res.data.email) setCustomerEmail(res.data.email);
        }
      })
      .catch(() => {});
  };

  const passengerValidation = validatePassengerInfo({
    fullName: customerName,
    phoneNumber: customerPhone,
    email: customerEmail,
  });
  const passengerErrors = validationAttempted ? passengerValidation.errors : {};

  const returnLocations = getReturnTripLocations(returnPost);

  const outboundDepartureTimeText = formatTripDateTime(
    outboundPost.createdAt,
    outboundPost.timeAgo || (departureDate ? `${departureDate}` : 'Chưa cập nhật'),
  );
  const returnDepartureTimeText = formatTripDateTime(
    returnPost.createdAt,
    returnPost.timeAgo || (returnDate ? `${returnDate}` : 'Chưa cập nhật'),
  );

  const toggleOutboundSeat = (seat: string) => {
    setOutboundSeats((current) =>
      current.includes(seat)
        ? current.filter((item) => item !== seat)
        : [...current, seat],
    );
  };
  const toggleReturnSeat = (seat: string) => {
    setReturnSeats((current) =>
      current.includes(seat)
        ? current.filter((item) => item !== seat)
        : [...current, seat],
    );
  };

  const outboundUnitFare = outboundPost.minPriceNum ?? 0;
  const returnUnitFare = returnPost.minPriceNum ?? 0;
  const outboundFare = outboundUnitFare * outboundSeats.length;
  const returnFare = returnUnitFare * returnSeats.length;
  const totalFare = calculateRoundTripFare({
    outboundUnitFare,
    outboundSeatCount: outboundSeats.length,
    returnUnitFare,
    returnSeatCount: returnSeats.length,
  });
  const departureDateLabel = departureDate
    ? departureDate.split('-').reverse().join('/')
    : outboundPost.createdAt;
  const returnDateLabel = returnDate
    ? returnDate.split('-').reverse().join('/')
    : returnPost.createdAt;
  const departureLabel = departureDate
    ? `${new Intl.DateTimeFormat('vi-VN', { weekday: 'long' }).format(new Date(`${departureDate}T00:00:00`))}, ${departureDateLabel}`
    : departureDateLabel;
  const returnLabel = returnDate
    ? `${new Intl.DateTimeFormat('vi-VN', { weekday: 'long' }).format(new Date(`${returnDate}T00:00:00`))}, ${returnDateLabel}`
    : returnDateLabel;
  const outboundRoute = `${outboundPost.province} - ${outboundPost.district}`;
  const returnRoute = `${returnPost.province} - ${returnPost.district}`;
  const canPay =
    outboundSeats.length > 0 && returnSeats.length > 0 && acceptedTerms;

  return (
    <div className="min-h-screen bg-[#F8FAF9] font-sans pb-12">
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
          <Link href="/" className="hover:text-brand">
            Trang chủ
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
          <Link href="/posts" className="hover:text-brand">
            Khứ hồi
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
          <span className="text-slate-900 font-bold">Đặt vé 2 chiều</span>
        </div>
      </div>

      <main className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-5">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 items-start">
          <section className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            {/* Chọn ghế 2 chiều */}
            <div className="flex flex-col md:flex-row border-b border-slate-200 divide-y md:divide-y-0 md:divide-x divide-slate-200">
              <SeatGrid
                title="Chuyến đi"
                date={departureLabel}
                vehicleType={outboundPost.propertyType}
                tripSeats={outboundTripSeats}
                selectedSeats={outboundSeats}
                onToggle={toggleOutboundSeat}
                onVehicleInfoClick={() => setShowVehicleInfoModal(true)}
              />
              <SeatGrid
                title="Chuyến về"
                date={returnLabel}
                vehicleType={returnPost.propertyType}
                tripSeats={returnTripSeats}
                selectedSeats={returnSeats}
                onToggle={toggleReturnSeat}
                onVehicleInfoClick={() => setShowVehicleInfoModal(true)}
              />
            </div>

            {/* Chú giải */}
            <div className="p-3 border-b border-slate-200 bg-slate-50 flex justify-center gap-8 text-[11px] font-bold text-slate-600">
              <span className="inline-flex items-center gap-2">
                <SeatIcon className="w-4 h-5 fill-slate-200 stroke-slate-300" />{' '}
                Đã bán
              </span>
              <span className="inline-flex items-center gap-2">
                <SeatIcon className="w-4 h-5 fill-sky-100 stroke-sky-300" /> Còn
                trống
              </span>
              <span className="inline-flex items-center gap-2">
                <SeatIcon className="w-4 h-5 fill-[#F5A623] stroke-[#D98A12]" />{' '}
                Đang chọn
              </span>
            </div>

            {/* Thông tin khách hàng & Điều khoản */}
            <div className="grid grid-cols-1 md:grid-cols-2 border-b border-slate-200 divide-y md:divide-y-0 md:divide-x divide-slate-200">
              <div className="p-4 md:p-5">
                <h2 className="text-base font-black text-slate-950 mb-4">
                  Thông tin khách hàng
                </h2>
                <div className="space-y-4">
                  <label className="block">
                    <span className="text-xs font-bold text-slate-700">
                      Họ và tên <span className="text-red-500">*</span>
                    </span>
                    <div className="mt-1.5 relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        className={`h-11 w-full rounded-lg border pl-9 pr-3 text-sm font-semibold outline-none focus:border-brand ${
                          passengerErrors.fullName
                            ? 'border-red-500'
                            : 'border-slate-300'
                        }`}
                        value={customerName}
                        onChange={(e) => setUserNameOverride(e.target.value)}
                        placeholder="Nhập họ và tên"
                      />
                    </div>
                    {passengerErrors.fullName && (
                      <p className="mt-1 text-xs text-red-500 font-medium">
                        {passengerErrors.fullName}
                      </p>
                    )}
                  </label>
                  <label className="block">
                    <span className="text-xs font-bold text-slate-700">
                      Số điện thoại <span className="text-red-500">*</span>
                    </span>
                    <div className="mt-1.5 relative">
                      <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        className={`h-11 w-full rounded-lg border pl-9 pr-3 text-sm font-semibold outline-none focus:border-brand ${
                          passengerErrors.phoneNumber
                            ? 'border-red-500'
                            : 'border-slate-300'
                        }`}
                        value={customerPhone}
                        onChange={(e) => setUserPhoneOverride(e.target.value)}
                        placeholder="Nhập số điện thoại"
                      />
                    </div>
                    {passengerErrors.phoneNumber && (
                      <p className="mt-1 text-xs text-red-500 font-medium">
                        {passengerErrors.phoneNumber}
                      </p>
                    )}
                  </label>
                  <label className="block">
                    <span className="text-xs font-bold text-slate-700">
                      Email <span className="text-red-500">*</span>
                    </span>
                    <div className="mt-1.5 relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        className={`h-11 w-full rounded-lg border pl-9 pr-3 text-sm font-semibold outline-none focus:border-brand ${
                          passengerErrors.email
                            ? 'border-red-500'
                            : 'border-slate-300'
                        }`}
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        placeholder="Nhập email"
                      />
                    </div>
                    {passengerErrors.email && (
                      <p className="mt-1 text-xs text-red-500 font-medium">
                        {passengerErrors.email}
                      </p>
                    )}
                  </label>
                </div>
              </div>

              <div className="p-4 md:p-5">
                <h2 className="text-base font-black text-accent mb-4 uppercase">
                  Điều khoản & Lưu ý
                </h2>
                <div className="space-y-3 text-[11px] font-semibold text-slate-700 leading-relaxed">
                  <p className="text-accent font-black">
                    Quý khách vui lòng đăng nhập tài khoản để nhận chương trình
                    khuyến mãi.
                  </p>
                  <p>
                    (*) Quý khách vui lòng có mặt tại bến xuất phát của xe trước
                    ít nhất 30 phút giờ xe khởi hành, mang theo thông báo đã
                    thanh toán vé thành công. Vui lòng liên hệ Trung tâm tổng
                    đài <strong className="text-accent">1900 6067</strong> để
                    được hỗ trợ.
                  </p>
                  <p>
                    (*) Nếu quý khách có nhu cầu trung chuyển, vui lòng liên hệ
                    Tổng đài trung chuyển{' '}
                    <strong className="text-accent">1900 6918</strong> trước khi
                    đặt vé. Chúng tôi không đón/trung chuyển tại những điểm xe
                    trung chuyển không thể tới được.
                  </p>
                </div>
              </div>
            </div>
            <div className="p-4 border-b border-slate-200">
              <label className="flex items-start gap-2 cursor-pointer group w-fit">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(event) => setAcceptedTerms(event.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-brand"
                />
                <span className="text-xs font-semibold text-slate-600 group-hover:text-slate-900 leading-relaxed">
                  <span className="text-accent underline underline-offset-2">
                    Chấp nhận điều khoản
                  </span>{' '}
                  đặt vé & chính sách bảo mật thông tin của VexGo
                </span>
              </label>
            </div>

            {/* Thông tin đón trả 2 chiều */}
            <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-200">
              <div className="flex-1 p-4 md:p-5">
                <h2 className="text-base font-black text-slate-950 mb-4 flex items-center gap-2">
                  Thông tin đón trả <Info className="w-4 h-4 text-accent" />
                </h2>
                <p className="text-xs font-bold text-slate-500 mb-4 capitalize">
                  Chuyến đi - {departureLabel}
                </p>

                <div className="space-y-4">
                  <div>
                    <h3 className="text-xs font-black text-slate-700 uppercase mb-3">
                      Điểm đón
                    </h3>
                    <div className="flex items-center gap-4 text-xs font-bold text-slate-600 mb-2">
                      <label className="inline-flex items-center gap-1.5 text-accent">
                        <input
                          type="radio"
                          name="pickupOut"
                          defaultChecked
                          className="accent-accent"
                        />{' '}
                        Bến xe/VP
                      </label>
                      <label className="inline-flex items-center gap-1.5">
                        <input
                          type="radio"
                          name="pickupOut"
                          className="accent-accent"
                        />{' '}
                        Trung chuyển
                      </label>
                    </div>
                    <select className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm font-semibold outline-none focus:border-brand">
                      <option>{outboundPost.province}</option>
                    </select>
                    <p className="text-[11px] font-semibold text-slate-600 mt-2">
                      Quý khách vui lòng có mặt tại điểm đón{' '}
                      <strong className="text-accent">
                        trước giờ khởi hành ({outboundDepartureTimeText})
                      </strong>{' '}
                      để kiểm tra thông tin trước khi lên xe.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-xs font-black text-slate-700 uppercase mb-3">
                      Điểm trả
                    </h3>
                    <div className="flex items-center gap-4 text-xs font-bold text-slate-600 mb-2">
                      <label className="inline-flex items-center gap-1.5 text-accent">
                        <input
                          type="radio"
                          name="dropoffOut"
                          defaultChecked
                          className="accent-accent"
                        />{' '}
                        Bến xe/VP
                      </label>
                      <label className="inline-flex items-center gap-1.5">
                        <input
                          type="radio"
                          name="dropoffOut"
                          className="accent-accent"
                        />{' '}
                        Trung chuyển
                      </label>
                    </div>
                    <select className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm font-semibold outline-none focus:border-brand">
                      <option>{outboundPost.district}</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex-1 p-4 md:p-5">
                <h2 className="text-base font-black text-slate-950 mb-4 flex items-center gap-2">
                  Thông tin đón trả <Info className="w-4 h-4 text-accent" />
                </h2>
                <p className="text-xs font-bold text-slate-500 mb-4 capitalize">
                  Chuyến về - {returnLabel}
                </p>

                <div className="space-y-4">
                  <div>
                    <h3 className="text-xs font-black text-slate-700 uppercase mb-3">
                      Điểm đón
                    </h3>
                    <div className="flex items-center gap-4 text-xs font-bold text-slate-600 mb-2">
                      <label className="inline-flex items-center gap-1.5 text-accent">
                        <input
                          type="radio"
                          name="pickupIn"
                          defaultChecked
                          className="accent-accent"
                        />{' '}
                        Bến xe/VP
                      </label>
                      <label className="inline-flex items-center gap-1.5">
                        <input
                          type="radio"
                          name="pickupIn"
                          className="accent-accent"
                        />{' '}
                        Trung chuyển
                      </label>
                    </div>
                    <select className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm font-semibold outline-none focus:border-brand">
                      <option>{returnLocations.pickup}</option>
                    </select>
                    <p className="text-[11px] font-semibold text-slate-600 mt-2">
                      Quý khách vui lòng có mặt tại điểm đón{' '}
                      <strong className="text-accent">
                        trước giờ khởi hành ({returnDepartureTimeText})
                      </strong>{' '}
                      để kiểm tra thông tin trước khi lên xe.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-xs font-black text-slate-700 uppercase mb-3">
                      Điểm trả
                    </h3>
                    <div className="flex items-center gap-4 text-xs font-bold text-slate-600 mb-2">
                      <label className="inline-flex items-center gap-1.5 text-accent">
                        <input
                          type="radio"
                          name="dropoffIn"
                          defaultChecked
                          className="accent-accent"
                        />{' '}
                        Bến xe/VP
                      </label>
                      <label className="inline-flex items-center gap-1.5">
                        <input
                          type="radio"
                          name="dropoffIn"
                          className="accent-accent"
                        />{' '}
                        Trung chuyển
                      </label>
                    </div>
                    <select className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm font-semibold outline-none focus:border-brand">
                      <option>{returnLocations.dropoff}</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Thanh toán Footer */}
            <div className="p-4 md:p-5 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex px-2 py-1 rounded-md bg-brand text-white text-[10px] font-black">
                    VEXGO
                  </span>
                  <span className="text-xs font-bold text-slate-500">
                    Tổng tiền
                  </span>
                </div>
                <span className="text-2xl font-black text-red-600">
                  {totalFare.toLocaleString('vi-VN')}đ
                </span>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="min-h-11 px-6 rounded-lg border border-slate-300 bg-white text-slate-600 font-bold text-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={!canPay}
                  onClick={() => {
                    setValidationAttempted(true);
                    if (!passengerValidation.isValid) {
                      return;
                    }
                    if (
                      outboundSeats.length === 0 ||
                      returnSeats.length === 0
                    ) {
                      alert(
                        'Vui lòng chọn ghế cho cả lượt đi và lượt về để tiếp tục.',
                      );
                      return;
                    }
                    if (!acceptedTerms) {
                      alert(
                        'Vui lòng chấp nhận điều khoản đặt vé & chính sách bảo mật để tiếp tục.',
                      );
                      return;
                    }
                    const draft = createPaymentDraft({
                      tripType: 'round-trip',
                      passenger: {
                        fullName: customerName.trim(),
                        phoneNumber: customerPhone.trim(),
                        email: customerEmail.trim(),
                      },
                      legs: [
                        {
                          tripId: outboundPost.id,
                          route: outboundRoute,
                          departureTime: outboundDepartureTimeText,
                          seats: outboundSeats,
                          pickup: outboundPost.province,
                          dropoff: outboundPost.district,
                          unitFare: outboundUnitFare,
                          subtotal: outboundFare,
                        },
                        {
                          tripId: returnPost.id,
                          route: returnRoute,
                          departureTime: returnDepartureTimeText,
                          seats: returnSeats,
                          pickup: returnLocations.pickup,
                          dropoff: returnLocations.dropoff,
                          unitFare: returnUnitFare,
                          subtotal: returnFare,
                        },
                      ],
                      totalFare,
                    });
                    router.push(
                      `/payment?draftId=${encodeURIComponent(draft.id)}`,
                    );
                  }}
                  className="min-h-11 px-6 rounded-lg bg-accent text-white font-bold text-sm hover:bg-accent-hover shadow-sm disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  Thanh toán
                </button>
              </div>
            </div>
          </section>

          {/* Sidebar */}
          <aside className="space-y-4 lg:sticky lg:top-24">
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-black text-slate-900 text-sm">
                  Thông tin chuyến đi
                </h3>
                <button
                  type="button"
                  onClick={() => setShowTripDetailModal(true)}
                  className="min-h-11 px-2 text-xs font-bold text-accent hover:underline cursor-pointer"
                >
                  Chi tiết
                </button>
              </div>
              <div className="space-y-2 text-xs font-semibold text-slate-600">
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Tuyến xe</span>
                  <span className="text-right text-slate-900">
                    {outboundRoute}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Thời gian xuất bến</span>
                  <span className="text-emerald-600 font-black text-right">
                    {outboundDepartureTimeText}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Loại ghế</span>
                  <span className="text-slate-900 font-bold">
                    {outboundPost.propertyType?.toUpperCase().includes('GIƯỜNG') || outboundTripSeats.some((s) => s.position?.includes('Tầng')) ? 'Giường nằm' : 'Ghế ngồi'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Số lượng ghế</span>
                  <span className="text-slate-900">
                    {outboundSeats.length} Ghế
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Số ghế</span>
                  <span className="text-brand font-bold">
                    {outboundSeats.join(', ') || '-'}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-100">
                  <span className="text-slate-500 font-bold">
                    Tổng tiền lượt đi
                  </span>
                  <span className="text-accent font-black">
                    {outboundFare.toLocaleString('vi-VN')}đ
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-black text-slate-900 text-sm">
                  Thông tin chuyến về
                </h3>
                <button
                  type="button"
                  onClick={() => setShowTripDetailModal(true)}
                  className="min-h-11 px-2 text-xs font-bold text-accent hover:underline cursor-pointer"
                >
                  Chi tiết
                </button>
              </div>
              <div className="space-y-2 text-xs font-semibold text-slate-600">
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Tuyến xe</span>
                  <span className="text-right text-slate-900">
                    {returnRoute}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Thời gian xuất bến</span>
                  <span className="text-emerald-600 font-black text-right">
                    {returnDepartureTimeText}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Loại ghế</span>
                  <span className="text-slate-900 font-bold">
                    {returnPost.propertyType?.toUpperCase().includes('GIƯỜNG') || returnTripSeats.some((s) => s.position?.includes('Tầng')) ? 'Giường nằm' : 'Ghế ngồi'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Số lượng ghế</span>
                  <span className="text-slate-900">
                    {returnSeats.length} Ghế
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Số ghế</span>
                  <span className="text-brand font-bold">
                    {returnSeats.join(', ') || '-'}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-100">
                  <span className="text-slate-500 font-bold">
                    Tổng tiền lượt về
                  </span>
                  <span className="text-accent font-black">
                    {returnFare.toLocaleString('vi-VN')}đ
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
              <h3 className="font-black text-slate-900 text-sm mb-4 flex items-center gap-1.5">
                Chi tiết giá <Info className="w-3.5 h-3.5 text-accent" />
              </h3>
              <div className="space-y-3 text-xs font-semibold text-slate-600">
                <div className="flex justify-between">
                  <span>Giá vé lượt đi</span>
                  <span>{outboundFare.toLocaleString('vi-VN')}đ</span>
                </div>
                <div className="flex justify-between">
                  <span>Giá vé lượt về</span>
                  <span>{returnFare.toLocaleString('vi-VN')}đ</span>
                </div>
                <div className="flex justify-between">
                  <span>Phí thanh toán</span>
                  <span>0đ</span>
                </div>
                <div className="flex justify-between pt-3 border-t border-slate-200">
                  <span className="text-sm font-bold text-slate-900">
                    Tổng tiền
                  </span>
                  <span className="text-sm font-black text-accent">
                    {totalFare.toLocaleString('vi-VN')}đ
                  </span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>

      <FeaturePlaceholderModal
        isOpen={showVehicleInfoModal}
        onClose={() => setShowVehicleInfoModal(false)}
        title="Tính năng sắp có"
        message="Thông tin xe sẽ được bổ sung ở phiên bản sau."
      />

      <FeaturePlaceholderModal
        isOpen={showTripDetailModal}
        onClose={() => setShowTripDetailModal(false)}
        title="Tính năng sắp có"
        message="Chi tiết chuyến đi sẽ được bổ sung ở phiên bản sau."
      />
    </div>
  );
};
