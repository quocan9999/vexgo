/* eslint-disable */
'use client';

import React, { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Armchair,
  Bus,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Info,
  Mail,
  MapPin,
  Package,
  PackageCheck,
  Phone,
  Ticket,
  User,
  X,
} from 'lucide-react';
import type { Post } from '@/features/posts/types/post';
import { LuggageStep } from './luggage/luggage-step';
import { LuggageSummary } from './luggage/luggage-summary';
import type { ILuggageItem } from './luggage/luggage-item';
import {
  canPayForOneWayBooking,
  formatTripDateTime,
} from '../utils/one-way-booking';
import { validatePassengerInfo } from '../utils/passenger-validation';
import { hydrateUntouchedProfileField } from '../utils/profile-hydration';
import { createPaymentDraft } from '../services/payment-draft';
import { FeaturePlaceholderModal } from './feature-placeholder-modal';
import { useAuthSession } from '@/features/auth/auth-session';
import { customerApi } from '@/features/account/services/customer.api';
import { bookingsApi } from '@/features/account/services/bookings.api';
import { tripsApi, type ApiTripSeat } from '@/features/trips/services/trips.api';

export interface OneWayBookingProps {
  post: Post;
  tripSeats: ApiTripSeat[];
}

const formatDisplayPhone = (phone?: string | null): string => {
  if (!phone) return '';
  if (phone.startsWith('+84')) {
    return '0' + phone.slice(3);
  }
  return phone;
};

