'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, Info, Mail, Phone, User, X } from 'lucide-react';
import type { Post } from '@/features/posts/types/post';
import { tripsApi, type ApiTripSeat } from '@/features/trips/services/trips.api';
import {
  calculateRoundTripFare,
  getReturnTripLocations,
} from '../utils/round-trip-booking';
import { formatTripDateTime } from '../utils/one-way-booking';
import { validatePassengerInfo } from '../utils/passenger-validation';
import { createPaymentDraft } from '../services/payment-draft';
import { bookingsApi } from '@/features/account/services/bookings.api';
import { FeaturePlaceholderModal } from './feature-placeholder-modal';
import { LuggageStep } from './luggage/luggage-step';
import type { ILuggageItem } from './luggage/luggage-item';
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
  const [showOutboundTripModal, setShowOutboundTripModal] = useState(false);
  const [showReturnTripModal, setShowReturnTripModal] = useState(false);
  const [showCargoInfoModal, setShowCargoInfoModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sức chứa hàng hóa cho Chuyến đi
  const [outboundCargoCapacity, setOutboundCargoCapacity] = useState<{
    acceptsShipments: boolean;
    capacities: {
      motorcycles: { total: number; used: number; remaining: number };
      bulkyGoods: { total: number; used: number; remaining: number };
      parcels: { total: number; used: number; remaining: number };
    };
  } | null>(null);

  // Sức chứa hàng hóa cho Chuyến về
  const [returnCargoCapacity, setReturnCargoCapacity] = useState<{
    acceptsShipments: boolean;
    capacities: {
      motorcycles: { total: number; used: number; remaining: number };
      bulkyGoods: { total: number; used: number; remaining: number };
      parcels: { total: number; used: number; remaining: number };
    };
  } | null>(null);

  useEffect(() => {
    let active = true;
    const outboundTripId = Number(outboundPost.id);
    if (!Number.isNaN(outboundTripId) && outboundTripId > 0) {
      tripsApi
        .getCargoCapacity(outboundTripId)
        .then((res) => {
          if (active && res) {
            setOutboundCargoCapacity(res);
          }
        })
        .catch(() => {});
    }
    const returnTripId = Number(returnPost.id);
    if (!Number.isNaN(returnTripId) && returnTripId > 0) {
      tripsApi
        .getCargoCapacity(returnTripId)
        .then((res) => {
          if (active && res) {
            setReturnCargoCapacity(res);
          }
        })
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [outboundPost.id, returnPost.id]);

  // Hành lý chuyến đi
  const [outboundLuggageFee, setOutboundLuggageFee] = useState(0);
  const [outboundLuggageWeight, setOutboundLuggageWeight] = useState(0);
  const [outboundLuggageItems, setOutboundLuggageItems] = useState<ILuggageItem[]>([]);

  // Hành lý chuyến về
  const [returnLuggageFee, setReturnLuggageFee] = useState(0);
  const [returnLuggageWeight, setReturnLuggageWeight] = useState(0);
  const [returnLuggageItems, setReturnLuggageItems] = useState<ILuggageItem[]>([]);

  // Tùy chọn: Áp dụng giống chuyến đi
  const [copyOutboundToReturn, setCopyOutboundToReturn] = useState(false);

  const handleOutboundLuggageChange = useCallback(
    (fee: number, weight: number, items: ILuggageItem[]) => {
      setOutboundLuggageFee(fee);
      setOutboundLuggageWeight(weight);
      setOutboundLuggageItems(items);
      if (copyOutboundToReturn) {
        setReturnLuggageItems(
          items.map((it) => ({
            ...it,
            id: `return-${it.id || Math.random().toString(36).slice(2, 9)}`,
          })),
        );
        setReturnLuggageFee(fee);
        setReturnLuggageWeight(weight);
      }
    },
    [copyOutboundToReturn],
  );

  const handleReturnLuggageChange = useCallback(
    (fee: number, weight: number, items: ILuggageItem[]) => {
      setReturnLuggageFee(fee);
      setReturnLuggageWeight(weight);
      setReturnLuggageItems(items);
    },
    [],
  );

  // Khi người dùng tích/bỏ tích "Áp dụng giống chuyến đi"
  const handleToggleCopyOutbound = (checked: boolean) => {
    setCopyOutboundToReturn(checked);
    if (checked) {
      // Sao chép các món hàng từ chuyến đi sang chuyến về (tạo id mới để độc lập)
      const copiedItems: ILuggageItem[] = outboundLuggageItems.map((item) => ({
        ...item,
        id: `return-${item.id || Math.random().toString(36).slice(2, 9)}`,
      }));
      setReturnLuggageItems(copiedItems);
      setReturnLuggageFee(outboundLuggageFee);
      setReturnLuggageWeight(outboundLuggageWeight);
    } else {
      setReturnLuggageItems([]);
      setReturnLuggageFee(0);
      setReturnLuggageWeight(0);
    }
  };

  const luggageFee = outboundLuggageFee + returnLuggageFee;
  const luggageWeight = outboundLuggageWeight + returnLuggageWeight;
  const allLuggageItems = [
    ...outboundLuggageItems.map((it) => ({ ...it, legTitle: 'Chuyến đi' as const })),
    ...returnLuggageItems.map((it) => ({ ...it, legTitle: 'Chuyến về' as const })),
  ];

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
  const totalFare =
    calculateRoundTripFare({
      outboundUnitFare,
      outboundSeatCount: outboundSeats.length,
      returnUnitFare,
      returnSeatCount: returnSeats.length,
    }) + luggageFee;
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

            {/* Phần Hành lý / Hàng gửi 2 chiều */}
            <div className="border-b border-slate-200 divide-y divide-slate-200">
              {/* Hành lý Chuyến đi */}
              <div className="bg-white">
                <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide">
                      Hành lý / Hàng gửi • Chuyến đi ({outboundRoute})
                    </h3>
                  </div>
                  {outboundLuggageFee > 0 && (
                    <span className="text-xs font-black text-red-600">
                      +{outboundLuggageFee.toLocaleString('vi-VN')}đ
                    </span>
                  )}
                </div>
                <LuggageStep
                  route={outboundRoute}
                  time={outboundDepartureTimeText}
                  seat={`Ghế: ${outboundSeats.join(', ') || '-'}`}
                  passenger={customerName || 'Khách hàng'}
                  cargoCapacity={outboundCargoCapacity}
                  onFeeChange={handleOutboundLuggageChange}
                />
              </div>

              {/* Hành lý Chuyến về */}
              <div className="bg-white">
                <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide">
                      Hành lý / Hàng gửi • Chuyến về ({returnRoute})
                    </h3>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Checkbox sao chép từ chuyến đi */}
                    <label className="inline-flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-accent hover:text-accent-hover transition-colors">
                      <input
                        type="checkbox"
                        checked={copyOutboundToReturn}
                        onChange={(e) => handleToggleCopyOutbound(e.target.checked)}
                        className="rounded border-slate-300 text-accent focus:ring-accent accent-accent w-4 h-4 cursor-pointer"
                      />
                      <span>Áp dụng giống chuyến đi</span>
                    </label>

                    {returnLuggageFee > 0 && (
                      <span className="text-xs font-black text-red-600">
                        +{returnLuggageFee.toLocaleString('vi-VN')}đ
                      </span>
                    )}
                  </div>
                </div>

                {copyOutboundToReturn ? (
                  <div className="p-4 md:p-6 text-center bg-slate-50/50">
                    <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-accent/10 border border-accent/20 text-xs font-bold text-accent">
                      <span>✓ Đã sao chép danh sách hành lý & phương tiện từ chuyến đi (+{returnLuggageFee.toLocaleString('vi-VN')}đ)</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1.5 font-medium">
                      Bỏ tích "Áp dụng giống chuyến đi" ở trên nếu bạn muốn chỉnh sửa hoặc không gửi hàng ở chuyến về.
                    </p>
                  </div>
                ) : (
                  <LuggageStep
                    route={returnRoute}
                    time={returnDepartureTimeText}
                    seat={`Ghế: ${returnSeats.join(', ') || '-'}`}
                    passenger={customerName || 'Khách hàng'}
                    cargoCapacity={returnCargoCapacity}
                    onFeeChange={handleReturnLuggageChange}
                  />
                )}
              </div>
            </div>

            <div className="p-4 md:p-5 border-b border-slate-200 flex items-center justify-center">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <div
                  className={`w-5 h-5 rounded-md border-[1.5px] flex items-center justify-center transition-colors ${acceptedTerms ? 'bg-accent border-accent' : 'bg-white border-slate-300'}`}
                >
                  {acceptedTerms && (
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
                  checked={acceptedTerms}
                  onChange={(event) => setAcceptedTerms(event.target.checked)}
                />
                <span className="text-[13px] md:text-sm text-slate-800">
                  <span className="text-accent font-bold underline underline-offset-2">
                    Chấp nhận điều khoản
                  </span>{' '}
                  đặt vé & chính sách bảo mật thông tin của VexGo
                </span>
              </label>
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
                  disabled={!canPay || isSubmitting}
                  onClick={async () => {
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

                    // Kiểm tra giới hạn kích thước hành lý (ngoại trừ xe máy, xe đạp)
                    const oversizedItem = allLuggageItems.find(
                      (item) =>
                        item.type !== 'Xe máy' &&
                        item.type !== 'Xe đạp' &&
                        ((item.length && item.length > 150) ||
                          (item.width && item.width > 80) ||
                          (item.height && item.height > 80)),
                    );
                    if (oversizedItem) {
                      alert(
                        `Kiện "${oversizedItem.type}" (${oversizedItem.legTitle}) vượt quá kích thước cho phép của hầm xe khách (Dài ≤ 150cm, Rộng ≤ 80cm, Cao ≤ 80cm). Vui lòng điều chỉnh lại kích thước.`,
                      );
                      return;
                    }

                    // Kiểm tra tổng khối lượng hành lý thông thường mỗi chiều: tối đa 40kg/chuyến
                    if (outboundLuggageWeight > 40 || returnLuggageWeight > 40) {
                      const exceedLeg = outboundLuggageWeight > 40 ? 'Chuyến đi' : 'Chuyến về';
                      const exceedWeight = outboundLuggageWeight > 40 ? outboundLuggageWeight : returnLuggageWeight;
                      alert(
                        `Tổng khối lượng hành lý ${exceedLeg} (${exceedWeight}kg) vượt quá hạn mức đi kèm vé (tối đa 40kg/chuyến). Vui lòng chuyển qua phần "Gửi hàng bưu kiện" hoặc liên hệ nhà xe để gửi hàng riêng.`,
                      );
                      return;
                    }

                    setIsSubmitting(true);
                    let backendBookingId: number | undefined = undefined;
                    let backendBookingCode: string | undefined = undefined;
                    let backendOrderCode: string | undefined = undefined;

                    // Thử tạo đơn đặt vé chặng đi trên backend nếu chuyến tồn tại
                    const outboundTripIdNum = Number(outboundPost.id);
                    if (!isNaN(outboundTripIdNum) && outboundTripIdNum > 0) {
                      try {
                        const res = await bookingsApi.createBooking({
                          tripId: outboundTripIdNum,
                          seatNumbers: outboundSeats,
                          passenger: {
                            fullName: customerName.trim(),
                            phoneNumber: customerPhone.trim(),
                            email: customerEmail.trim(),
                          },
                          pickup: outboundPost.province,
                          dropoff: outboundPost.district,
                        });
                        const bData = res?.data ?? res;
                        if (bData?.bookingId) {
                          backendBookingId = bData.bookingId;
                          backendBookingCode = bData.bookingCode;
                          backendOrderCode = bData.orderCode;
                        }
                      } catch {
                        // Tiếp tục luồng thanh toán với mã đặt vé dự phòng nếu chuyến dùng dữ liệu giả lập
                      }
                    }

                    const fallbackDigits = Math.floor(100000 + Math.random() * 900000);
                    const finalBookingCode = backendBookingCode || `VG-${fallbackDigits}`;
                    const finalOrderCode = backendOrderCode || `GD-${fallbackDigits}`;

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
                          busCompanyName: outboundPost.authorName || 'VexGo Transport',
                          vehicleType: outboundPost.propertyType || 'Xe khách chất lượng cao',
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
                          busCompanyName: returnPost.authorName || outboundPost.authorName || 'VexGo Transport',
                          vehicleType: returnPost.propertyType || outboundPost.propertyType || 'Xe khách chất lượng cao',
                        },
                      ],
                      luggage:
                        allLuggageItems.length > 0
                          ? {
                              fee: luggageFee,
                              weight: luggageWeight,
                              items: allLuggageItems.map((item) => ({
                                id: item.id,
                                type: item.type,
                                quantity: item.quantity,
                                weight: item.weight,
                                length: item.length,
                                width: item.width,
                                height: item.height,
                                category: item.category,
                                note: `[${item.legTitle}] ${item.note || ''}`.trim(),
                                motorbikeType: item.motorbikeType,
                                licensePlate: item.licensePlate,
                                bicycleType: item.bicycleType,
                              })),
                            }
                          : undefined,
                      totalFare,
                      bookingId: backendBookingId,
                      bookingCode: finalBookingCode,
                      orderCode: finalOrderCode,
                    });
                    setIsSubmitting(false);
                    router.push(
                      `/payment?draftId=${encodeURIComponent(draft.id)}`,
                    );
                  }}
                  className="min-h-11 px-6 rounded-lg bg-accent text-white font-bold text-sm hover:bg-accent-hover shadow-sm disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  {isSubmitting ? 'Đang xử lý...' : 'Thanh toán'}
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
                  onClick={() => setShowOutboundTripModal(true)}
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
                  onClick={() => setShowReturnTripModal(true)}
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

            {/* Hàng gửi hầm xe Sidebar Card */}
            {allLuggageItems.length > 0 && (
              <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-slate-900 text-sm">
                      Hàng gửi hầm xe
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowCargoInfoModal(true)}
                      className="text-xs font-black text-accent hover:underline"
                    >
                      Chi tiết
                    </button>
                  </div>
                  <div className="flex items-center">
                    <span className="text-[11px] font-bold text-accent bg-accent/10 px-2.5 py-0.5 rounded-full border border-accent/20">
                      {allLuggageItems.length} kiện • {Number(luggageWeight.toFixed(2))}kg
                    </span>
                  </div>
                </div>
                <div className="space-y-2.5">
                  {allLuggageItems.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="p-3 rounded-xl bg-slate-50/90 border border-slate-200/80 flex items-start justify-between gap-3 transition-colors hover:bg-slate-100/70"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                            <span className="text-slate-500 font-medium">
                              {item.legTitle === 'Chuyến đi' ? 'Lượt đi:' : 'Lượt về:'}
                            </span>
                            <span>{item.type}</span>
                          </div>
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
                                <strong className="text-slate-800">{Number(item.weight.toFixed(2))} kg</strong>
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
                        else itemFee = -1;

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
              </div>
            )}

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
                  <span>Hành lý ({luggageWeight}kg)</span>
                  <span className={luggageFee > 0 ? 'text-red-600 font-bold' : 'text-slate-600'}>
                    {luggageFee === 0 ? '0đ' : `+${luggageFee.toLocaleString('vi-VN')}đ`}
                  </span>
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

      {/* Cargo Info Modal */}
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
                  Tổng cộng: {allLuggageItems.length} kiện • {Number(luggageWeight.toFixed(2))}kg
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
              {allLuggageItems.map((item, idx) => {
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
                          <span className="text-slate-500 font-medium mr-1.5">
                            {item.legTitle === 'Chuyến đi' ? 'Lượt đi:' : 'Lượt về:'}
                          </span>
                          {isMoto || isBike ? `Phương tiện: ${item.type}` : `Kiện: ${item.type}`}
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

      {/* Outbound Trip Detail Modal */}
      {showOutboundTripModal && (
        <div
          className="fixed inset-0 z-[80] bg-black/45 px-4 py-6 flex items-start justify-center"
          onClick={() => setShowOutboundTripModal(false)}
        >
          <section
            className="w-full max-w-[340px] rounded-xl bg-white p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-slate-950">
                  Thông tin chuyến đi (Lượt đi)
                </h2>
                <span className="w-5 h-5 rounded-full border-[1.5px] border-accent text-accent flex items-center justify-center font-black text-[10px]">
                  i
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowOutboundTripModal(false)}
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
                    {outboundRoute}
                  </strong>
                </div>

                <div className="flex justify-between gap-2">
                  <span className="font-bold text-slate-500">Xuất bến</span>
                  <strong className="text-right text-emerald-600">
                    {outboundDepartureTimeText}
                  </strong>
                </div>

                <div className="flex justify-between gap-2">
                  <span className="font-bold text-slate-500">Loại ghế</span>
                  <strong className="text-right text-slate-950">
                    {outboundPost.propertyType?.toUpperCase().includes('GIƯỜNG') || outboundTripSeats.some((s) => s.position?.includes('Tầng')) ? 'Giường nằm' : 'Ghế ngồi'}
                  </strong>
                </div>

                <div className="flex justify-between gap-2">
                  <span className="font-bold text-slate-500">Số lượng ghế</span>
                  <strong className="text-right text-slate-950">
                    {outboundSeats.length}
                  </strong>
                </div>

                <div className="flex justify-between gap-2">
                  <span className="font-bold text-slate-500">Số ghế</span>
                  <strong className="text-right text-brand font-bold">
                    {outboundSeats.join(', ') || 'Chưa chọn'}
                  </strong>
                </div>

                <div className="flex justify-between gap-2 pt-2.5 border-t border-slate-200 mt-0.5">
                  <span className="font-black text-slate-700">Tổng tiền lượt đi</span>
                  <strong className="text-right text-red-600 text-sm">
                    {outboundFare.toLocaleString('vi-VN')}đ
                  </strong>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Return Trip Detail Modal */}
      {showReturnTripModal && (
        <div
          className="fixed inset-0 z-[80] bg-black/45 px-4 py-6 flex items-start justify-center"
          onClick={() => setShowReturnTripModal(false)}
        >
          <section
            className="w-full max-w-[340px] rounded-xl bg-white p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-slate-950">
                  Thông tin chuyến đi (Lượt về)
                </h2>
                <span className="w-5 h-5 rounded-full border-[1.5px] border-accent text-accent flex items-center justify-center font-black text-[10px]">
                  i
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowReturnTripModal(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-800 hover:bg-slate-100"
                aria-label="Đóng chi tiết chuyến về"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 rounded-lg border border-slate-200 p-3 bg-slate-50">
              <div className="flex flex-col gap-2.5 text-xs">
                <div className="flex justify-between gap-2">
                  <span className="font-bold text-slate-500">Tuyến xe</span>
                  <strong className="text-right text-slate-950">
                    {returnRoute}
                  </strong>
                </div>

                <div className="flex justify-between gap-2">
                  <span className="font-bold text-slate-500">Xuất bến</span>
                  <strong className="text-right text-emerald-600">
                    {returnDepartureTimeText}
                  </strong>
                </div>

                <div className="flex justify-between gap-2">
                  <span className="font-bold text-slate-500">Loại ghế</span>
                  <strong className="text-right text-slate-950">
                    {returnPost.propertyType?.toUpperCase().includes('GIƯỜNG') || returnTripSeats.some((s) => s.position?.includes('Tầng')) ? 'Giường nằm' : 'Ghế ngồi'}
                  </strong>
                </div>

                <div className="flex justify-between gap-2">
                  <span className="font-bold text-slate-500">Số lượng ghế</span>
                  <strong className="text-right text-slate-950">
                    {returnSeats.length}
                  </strong>
                </div>

                <div className="flex justify-between gap-2">
                  <span className="font-bold text-slate-500">Số ghế</span>
                  <strong className="text-right text-brand font-bold">
                    {returnSeats.join(', ') || 'Chưa chọn'}
                  </strong>
                </div>

                <div className="flex justify-between gap-2 pt-2.5 border-t border-slate-200 mt-0.5">
                  <span className="font-black text-slate-700">Tổng tiền lượt về</span>
                  <strong className="text-right text-red-600 text-sm">
                    {returnFare.toLocaleString('vi-VN')}đ
                  </strong>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