export const OneWayBooking: React.FC<OneWayBookingProps> = ({
  post,
  tripSeats,
}) => {
  const router = useRouter();
  const { user, executeWithAuth, isAuthenticated } = useAuthSession();
  const isTicket = post.needType === 'BUY';
  const [userNameOverride, setUserNameOverride] = useState<string | null>(null);
  const [userPhoneOverride, setUserPhoneOverride] = useState<string | null>(null);
  const [customerEmail, setCustomerEmail] = useState('');
  const [pickupOverride, setPickupOverride] = useState<string | null>(null);
  const [dropoffOverride, setDropoffOverride] = useState<string | null>(null);

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
  const pickup = pickupOverride !== null ? pickupOverride : post.province;
  const dropoff = dropoffOverride !== null ? dropoffOverride : post.district;

  const [validationAttempted, setValidationAttempted] = useState(false);
  const [showVehicleInfoModal, setShowVehicleInfoModal] = useState(false);

  const passengerValidation = validatePassengerInfo({
    fullName: customerName,
    phoneNumber: customerPhone,
    email: customerEmail,
  });
  const passengerErrors = validationAttempted ? passengerValidation.errors : {};

  const departureDateTimeText = formatTripDateTime(
    post.createdAt,
    post.timeAgo,
  );

  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [showTripInfoModal, setShowTripInfoModal] = useState(false);
  const [showCargoInfoModal, setShowCargoInfoModal] = useState(false);
  const [isAcceptedTerms, setIsAcceptedTerms] = useState(false);
  const descriptionLines = post.description
    .split('\n')
    .map((line: string) => line.trim())
    .filter(Boolean);
  const checklist = descriptionLines
    .filter((line: string) => line.startsWith('-'))
    .map((line: string) => line.slice(1).trim());
  const paragraphs = descriptionLines.filter(
    (line: string) =>
      !line.startsWith('-') &&
      !line.toLowerCase().includes('yêu cầu nghiệp vụ'),
  );
  const isSleeper =
    post.propertyType?.toUpperCase().includes('GIƯỜNG') ||
    tripSeats.some((s) => s.position?.includes('Tầng'));

  const seatGroups = Object.entries(
    tripSeats.reduce<Record<string, string[]>>((groups, seat) => {
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
      (groups[label] ??= []).push(seat.seatNumber);
      return groups;
    }, {}),
  );

  seatGroups.forEach(([, seats]) => {
    seats.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  });
  seatGroups.sort(([a], [b]) => {
    if (a.toLowerCase().includes('dưới')) return -1;
    if (b.toLowerCase().includes('dưới')) return 1;
    return a.localeCompare(b);
  });

  const bookedSeats = new Set(
    tripSeats
      .filter((seat) => seat.status !== 'TRONG')
      .map((seat) => seat.seatNumber),
  );
  const [cargoCapacity, setCargoCapacity] = useState<{
    acceptsShipments: boolean;
    capacities: {
      motorcycles: { total: number; used: number; remaining: number };
      bulkyGoods: { total: number; used: number; remaining: number };
      parcels: { total: number; used: number; remaining: number };
    };
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const tripId = Number(post.id);
    if (!Number.isNaN(tripId) && tripId > 0) {
      tripsApi
        .getCargoCapacity(tripId)
        .then((res) => {
          if (active && res) {
            setCargoCapacity(res);
          }
        })
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [post.id]);

  const [luggageFee, setLuggageFee] = useState(0);
  const [luggageWeight, setLuggageWeight] = useState(0);
  const [luggageItems, setLuggageItems] = useState<ILuggageItem[]>([]);

  const handleLuggageChange = useCallback(
    (fee: number, weight: number, items: ILuggageItem[]) => {
      setLuggageFee(fee);
      setLuggageWeight(weight);
      setLuggageItems(items);
    },
    [],
  );

  const selectedSeatText = selectedSeats.join(', ');
  const baseFare = post.price.split(' - ')[0];
  const baseFareNumber = Number(baseFare.replace(/[^\d]/g, '')) || 0;
  const totalFare = baseFareNumber * selectedSeats.length + luggageFee;
  const totalFareText = totalFare.toLocaleString('vi-VN');
  const canPay = canPayForOneWayBooking(selectedSeats, isAcceptedTerms);

  const toggleSeat = (seat: string) => {
    if (bookedSeats.has(seat)) return;
    setSelectedSeats((prev) =>
      prev.includes(seat)
        ? prev.filter((item) => item !== seat)
        : [...prev, seat],
    );
  };


  const ChairIcon = ({
    className = 'w-[36px] h-[44px]',
  }: {
    className?: string;
  }) => (
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

  const SteeringWheelIcon = ({
    className = 'w-4 h-4',
  }: {
    className?: string;
  }) => (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="3" />
      <line x1="12" y1="2" x2="12" y2="9" />
      <line x1="4.93" y1="19.07" x2="9.88" y2="14.12" />
      <line x1="19.07" y1="19.07" x2="14.12" y2="14.12" />
    </svg>
  );

  const SeatIcon = ChairIcon;

  let leftSeats: string[] = [];
  let rightSeats: string[] = [];
  if (!isSleeper) {
    const unassigned: string[] = [];
    tripSeats.forEach((seat) => {
      const pos = seat.position?.toLowerCase() || '';
      if (pos.includes('trái')) {
        leftSeats.push(seat.seatNumber);
      } else if (pos.includes('phải')) {
        rightSeats.push(seat.seatNumber);
      } else {
        unassigned.push(seat.seatNumber);
      }
    });

    if (leftSeats.length === 0 && rightSeats.length === 0) {
      const all = tripSeats.map((s) => s.seatNumber);
      all.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      for (let i = 0; i < all.length; i += 4) {
        if (i < all.length) leftSeats.push(all[i]);
        if (i + 1 < all.length) leftSeats.push(all[i + 1]);
        if (i + 2 < all.length) rightSeats.push(all[i + 2]);
        if (i + 3 < all.length) rightSeats.push(all[i + 3]);
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
    leftSeats.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    rightSeats.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }

  const SeatButton = ({ seat }: { seat: string }) => {
    const isBooked = bookedSeats.has(seat);
    const isSelected = selectedSeats.includes(seat);

    let seatClass = '';
    let textClass = '';

    if (isBooked) {
      seatClass = 'fill-slate-200 stroke-slate-300';
      textClass = 'text-slate-400';
    } else if (isSelected) {
      seatClass = 'fill-[#F5A623] stroke-[#D98A12]';
      textClass = 'text-white';
    } else {
      seatClass =
        'fill-sky-100 stroke-sky-300 group-hover:fill-sky-200 group-hover:stroke-sky-400 transition-colors';
      textClass = 'text-sky-600';
    }

    return (
      <button
        type="button"
        disabled={isBooked}
        aria-label={`${seat}${isBooked ? ' đã bán' : isSelected ? ' đang chọn' : ' còn trống'}`}
        aria-pressed={isSelected}
        className="group relative min-h-11 min-w-11 inline-flex flex-col items-center justify-center rounded-md disabled:cursor-not-allowed disabled:opacity-60 hover:scale-105 active:scale-95 disabled:hover:scale-100 disabled:active:scale-100 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        onClick={() => toggleSeat(seat)}
      >
        <SeatIcon className={`w-[36px] h-[44px] ${seatClass}`} />
        <span
          className={`absolute top-[10px] text-[10px] font-bold ${textClass}`}
        >
          {seat}
        </span>
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-[#F8FAF9] font-sans pb-12">
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex items-center gap-1 text-[15px] font-medium text-slate-700 hover:text-[#F05929] transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            Quay lại
          </button>
        </div>
      </div>

      <main className="max-w-[1160px] mx-auto px-4 sm:px-6 lg:px-8 py-5">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 items-start">
          <section className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 md:p-5 border-b border-slate-200">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 sm:gap-3">
                    <h2 className="text-xl font-black text-slate-950">
                      Chọn ghế
                    </h2>
                    <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                      {tripSeats.length} chỗ
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-amber-50 text-amber-700 border-amber-200">
                      {isSleeper ? 'Giường nằm' : 'Ghế ngồi'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowVehicleInfoModal(true)}
                      className="text-xs font-bold text-accent hover:underline cursor-pointer ml-2"
                    >
                      Thông tin xe
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-5 text-[11px] font-bold text-slate-600">
                  <span className="inline-flex items-center gap-1.5">
                    <SeatIcon className="w-4 h-5 fill-slate-200 stroke-slate-300" />{' '}
                    Đã bán
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <SeatIcon className="w-4 h-5 fill-sky-100 stroke-sky-300" />{' '}
                    Còn trống
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <SeatIcon className="w-4 h-5 fill-[#F5A623] stroke-[#D98A12]" />{' '}
                    Đang chọn
                  </span>
                </div>
              </div>

              {/* Sơ đồ ghế phân biệt: Xe giường nằm vs Xe ghế ngồi */}
              {isSleeper ? (
                /* === XE GIƯỜNG NẰM: 2 TẦNG (TẦNG DƯỚI & TẦNG TRÊN) === */
                <div className="mt-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {seatGroups.map(([label, seats]) => (
                      <div
                        key={label}
                        className="bg-slate-50/80 border border-slate-200 rounded-xl p-4 flex flex-col items-center"
                      >
                        <div className="w-full flex items-center justify-between pb-3 mb-3 border-b border-dashed border-slate-200 px-2">
                          <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500">
                            <SteeringWheelIcon className="w-4 h-4 text-slate-400" />
                            Tài xế
                          </div>
                          <span className="text-xs font-black uppercase text-[#0060c4] tracking-wide">
                            {label}
                          </span>
                          <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                            Cửa lên 🚪
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-3 justify-items-center">
                          {seats.map((seat) => (
                            <SeatButton key={seat} seat={seat} />
                          ))}
                        </div>

                        <div className="w-full text-center pt-3 mt-4 border-t border-dashed border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          Cuối xe
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* === XE GHẾ NGỒI: 1 TẦNG VỚI LỐI ĐI Ở GIỮA === */
                <div className="mt-5 max-w-[540px] mx-auto">
                  <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-4 sm:p-5">
                    {/* Đầu xe */}
                    <div className="flex items-center justify-between pb-3 mb-4 border-b border-dashed border-slate-200 px-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-white px-3 py-1 rounded-md border border-slate-200 shadow-2xs">
                        <SteeringWheelIcon className="w-4 h-4 text-slate-500" />
                        Tài xế
                      </div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Đầu xe
                      </span>
                      <div className="text-xs font-bold text-slate-600 bg-white px-3 py-1 rounded-md border border-slate-200 shadow-2xs">
                        Cửa lên 🚪
                      </div>
                    </div>

                    {/* Thân xe: Dãy trái | LỐI ĐI | Dãy phải */}
                    <div className="grid grid-cols-[1fr_48px_1fr] gap-2 items-start">
                      {/* Dãy trái */}
                      <div>
                        <p className="text-[11px] font-black text-center text-slate-600 uppercase mb-3">
                          Dãy trái
                        </p>
                        <div className="grid grid-cols-2 gap-2 justify-items-center">
                          {leftSeats.map((seat) => (
                            <SeatButton key={seat} seat={seat} />
                          ))}
                        </div>
                      </div>

                      {/* Lối đi dọc thân xe */}
                      <div className="h-full min-h-[180px] flex flex-col items-center justify-center py-4 border-x border-dashed border-slate-200 bg-slate-100/50 rounded">
                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest [writing-mode:vertical-lr] my-auto">
                          Lối đi
                        </span>
                      </div>

                      {/* Dãy phải */}
                      <div>
                        <p className="text-[11px] font-black text-center text-slate-600 uppercase mb-3">
                          Dãy phải
                        </p>
                        <div className="grid grid-cols-2 gap-2 justify-items-center">
                          {rightSeats.map((seat) => (
                            <SeatButton key={seat} seat={seat} />
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Đuôi xe */}
                    <div className="text-center pt-3 mt-4 border-t border-dashed border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Cuối xe
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 border-b border-slate-200">
              <div className="p-4 md:p-5 border-b lg:border-b-0 lg:border-r border-slate-200">
                <h2 className="text-base font-black text-slate-950 mb-4">
                  Thông tin khách hàng
                </h2>
                <div className="space-y-3">
                  <label className="block">
                    <span className="text-xs font-bold text-slate-700">
                      Họ và tên <span className="text-red-500">*</span>
                    </span>
                    <div className="mt-1.5 relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        className={`h-11 w-full rounded-lg border pl-9 pr-3 text-sm font-semibold outline-none focus:border-accent ${
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
                        className={`h-11 w-full rounded-lg border pl-9 pr-3 text-sm font-semibold outline-none focus:border-accent ${
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
                        className={`h-11 w-full rounded-lg border pl-9 pr-3 text-sm font-semibold outline-none focus:border-accent ${
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
                <h2 className="text-base font-black text-accent mb-4">
                  Điều khoản & lưu ý
                </h2>
                <div className="space-y-3 text-xs font-semibold text-slate-700 leading-relaxed">
                  <p className="text-accent font-black">
                    Quý khách vui lòng đăng nhập tài khoản để nhận chương trình
                    khuyến mãi và tích điểm.
                  </p>
                  <p>
                    Quý khách vui lòng có mặt tại bến xuất phát trước ít nhất 20
                    phút. Vé điện tử sẽ được gửi qua email hoặc SMS sau khi
                    thanh toán thành công.
                  </p>
                  <p>
                    Nếu có nhu cầu trung chuyển, vui lòng liên hệ tổng đài{' '}
                    <strong className="text-accent">1900 6789</strong> để được
                    hỗ trợ.
                  </p>
                  {paragraphs.slice(0, 1).map((line: string) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 md:p-5 border-b border-slate-200">
              <h2 className="text-base font-black text-slate-950 mb-4 flex items-center gap-2">
                Thông đón trả
                <Info className="w-4 h-4 text-accent" />
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-3">
                  <h3 className="text-xs font-black text-slate-700 uppercase">
                    Điểm đón
                  </h3>
                  <div className="flex items-center gap-4 text-xs font-bold text-slate-600">
                    <label className="inline-flex items-center gap-1.5 text-accent">
                      <input
                        type="radio"
                        name="pickup"
                        defaultChecked
                        className="accent-[#EF5222]"
                      />
                      Bến xe/VP
                    </label>
                    <label className="inline-flex items-center gap-1.5">
                      <input
                        type="radio"
                        name="pickup"
                        className="accent-[#EF5222]"
                      />
                      Trung chuyển
                    </label>
                  </div>
                  <select
                    value={pickup}
                    onChange={(e) => setPickupOverride(e.target.value)}
                    className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-accent"
                  >
                    <option value={post.province}>{post.province}</option>
                    <option value={`Bến xe ${post.province}`}>
                      Bến xe {post.province}
                    </option>
                  </select>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Quý khách vui lòng có mặt tại điểm đón trước giờ khởi hành
                    tối thiểu 20 phút.
                  </p>
                </div>

                <div className="space-y-3">
                  <h3 className="text-xs font-black text-slate-700 uppercase">
                    Điểm trả
                  </h3>
                  <div className="flex items-center gap-4 text-xs font-bold text-slate-600">
                    <label className="inline-flex items-center gap-1.5 text-accent">
                      <input
                        type="radio"
                        name="dropoff"
                        defaultChecked
                        className="accent-[#EF5222]"
                      />
                      Bến xe/VP
                    </label>
                    <label className="inline-flex items-center gap-1.5">
                      <input
                        type="radio"
                        name="dropoff"
                        className="accent-[#EF5222]"
                      />
                      Trung chuyển
                    </label>
                  </div>
                  <select
                    value={dropoff}
                    onChange={(e) => setDropoffOverride(e.target.value)}
                    className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-accent"
                  >
                    <option value={post.district}>{post.district}</option>
                    <option value={`Bến xe ${post.district}`}>
                      Bến xe {post.district}
                    </option>
                  </select>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Điểm trả cụ thể sẽ được xác nhận lại trong vé điện tử sau
                    thanh toán.
                  </p>
                </div>
              </div>
            </div>

            <LuggageStep
              route={`${post.province} - ${post.district}`}
              time={departureDateTimeText}
              seat={selectedSeatText}
              passenger={customerName || 'Khách hàng'}
              cargoCapacity={cargoCapacity}
              onFeeChange={handleLuggageChange}
            />

            <div className="p-4 md:p-5 border-b border-slate-200 flex items-center justify-center">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <div
                  className={`w-5 h-5 rounded-md border-[1.5px] flex items-center justify-center transition-colors ${isAcceptedTerms ? 'bg-accent border-accent' : 'bg-white border-slate-300'}`}
                >
                  {isAcceptedTerms && (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-3.5 h-3.5 text-white"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
                <input
                  type="checkbox"
                  className="hidden"
                  checked={isAcceptedTerms}
                  onChange={(e) => setIsAcceptedTerms(e.target.checked)}
                />
                <span className="text-[13px] md:text-sm text-slate-800">
                  <span className="text-accent font-bold underline underline-offset-2">
                    Chấp nhận điều khoản
                  </span>{' '}
                  đặt vé & chính sách bảo mật thông tin của VexGo
                </span>
              </label>
            </div>

            <div className="p-4 md:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex px-2 py-1 rounded-md bg-brand text-white text-[10px] font-black">
                    VEXGO
                  </span>
                  <span className="text-xs font-bold text-slate-500">
                    Tổng tiền
                  </span>
                </div>
                <p className="text-2xl font-black text-red-600">
                  {totalFareText}đ
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="h-11 px-8 rounded-full border border-slate-300 text-slate-700 text-sm font-bold hover:bg-slate-50 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={!canPay || isSubmitting}
                  onClick={async () => {
                    setValidationAttempted(true);
                    setSubmitError(null);
                    if (!passengerValidation.isValid) {
                      return;
                    }
                    if (selectedSeats.length === 0) {
                      alert('Vui lòng chọn ít nhất một ghế để tiếp tục.');
                      return;
                    }
                    if (!isAcceptedTerms) {
                      alert(
                        'Vui lòng chấp nhận điều khoản đặt vé & chính sách bảo mật để tiếp tục.',
                      );
                      return;
                    }

                    setIsSubmitting(true);
                    try {
                      const tripIdNum = Number(post.id);

                      // Kiểm tra giới hạn kích thước hành lý (ngoại trừ xe máy, xe đạp)
                      const oversizedItem = luggageItems.find(
                        (item) =>
                          item.type !== 'Xe máy' &&
                          item.type !== 'Xe đạp' &&
                          ((item.length && item.length > 150) ||
                            (item.width && item.width > 80) ||
                            (item.height && item.height > 80)),
                      );
                      if (oversizedItem) {
                        alert(
                          `Kiện "${oversizedItem.type}" vượt quá kích thước cho phép của hầm xe khách (Dài ≤ 150cm, Rộng ≤ 80cm, Cao ≤ 80cm). Vui lòng điều chỉnh lại kích thước.`,
                        );
                        setIsSubmitting(false);
                        return;
                      }
                      // Kiểm tra tổng khối lượng hành lý thông thường đi kèm vé: tối đa 40kg
                      if (luggageWeight > 40) {
                        alert(
                          `Tổng khối lượng hành lý (${luggageWeight}kg) vượt quá hạn mức đi kèm vé (tối đa 40kg). Vui lòng chuyển qua phần "Gửi hàng bưu kiện" hoặc liên hệ nhà xe để gửi hàng riêng.`,
                        );
                        setIsSubmitting(false);
                        return;
                      }
                      const validCargoItems =
                        luggageItems.filter(
                          (item) =>
                            item.type === 'Xe máy' ||
                            item.type === 'Xe đạp' ||
                            (item.weight || 0) > 0 ||
                            (item.length && item.width && item.height),
                        );

                      const mappedCargoItems =
                        validCargoItems.length > 0 && luggageFee > 0
                          ? validCargoItems.map((item) => ({
                              name:
                                item.type === 'Xe máy'
                                  ? `Xe máy (${item.motorbikeType || 'Xe số'})`
                                  : item.type === 'Xe đạp'
                                    ? `Xe đạp (${item.bicycleType || 'Xe đạp thường'})`
                                    : (item.type || 'Hành lý gửi kèm'),
                              type: item.type,
                              quantity: item.quantity || 1,
                              weight: item.type === 'Xe máy' ? 100 : item.type === 'Xe đạp' ? 15 : (item.weight || 0),
                              length: item.length,
                              width: item.width,
                              height: item.height,
                              category: item.category,
                              note: item.note,
                              motorbikeModel: item.motorbikeType || item.bicycleType,
                              licensePlate: item.licensePlate,
                            }))
                          : undefined;

                      const bookingPayload = {
                        tripId: tripIdNum,
                        seatNumbers: selectedSeats,
                        passenger: {
                          fullName: customerName.trim(),
                          phoneNumber: customerPhone.trim(),
                          email: customerEmail.trim(),
                        },
                        pickup: pickup || post.province,
                        dropoff: dropoff || post.district,
                        cargoItems: mappedCargoItems,
                      };

                      let bookingResult: any = null;
                      if (isAuthenticated) {
                        try {
                          const res = await executeWithAuth((token) =>
                            bookingsApi.createBooking(bookingPayload, token),
                          );
                          bookingResult = res.data ?? res;
                        } catch (err: any) {
                          // Fallback as unauthenticated if auth error
                          const res = await bookingsApi.createBooking(bookingPayload);
                          bookingResult = res.data ?? res;
                        }
                      } else {
                        const res = await bookingsApi.createBooking(bookingPayload);
                        bookingResult = res.data ?? res;
                      }

                      const finalLuggageFee =
                        bookingResult?.shippingFee !== undefined
                          ? Number(bookingResult.shippingFee)
                          : luggageFee;
                      const finalTotalFare =
                        bookingResult?.totalAmount !== undefined
                          ? Number(bookingResult.totalAmount)
                          : totalFare;

                      const draft = createPaymentDraft({
                        tripType: 'one-way',
                        passenger: {
                          fullName: customerName.trim(),
                          phoneNumber: customerPhone.trim(),
                          email: customerEmail.trim(),
                        },
                        legs: [
                          {
                            tripId: post.id,
                            route:
                              post.title || `${post.province} - ${post.district}`,
                            departureTime: departureDateTimeText,
                            seats: selectedSeats,
                            pickup: pickup || post.province,
                            dropoff: dropoff || post.district,
                            unitFare: baseFareNumber,
                            subtotal: baseFareNumber * selectedSeats.length,
                          },
                        ],
                        luggage:
                          luggageWeight > 0 || finalLuggageFee > 0
                            ? {
                                fee: finalLuggageFee,
                                weight: luggageWeight,
                                items: luggageItems,
                                info:
                                  luggageItems.length > 0 && luggageWeight > 0
                                    ? {
                                        count: luggageItems.length,
                                        weight: luggageWeight,
                                        fee: finalLuggageFee,
                                        category:
                                          luggageItems[0]?.category || 'normal',
                                      }
                                    : undefined,
                              }
                            : undefined,
                        totalFare: finalTotalFare,
                        bookingId: bookingResult?.bookingId,
                        bookingCode: bookingResult?.bookingCode,
                        orderCode: bookingResult?.orderCode,
                      });

                      router.push(
                        `/payment?draftId=${encodeURIComponent(draft.id)}`,
                      );
                    } catch (err: any) {
                      const msg =
                        err?.message ||
                        'Đã xảy ra lỗi khi tạo đơn đặt vé. Vui lòng thử lại.';
                      setSubmitError(msg);
                      alert(msg);
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                  className="h-11 px-8 rounded-full bg-accent hover:bg-accent-hover text-white text-sm font-black transition-colors disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {isSubmitting ? 'Đang xử lý...' : 'Thanh toán'}
                </button>
              </div>
            </div>
          </section>

          <aside className="space-y-4 lg:sticky lg:top-24">
            <section className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h2 className="text-base font-black text-slate-950">
                  Thông tin chuyến đi
                </h2>
                <button
                  type="button"
                  onClick={() => setShowTripInfoModal(true)}
                  className="text-xs font-black text-accent hover:underline"
                >
                  Chi tiết
                </button>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500 font-semibold">Tuyến xe</span>
                  <strong className="text-slate-950 text-right">
                    {post.province} - {post.district}
                  </strong>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500 font-semibold">
                    Thời gian xuất bến
                  </span>
                  <strong className="text-emerald-600">
                    {departureDateTimeText}
                  </strong>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500 font-semibold">Loại ghế</span>
                  <strong className="text-slate-950">
                    {isSleeper ? 'Giường nằm' : 'Ghế ngồi'}
                  </strong>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500 font-semibold">
                    Số lượng ghế
                  </span>
                  <strong className="text-slate-950">
                    {selectedSeats.length} ghế
                  </strong>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500 font-semibold">Số ghế</span>
                  <strong className="text-slate-950 text-right">
                    {selectedSeatText || 'Chưa chọn'}
                  </strong>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500 font-semibold">
                    Tiền vé ({selectedSeats.length} ghế)
                  </span>
                  <strong className="text-red-600">
                    {(baseFareNumber * selectedSeats.length).toLocaleString('vi-VN')}đ
                  </strong>
                </div>
              </div>
            </section>

            {luggageItems.length > 0 && (
              <section className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
                <div className="mb-3 pb-2.5 border-b border-slate-100">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-base font-black text-slate-950">
                      Hàng gửi hầm xe
                    </h2>
                    <button
                      type="button"
                      onClick={() => setShowCargoInfoModal(true)}
                      className="text-xs font-black text-accent hover:underline"
                    >
                      Chi tiết
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-accent bg-accent/10 px-2.5 py-0.5 rounded-full border border-accent/20">
                      {luggageItems.length} kiện • {Number(luggageWeight.toFixed(2))}kg
                    </span>
                  </div>
                </div>
                <div className="space-y-2.5">
                  {luggageItems.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="p-3 rounded-xl bg-slate-50/90 border border-slate-200/80 flex items-start justify-between gap-3 transition-colors hover:bg-slate-100/70"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 text-xs">
                            Kiện {idx + 1}: {item.type}
                          </span>
                          {item.quantity > 1 && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-200 text-slate-700">
                              x{item.quantity}
                            </span>
                          )}
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

                        {item.type === 'Xe máy' ? (
                          <div className="flex items-center gap-2 text-[11px] text-slate-600 font-medium mt-1 flex-wrap">
                            <span className="font-semibold text-slate-800">{item.motorbikeType || 'Xe số'}</span>
                            {item.licensePlate && (
                              <>
                                <span className="text-slate-300">•</span>
                                <span className="bg-slate-200 text-slate-800 font-bold px-1.5 py-0.2 rounded text-[10px]">
                                  {item.licensePlate}
                                </span>
                              </>
                            )}
                          </div>
                        ) : item.type === 'Xe đạp' ? (
                          <div className="flex items-center gap-2 text-[11px] text-slate-600 font-medium mt-1 flex-wrap">
                            <span className="font-semibold text-slate-800">{item.bicycleType || 'Xe đạp thường'}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-[11px] text-slate-600 font-medium mt-1 flex-wrap">
                            <span>
                              {item.weight > 0 ? (
                                <strong className="text-slate-800">{Number((item.weight).toFixed(2))} kg</strong>
                              ) : (
                                <span className="text-slate-600 font-normal">Chưa nhập khối lượng</span>
                              )}
                            </span>
                            {item.length && item.width && item.height ? (
                              (() => {
                                const vol = Number(((item.length * item.width * item.height) / 5000).toFixed(2));
                                return (
                                  <>
                                    <span className="text-slate-300">•</span>
                                    <span className="text-slate-500">
                                      {item.length}×{item.width}×{item.height}cm
                                    </span>
                                    {vol > (item.weight || 0) && (
                                      <span className="text-[10px] text-accent font-bold bg-accent/10 px-1.5 py-0.2 rounded">
                                        (Tính cước: {vol}kg quy đổi)
                                      </span>
                                    )}
                                  </>
                                );
                              })()
                            ) : null}
                          </div>
                        )}

                        {item.note && (
                          <p className="text-[11px] text-slate-500 italic mt-1 line-clamp-2">
                            "{item.note}"
                          </p>
                        )}
                      </div>

                      {(() => {
                        if (item.type === 'Xe máy') {
                          const motoFee = 250000 * (item.quantity || 1);
                          return (
                            <div className="text-right shrink-0">
                              <span className="text-xs font-extrabold text-red-600">
                                +{motoFee.toLocaleString('vi-VN')}đ
                              </span>
                            </div>
                          );
                        }

                        if (item.type === 'Xe đạp') {
                          const bikeFee = 100000 * (item.quantity || 1);
                          return (
                            <div className="text-right shrink-0">
                              <span className="text-xs font-extrabold text-red-600">
                                +{bikeFee.toLocaleString('vi-VN')}đ
                              </span>
                            </div>
                          );
                        }

                        const actualW = item.weight || 0;
                        const volW =
                          item.length && item.width && item.height
                            ? Math.round(((item.length * item.width * item.height) / 5000) * 10) / 10
                            : 0;
                        const effW = Math.max(actualW, volW) * (item.quantity || 1);
                        let itemFee = 0;
                        if (effW <= 20) itemFee = 0;
                        else if (effW <= 40) itemFee = 30000;
                        else itemFee = -1; // Vượt quá 40kg phải qua phần gửi hàng

                        return (
                          <div className="text-right shrink-0">
                            {itemFee === 0 ? (
                              <span className="text-xs font-bold text-emerald-600">
                                Miễn phí
                              </span>
                            ) : itemFee > 0 ? (
                              <span className="text-xs font-extrabold text-red-600">
                                +{itemFee.toLocaleString('vi-VN')}đ
                              </span>
                            ) : (
                              <span className="text-[11px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                Cần gửi hàng riêng
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
              <h2 className="text-base font-black text-slate-950 mb-4 flex items-center gap-1.5">
                Chi tiết giá
                <Info className="w-5 h-5 text-accent" />
              </h2>
              <div className="space-y-3 text-sm pb-4 border-b border-slate-100">
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500 font-semibold">
                    Giá vé lượt đi ({selectedSeats.length} ghế)
                  </span>
                  <strong className="text-red-600">
                    {(baseFareNumber * selectedSeats.length).toLocaleString('vi-VN')}đ
                  </strong>
                </div>

                <LuggageSummary fee={luggageFee} totalWeight={luggageWeight} />
              </div>
              <div className="pt-4 flex justify-between gap-3 text-sm">
                <span className="text-slate-500 font-black">Tổng tiền</span>
                <strong className="text-red-600 text-base">
                  {totalFareText}đ
                </strong>
              </div>
            </section>
          </aside>
        </div>
      </main>

      {showTripInfoModal && (
        <div
          className="fixed inset-0 z-[80] bg-black/45 px-4 py-6 flex items-start justify-center"
          onClick={() => setShowTripInfoModal(false)}
        >
          <section
            className="w-full max-w-[340px] rounded-xl bg-white p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-slate-950">
                  Thông tin chuyến đi (1)
                </h2>
                <span className="w-5 h-5 rounded-full border-[1.5px] border-accent text-accent flex items-center justify-center font-black text-[10px]">
                  i
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowTripInfoModal(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-800 hover:bg-slate-100"
                aria-label="Đóng chi tiết chuyến đi"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 rounded-lg border border-slate-200 p-3 bg-slate-50">
              <div className="flex flex-col gap-2.5 text-xs">
                <div className="flex justify-between gap-2">
                  <span className="font-bold text-slate-500">Tuyến xe</span>
                  <strong className="text-right text-slate-950">
                    {post.province} - {post.district}
                  </strong>
                </div>

                <div className="flex justify-between gap-2">
                  <span className="font-bold text-slate-500">Xuất bến</span>
                  <strong className="text-right text-emerald-600">
                    {departureDateTimeText}
                  </strong>
                </div>

                <div className="flex justify-between gap-2">
                  <span className="font-bold text-slate-500">Số lượng ghế</span>
                  <strong className="text-right text-slate-950">
                    {selectedSeats.length}
                  </strong>
                </div>

                <div className="flex justify-between gap-2">
                  <span className="font-bold text-slate-500">Số ghế</span>
                  <strong className="text-right text-slate-950">
                    {selectedSeatText || 'Chưa chọn'}
                  </strong>
                </div>

                <div className="flex justify-between gap-2 pt-2.5 border-t border-slate-200 mt-0.5">
                  <span className="font-black text-slate-700">Tổng tiền</span>
                  <strong className="text-right text-red-600 text-sm">
                    {totalFareText}đ
                  </strong>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {showCargoInfoModal && (
        <div
          className="fixed inset-0 z-[80] bg-black/45 px-4 py-6 flex items-start justify-center"
          onClick={() => setShowCargoInfoModal(false)}
        >
          <section
            className="w-full max-w-[420px] rounded-xl bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-base font-black text-slate-950">
                  Chi tiết hàng gửi hầm xe
                </h2>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Tổng cộng: {luggageItems.length} kiện • {Number(luggageWeight.toFixed(2))}kg
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCargoInfoModal(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-800 hover:bg-slate-100"
                aria-label="Đóng chi tiết hàng gửi"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-3.5 space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
              {luggageItems.map((item, idx) => {
                const isMoto = item.type === 'Xe máy';
                const isBike = item.type === 'Xe đạp';
                const actualW = item.weight || 0;
                const volW =
                  !isMoto && !isBike && item.length && item.width && item.height
                    ? Math.round(((item.length * item.width * item.height) / 5000) * 10) / 10
                    : 0;
                const effW = Math.max(actualW, volW) * (item.quantity || 1);

                let itemFee = 0;
                if (isMoto) {
                  itemFee = 250000 * (item.quantity || 1);
                } else if (isBike) {
                  itemFee = 100000 * (item.quantity || 1);
                } else {
                  if (effW <= 20) itemFee = 0;
                  else if (effW <= 40) itemFee = 30000;
                  else itemFee = -1;
                }

                return (
                  <div
                    key={item.id || idx}
                    className="p-3 rounded-lg border border-slate-200 bg-slate-50 text-xs flex items-start justify-between gap-3"
                  >
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <strong className="text-slate-900 font-bold">
                          {isMoto || isBike ? `Phương tiện ${idx + 1}: ${item.type}` : `Kiện ${idx + 1}: ${item.type}`}
                        </strong>
                        {item.quantity > 1 && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-200 text-slate-700">
                            x{item.quantity}
                          </span>
                        )}
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

                      {isMoto ? (
                        <div className="flex items-center gap-2 text-[11px] text-slate-600 font-medium flex-wrap">
                          <span className="font-semibold text-slate-800">{item.motorbikeType || 'Xe số'}</span>
                          {item.licensePlate && (
                            <>
                              <span className="text-slate-300">•</span>
                              <span className="font-mono bg-slate-200/80 px-1.5 py-0.5 rounded text-slate-800 font-bold text-[10px]">
                                {item.licensePlate}
                              </span>
                            </>
                          )}
                        </div>
                      ) : isBike ? (
                        <div className="flex items-center gap-2 text-[11px] text-slate-600 font-medium flex-wrap">
                          <span className="font-semibold text-slate-800">{item.bicycleType || 'Xe đạp thường'}</span>
                        </div>
                      ) : (
                        <div className="text-slate-600 flex items-center gap-1.5 flex-wrap">
                          <span>
                            {actualW > 0 ? (
                              <strong className="text-slate-800 font-semibold">{Number(actualW.toFixed(2))} kg</strong>
                            ) : (
                              <span className="text-slate-600 font-normal">Chưa nhập khối lượng</span>
                            )}
                          </span>
                          {item.length && item.width && item.height ? (
                            <>
                              <span className="text-slate-300">•</span>
                              <span>{item.length}×{item.width}×{item.height}cm</span>
                              {volW > actualW && (
                                <span className="text-accent font-semibold">
                                  ({volW}kg quy đổi)
                                </span>
                              )}
                            </>
                          ) : null}
                        </div>
                      )}

                      {item.note && (
                        <p className="text-slate-500 italic mt-0.5">
                          "{item.note}"
                        </p>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      {itemFee === 0 ? (
                        <span className="font-bold text-emerald-600">Miễn phí</span>
                      ) : itemFee < 0 ? (
                        <span className="font-bold text-red-600">Quá 40kg</span>
                      ) : (
                        <span className="font-extrabold text-red-600">+{itemFee.toLocaleString('vi-VN')}đ</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between text-xs">
              <span className="font-bold text-slate-600">Tổng phụ phí hành lý</span>
              <strong className="text-red-600 text-sm">
                {luggageFee === 0 ? 'Miễn phí' : `${luggageFee.toLocaleString('vi-VN')}đ`}
              </strong>
            </div>
          </section>
        </div>
      )}

      <FeaturePlaceholderModal
        isOpen={showVehicleInfoModal}
        onClose={() => setShowVehicleInfoModal(false)}
        title="Tính năng sắp có"
        message="Thông tin xe sẽ được bổ sung ở phiên bản sau."
      />
    </div>
  );
};
