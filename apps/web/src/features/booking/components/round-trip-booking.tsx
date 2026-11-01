/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, Info, Mail, Phone, User, X } from 'lucide-react';
import type { Post } from '@/features/posts/types/post';
import { tripsApi, type ApiTrip, type ApiTripSeat, type ApiTripStopPoint } from '@/features/trips/services/trips.api';
import {
  calculateRoundTripFare,
  getReturnTripLocations,
} from '../utils/round-trip-booking';
import { getTripSeatFloorLayouts } from '../utils/seat-layout';
import { formatTripDateTime } from '../utils/one-way-booking';
import { validatePassengerInfo } from '../utils/passenger-validation';
import { FeaturePlaceholderModal } from './feature-placeholder-modal';
import { LuggageStep, calculateLuggageFee } from './luggage/luggage-step';
import { LuggageSummary } from './luggage/luggage-summary';
import type { ILuggageItem } from './luggage/luggage-item';
import {
  findOverweightRegularCargoItem,
  getEffectiveCargoUnitWeightKg,
  MAX_REGULAR_CARGO_PACKAGE_WEIGHT_KG,
} from '../utils/cargo-weight';
import { useAuthSession } from '@/features/auth/auth-session';
import { customerApi } from '@/features/account/services/customer.api';
import { hydrateUntouchedProfileField } from '../utils/profile-hydration';
import {
  bookingsApi,
  type CreateBookingPayload,
  type CreatedBookingData,
} from '@/features/account/services/bookings.api';
import { createPaymentDraft } from '@/features/booking/services/payment-draft';
import {
  ApiError,
  shipmentsApi,
  type ShipmentRoutePoints,
} from '@/features/shipments/services/shipments.api';

export interface RoundTripBookingProps {
  outboundPost: Post;
  returnPost: Post;
  departureDate: string;
  returnDate: string;
  outboundTripSeats: ApiTripSeat[];
  returnTripSeats: ApiTripSeat[];
  outboundApiTrip?: ApiTrip;
  returnApiTrip?: ApiTrip;
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
  style?: React.CSSProperties;
}

const SeatButton = ({
  seat,
  booked,
  selected,
  onToggle,
  style,
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
      className="group absolute min-h-11 min-w-11 -translate-x-1/2 -translate-y-1/2 inline-flex items-center justify-center rounded-md disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      style={style}
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
  const seatFloorLayouts = getTripSeatFloorLayouts(tripSeats);
  const isSleeper =
    vehicleType?.toUpperCase().includes('GIƯỜNG') ||
    seatFloorLayouts.some((layout) => layout.floor > 1) ||
    tripSeats.some((seat) => seat.position?.toLocaleLowerCase('vi-VN').includes('tầng'));

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

      <div
        className={
          seatFloorLayouts.length > 1
            ? 'grid grid-cols-2 gap-3 sm:gap-4'
            : 'mx-auto w-full max-w-[420px]'
        }
      >
        {seatFloorLayouts.map((floorLayout) => (
          <div
            key={floorLayout.floor}
            className={`bg-slate-50/80 border border-slate-200 rounded-xl ${isSleeper ? 'p-3' : 'p-3.5'} flex flex-col items-center`}
          >
            <div className="w-full flex items-center justify-between pb-2 mb-3 border-b border-dashed border-slate-200 px-1">
              <span className="text-[10px] font-bold text-slate-400">Tài xế</span>
              <h3 className="text-[11px] font-black text-[#0060c4] uppercase">
                {floorLayout.label}
              </h3>
              <span className="text-[9px] font-bold text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                Cửa lên
              </span>
            </div>
            <div
              className="relative w-full"
              style={{ height: `${floorLayout.heightPx}px` }}
            >
              {floorLayout.seats.map(({ seat, leftPercent, topPx }) => (
                <SeatButton
                  key={seat.tripSeatId}
                  seat={seat.seatNumber}
                  booked={seat.status !== 'TRONG'}
                  selected={selectedSeats.includes(seat.seatNumber)}
                  onToggle={onToggle}
                  style={{ left: `${leftPercent}%`, top: `${topPx}px` }}
                />
              ))}
            </div>
            <div className="w-full text-center pt-2 mt-3 border-t border-dashed border-slate-200 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
              Cuối xe
            </div>
          </div>
        ))}
      </div>
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

function isValidCargoItem(item: ILuggageItem): boolean {
  return (
    item.type === 'Xe máy' ||
    item.type === 'Xe đạp' ||
    (item.weight || 0) > 0 ||
    Boolean(item.length && item.width && item.height)
  );
}

export const RoundTripBooking: React.FC<RoundTripBookingProps> = ({
  outboundPost,
  returnPost,
  departureDate,
  returnDate,
  outboundTripSeats,
  returnTripSeats,
  outboundApiTrip,
  returnApiTrip,
}) => {
  const router = useRouter();
  const { user, executeWithAuth, isAuthenticated, isHydrated } = useAuthSession();
  const [userNameOverride, setUserNameOverride] = useState<string | null>(null);
  const [userPhoneOverride, setUserPhoneOverride] = useState<string | null>(null);
  const [customerEmail, setCustomerEmail] = useState('');
  const [outboundSeats, setOutboundSeats] = useState<string[]>([]);
  const [returnSeats, setReturnSeats] = useState<string[]>([]);
  const [outboundSeatMap, setOutboundSeatMap] = useState<ApiTripSeat[]>(outboundTripSeats);
  const [returnSeatMap, setReturnSeatMap] = useState<ApiTripSeat[]>(returnTripSeats);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showCustomerInfoAlert, setShowCustomerInfoAlert] = useState(false);
  const [customerInfoAlertMessage, setCustomerInfoAlertMessage] = useState('');
  const mountedRef = useRef(true);
  const submissionLockRef = useRef(false);
  const activeHoldsRef = useRef<{ outbound: string | null; return: string | null; bookingStarted: boolean } | null>(null);
  const [showVehicleInfoModal, setShowVehicleInfoModal] = useState(false);
  const [showOutboundTripModal, setShowOutboundTripModal] = useState(false);
  const [showReturnTripModal, setShowReturnTripModal] = useState(false);
  const [showCargoInfoModal, setShowCargoInfoModal] = useState(false);

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
  const hasCargoItems = allLuggageItems.length > 0;
  const totalFareLabel = 'Tổng tiền';

  const [outboundCargoRoutePoints, setOutboundCargoRoutePoints] =
    useState<ShipmentRoutePoints | null>(null);
  const [returnCargoRoutePoints, setReturnCargoRoutePoints] =
    useState<ShipmentRoutePoints | null>(null);

  useEffect(() => {
    let active = true;
    const tripId = Number(outboundPost.id);
    if (
      outboundLuggageItems.filter(isValidCargoItem).length > 0 &&
      Number.isSafeInteger(tripId) &&
      tripId > 0
    ) {
      shipmentsApi
        .getRoutePoints(tripId)
        .then(({ data }) => {
          if (active) setOutboundCargoRoutePoints(data);
        })
        .catch(() => {});
    } else {
      setOutboundCargoRoutePoints(null);
    }
    return () => {
      active = false;
    };
  }, [outboundLuggageItems, outboundPost.id]);

  useEffect(() => {
    let active = true;
    const tripId = Number(returnPost.id);
    if (
      returnLuggageItems.filter(isValidCargoItem).length > 0 &&
      Number.isSafeInteger(tripId) &&
      tripId > 0
    ) {
      shipmentsApi
        .getRoutePoints(tripId)
        .then(({ data }) => {
          if (active) setReturnCargoRoutePoints(data);
        })
        .catch(() => {});
    } else {
      setReturnCargoRoutePoints(null);
    }
    return () => {
      active = false;
    };
  }, [returnLuggageItems, returnPost.id]);

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


  const passengerValidation = validatePassengerInfo({
    fullName: customerName,
    phoneNumber: customerPhone,
    email: customerEmail,
  });
  const passengerErrors = validationAttempted ? passengerValidation.errors : {};

  const returnLocations = getReturnTripLocations(returnPost);

  // Outbound stop points
  const outboundPickupPoints = React.useMemo(() => outboundApiTrip?.pickupPoints ?? [], [outboundApiTrip]);
  const outboundDropoffPoints = React.useMemo(() => outboundApiTrip?.dropoffPoints ?? [], [outboundApiTrip]);

  const outboundPickupStations = React.useMemo(
    () => outboundPickupPoints.filter((p) => p.type !== 'transfer'),
    [outboundPickupPoints],
  );
  const outboundPickupTransfers = React.useMemo(
    () => outboundPickupPoints.filter((p) => p.type === 'transfer'),
    [outboundPickupPoints],
  );

  const outboundDropoffStations = React.useMemo(
    () => outboundDropoffPoints.filter((p) => p.type !== 'transfer'),
    [outboundDropoffPoints],
  );
  const outboundDropoffTransfers = React.useMemo(
    () => outboundDropoffPoints.filter((p) => p.type === 'transfer'),
    [outboundDropoffPoints],
  );

  const [outboundPickupMode, setOutboundPickupMode] = useState<'station' | 'transfer'>('station');
  const [outboundDropoffMode, setOutboundDropoffMode] = useState<'station' | 'transfer'>('station');

  const [selectedOutboundPickupPointId, setSelectedOutboundPickupPointId] = useState<number | null>(() => {
    const defaultPoint = outboundPickupStations.find((p) => p.isDefault) || outboundPickupStations[0] || outboundPickupTransfers[0];
    return defaultPoint?.diemDonTraChuyenXeId ?? null;
  });

  const [selectedOutboundDropoffPointId, setSelectedOutboundDropoffPointId] = useState<number | null>(() => {
    const defaultPoint = outboundDropoffStations.find((p) => p.isDefault) || outboundDropoffStations[0] || outboundDropoffTransfers[0];
    return defaultPoint?.diemDonTraChuyenXeId ?? null;
  });

  const [outboundPickupOverride, setOutboundPickupOverride] = useState<string | null>(null);
  const [outboundDropoffOverride, setOutboundDropoffOverride] = useState<string | null>(null);

  // Return stop points
  const returnPickupPoints = React.useMemo(() => returnApiTrip?.pickupPoints ?? [], [returnApiTrip]);
  const returnDropoffPoints = React.useMemo(() => returnApiTrip?.dropoffPoints ?? [], [returnApiTrip]);

  const returnPickupStations = React.useMemo(
    () => returnPickupPoints.filter((p) => p.type !== 'transfer'),
    [returnPickupPoints],
  );
  const returnPickupTransfers = React.useMemo(
    () => returnPickupPoints.filter((p) => p.type === 'transfer'),
    [returnPickupPoints],
  );

  const returnDropoffStations = React.useMemo(
    () => returnDropoffPoints.filter((p) => p.type !== 'transfer'),
    [returnDropoffPoints],
  );
  const returnDropoffTransfers = React.useMemo(
    () => returnDropoffPoints.filter((p) => p.type === 'transfer'),
    [returnDropoffPoints],
  );

  const [returnPickupMode, setReturnPickupMode] = useState<'station' | 'transfer'>('station');
  const [returnDropoffMode, setReturnDropoffMode] = useState<'station' | 'transfer'>('station');

  const [selectedReturnPickupPointId, setSelectedReturnPickupPointId] = useState<number | null>(() => {
    const defaultPoint = returnPickupStations.find((p) => p.isDefault) || returnPickupStations[0] || returnPickupTransfers[0];
    return defaultPoint?.diemDonTraChuyenXeId ?? null;
  });

  const [selectedReturnDropoffPointId, setSelectedReturnDropoffPointId] = useState<number | null>(() => {
    const defaultPoint = returnDropoffStations.find((p) => p.isDefault) || returnDropoffStations[0] || returnDropoffTransfers[0];
    return defaultPoint?.diemDonTraChuyenXeId ?? null;
  });

  const [returnPickupOverride, setReturnPickupOverride] = useState<string | null>(null);
  const [returnDropoffOverride, setReturnDropoffOverride] = useState<string | null>(null);

  useEffect(() => {
    if (outboundPickupPoints.length > 0 && selectedOutboundPickupPointId === null) {
      const defaultPoint = outboundPickupStations.find((p) => p.isDefault) || outboundPickupStations[0] || outboundPickupTransfers[0];
      if (defaultPoint?.diemDonTraChuyenXeId) {
        setSelectedOutboundPickupPointId(defaultPoint.diemDonTraChuyenXeId);
        setOutboundPickupMode(defaultPoint.type === 'transfer' ? 'transfer' : 'station');
      }
    }
  }, [outboundPickupPoints, outboundPickupStations, outboundPickupTransfers, selectedOutboundPickupPointId]);

  useEffect(() => {
    if (outboundDropoffPoints.length > 0 && selectedOutboundDropoffPointId === null) {
      const defaultPoint = outboundDropoffStations.find((p) => p.isDefault) || outboundDropoffStations[0] || outboundDropoffTransfers[0];
      if (defaultPoint?.diemDonTraChuyenXeId) {
        setSelectedOutboundDropoffPointId(defaultPoint.diemDonTraChuyenXeId);
        setOutboundDropoffMode(defaultPoint.type === 'transfer' ? 'transfer' : 'station');
      }
    }
  }, [outboundDropoffPoints, outboundDropoffStations, outboundDropoffTransfers, selectedOutboundDropoffPointId]);

  useEffect(() => {
    if (returnPickupPoints.length > 0 && selectedReturnPickupPointId === null) {
      const defaultPoint = returnPickupStations.find((p) => p.isDefault) || returnPickupStations[0] || returnPickupTransfers[0];
      if (defaultPoint?.diemDonTraChuyenXeId) {
        setSelectedReturnPickupPointId(defaultPoint.diemDonTraChuyenXeId);
        setReturnPickupMode(defaultPoint.type === 'transfer' ? 'transfer' : 'station');
      }
    }
  }, [returnPickupPoints, returnPickupStations, returnPickupTransfers, selectedReturnPickupPointId]);

  useEffect(() => {
    if (returnDropoffPoints.length > 0 && selectedReturnDropoffPointId === null) {
      const defaultPoint = returnDropoffStations.find((p) => p.isDefault) || returnDropoffStations[0] || returnDropoffTransfers[0];
      if (defaultPoint?.diemDonTraChuyenXeId) {
        setSelectedReturnDropoffPointId(defaultPoint.diemDonTraChuyenXeId);
        setReturnDropoffMode(defaultPoint.type === 'transfer' ? 'transfer' : 'station');
      }
    }
  }, [returnDropoffPoints, returnDropoffStations, returnDropoffTransfers, selectedReturnDropoffPointId]);

  const selectedOutboundPickupStop = React.useMemo(() => {
    if (!selectedOutboundPickupPointId) return null;
    return outboundPickupPoints.find((p) => p.diemDonTraChuyenXeId === selectedOutboundPickupPointId) ?? null;
  }, [outboundPickupPoints, selectedOutboundPickupPointId]);

  const selectedOutboundDropoffStop = React.useMemo(() => {
    if (!selectedOutboundDropoffPointId) return null;
    return outboundDropoffPoints.find((p) => p.diemDonTraChuyenXeId === selectedOutboundDropoffPointId) ?? null;
  }, [outboundDropoffPoints, selectedOutboundDropoffPointId]);

  const selectedReturnPickupStop = React.useMemo(() => {
    if (!selectedReturnPickupPointId) return null;
    return returnPickupPoints.find((p) => p.diemDonTraChuyenXeId === selectedReturnPickupPointId) ?? null;
  }, [returnPickupPoints, selectedReturnPickupPointId]);

  const selectedReturnDropoffStop = React.useMemo(() => {
    if (!selectedReturnDropoffPointId) return null;
    return returnDropoffPoints.find((p) => p.diemDonTraChuyenXeId === selectedReturnDropoffPointId) ?? null;
  }, [returnDropoffPoints, selectedReturnDropoffPointId]);

  const outboundPickupSurcharge = Number(selectedOutboundPickupStop?.phuPhi ?? 0);
  const outboundDropoffSurcharge = Number(selectedOutboundDropoffStop?.phuPhi ?? 0);
  const outboundTotalSurcharge = outboundPickupSurcharge + outboundDropoffSurcharge;

  const returnPickupSurcharge = Number(selectedReturnPickupStop?.phuPhi ?? 0);
  const returnDropoffSurcharge = Number(selectedReturnDropoffStop?.phuPhi ?? 0);
  const returnTotalSurcharge = returnPickupSurcharge + returnDropoffSurcharge;

  const handleOutboundPickupModeChange = (mode: 'station' | 'transfer') => {
    setOutboundPickupMode(mode);
    const pool = mode === 'transfer' ? outboundPickupTransfers : outboundPickupStations;
    if (pool.length > 0) {
      const first = pool[0];
      setSelectedOutboundPickupPointId(first.diemDonTraChuyenXeId ?? null);
      setOutboundPickupOverride(first.name);
    }
  };

  const handleOutboundDropoffModeChange = (mode: 'station' | 'transfer') => {
    setOutboundDropoffMode(mode);
    const pool = mode === 'transfer' ? outboundDropoffTransfers : outboundDropoffStations;
    if (pool.length > 0) {
      const first = pool[0];
      setSelectedOutboundDropoffPointId(first.diemDonTraChuyenXeId ?? null);
      setOutboundDropoffOverride(first.name);
    }
  };

  const handleReturnPickupModeChange = (mode: 'station' | 'transfer') => {
    setReturnPickupMode(mode);
    const pool = mode === 'transfer' ? returnPickupTransfers : returnPickupStations;
    if (pool.length > 0) {
      const first = pool[0];
      setSelectedReturnPickupPointId(first.diemDonTraChuyenXeId ?? null);
      setReturnPickupOverride(first.name);
    }
  };

  const handleReturnDropoffModeChange = (mode: 'station' | 'transfer') => {
    setReturnDropoffMode(mode);
    const pool = mode === 'transfer' ? returnDropoffTransfers : returnDropoffStations;
    if (pool.length > 0) {
      const first = pool[0];
      setSelectedReturnDropoffPointId(first.diemDonTraChuyenXeId ?? null);
      setReturnDropoffOverride(first.name);
    }
  };

  const handleOutboundPickupSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    const numId = Number(val);
    if (!Number.isNaN(numId) && numId > 0) {
      setSelectedOutboundPickupPointId(numId);
      const stop = outboundPickupPoints.find((p) => p.diemDonTraChuyenXeId === numId);
      if (stop) setOutboundPickupOverride(stop.name);
    } else {
      setOutboundPickupOverride(val);
    }
  };

  const handleOutboundDropoffSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    const numId = Number(val);
    if (!Number.isNaN(numId) && numId > 0) {
      setSelectedOutboundDropoffPointId(numId);
      const stop = outboundDropoffPoints.find((p) => p.diemDonTraChuyenXeId === numId);
      if (stop) setOutboundDropoffOverride(stop.name);
    } else {
      setOutboundDropoffOverride(val);
    }
  };

  const handleReturnPickupSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    const numId = Number(val);
    if (!Number.isNaN(numId) && numId > 0) {
      setSelectedReturnPickupPointId(numId);
      const stop = returnPickupPoints.find((p) => p.diemDonTraChuyenXeId === numId);
      if (stop) setReturnPickupOverride(stop.name);
    } else {
      setReturnPickupOverride(val);
    }
  };

  const handleReturnDropoffSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    const numId = Number(val);
    if (!Number.isNaN(numId) && numId > 0) {
      setSelectedReturnDropoffPointId(numId);
      const stop = returnDropoffPoints.find((p) => p.diemDonTraChuyenXeId === numId);
      if (stop) setReturnDropoffOverride(stop.name);
    } else {
      setReturnDropoffOverride(val);
    }
  };

  const outboundDepartureTimeText = formatTripDateTime(
    outboundPost.createdAt,
    outboundPost.timeAgo || (departureDate ? `${departureDate}` : 'Chưa cập nhật'),
  );
  const returnDepartureTimeText = formatTripDateTime(
    returnPost.createdAt,
    returnPost.timeAgo || (returnDate ? `${returnDate}` : 'Chưa cập nhật'),
  );

  const releaseSeatHoldSafely = useCallback(async (holdToken: string) => {
    try {
      const res = await bookingsApi.releaseSeatHold(holdToken);
      return res.data?.success === true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const active = activeHoldsRef.current;
      if (active && !active.bookingStarted) {
        if (active.outbound) void releaseSeatHoldSafely(active.outbound);
        if (active.return) void releaseSeatHoldSafely(active.return);
        activeHoldsRef.current = null;
      }
    };
  }, [releaseSeatHoldSafely]);

  useEffect(() => {
    setOutboundSeatMap(outboundTripSeats);
  }, [outboundTripSeats]);

  useEffect(() => {
    setReturnSeatMap(returnTripSeats);
  }, [returnTripSeats]);

  const refreshSeatMaps = async () => {
    try {
      const [outSeats, retSeats] = await Promise.all([
        tripsApi.getTripSeats(Number(outboundPost.id)),
        tripsApi.getTripSeats(Number(returnPost.id)),
      ]);
      if (mountedRef.current) {
        setOutboundSeatMap(outSeats);
        setReturnSeatMap(retSeats);
        setOutboundSeats((current) =>
          current.filter((seatNum) =>
            outSeats.some((s) => s.seatNumber === seatNum && s.status === 'TRONG'),
          ),
        );
        setReturnSeats((current) =>
          current.filter((seatNum) =>
            retSeats.some((s) => s.seatNumber === seatNum && s.status === 'TRONG'),
          ),
        );
      }
    } catch {
      // Fallback
    }
  };

  const toggleOutboundSeat = (seat: string) => {
    if (isSubmitting) return;
    setSubmitError(null);
    setOutboundSeats((current) => {
      if (current.includes(seat)) {
        return current.filter((item) => item !== seat);
      }
      if (current.length >= 5) {
        setSubmitError('Chuyến đi chỉ được chọn tối đa 5 ghế.');
        return current;
      }
      return [...current, seat];
    });
  };
  const toggleReturnSeat = (seat: string) => {
    if (isSubmitting) return;
    setSubmitError(null);
    setReturnSeats((current) => {
      if (current.includes(seat)) {
        return current.filter((item) => item !== seat);
      }
      if (current.length >= 5) {
        setSubmitError('Chuyến về chỉ được chọn tối đa 5 ghế.');
        return current;
      }
      return [...current, seat];
    });
  };

  const handleSubmit = async () => {
    if (submissionLockRef.current) return;

    setValidationAttempted(true);
    setSubmitError(null);

    if (!isHydrated) {
      setSubmitError('Đang tải trạng thái tài khoản. Vui lòng đợi rồi thử lại.');
      return;
    }

    if (!passengerValidation.isValid) {
      const missingDetails: string[] = [];
      if (!customerName.trim()) {
        missingDetails.push('Họ và tên');
      }
      if (!customerPhone.trim()) {
        missingDetails.push('Số điện thoại');
      } else if (passengerValidation.errors.phoneNumber) {
        missingDetails.push('Số điện thoại (định dạng chưa đúng)');
      }
      if (!customerEmail.trim()) {
        missingDetails.push('Email');
      } else if (passengerValidation.errors.email) {
        missingDetails.push('Email (định dạng chưa đúng)');
      }

      const msg =
        missingDetails.length > 0
          ? `Quý khách vui lòng nhập đầy đủ và chính xác thông tin khách hàng:\n• ${missingDetails.join('\n• ')}`
          : 'Quý khách vui lòng điền đầy đủ thông tin khách hàng trước khi thanh toán.';

      setCustomerInfoAlertMessage(msg);
      setShowCustomerInfoAlert(true);
      return;
    }

    if (outboundSeats.length === 0) {
      setSubmitError('Vui lòng chọn ít nhất một ghế cho chuyến đi.');
      return;
    }
    if (outboundSeats.length > 5) {
      setSubmitError('Chuyến đi chỉ được chọn tối đa 5 ghế.');
      return;
    }
    if (returnSeats.length === 0) {
      setSubmitError('Vui lòng chọn ít nhất một ghế cho chuyến về.');
      return;
    }
    if (returnSeats.length > 5) {
      setSubmitError('Chuyến về chỉ được chọn tối đa 5 ghế.');
      return;
    }

    if (!acceptedTerms) {
      setSubmitError('Vui lòng chấp nhận điều khoản đặt vé & chính sách bảo mật để tiếp tục.');
      return;
    }

    const oversizedItem = allLuggageItems.find(
      (item) =>
        item.type !== 'Xe máy' &&
        item.type !== 'Xe đạp' &&
        ((item.length && item.length > 150) ||
          (item.width && item.width > 80) ||
          (item.height && item.height > 80)),
    );
    if (oversizedItem) {
      setSubmitError(
        `Kiện "${oversizedItem.type}" (${oversizedItem.legTitle}) vượt quá kích thước cho phép của hầm xe khách (Dài ≤ 150cm, Rộng ≤ 80cm, Cao ≤ 80cm).`,
      );
      return;
    }

    if (outboundLuggageWeight > 40 || returnLuggageWeight > 40) {
      const exceedLeg = outboundLuggageWeight > 40 ? 'chuyến đi' : 'chuyến về';
      const exceedWeight = outboundLuggageWeight > 40 ? outboundLuggageWeight : returnLuggageWeight;
      setSubmitError(
        `Tổng khối lượng hành lý ${exceedLeg} (${exceedWeight}kg) vượt quá hạn mức 40kg/chuyến khi đi kèm vé.`,
      );
      return;
    }

    const outboundTripId = Number(outboundPost.id);
    const returnTripId = Number(returnPost.id);
    if (!Number.isSafeInteger(outboundTripId) || outboundTripId <= 0 || !Number.isSafeInteger(returnTripId) || returnTripId <= 0) {
      setSubmitError('Không xác định được chuyến xe. Vui lòng tải lại trang.');
      return;
    }

    const resolvedOutboundSeats = outboundSeats.map((seatNumber) =>
      outboundSeatMap.find(
        (seat) => seat.seatNumber === seatNumber && seat.status === 'TRONG',
      ),
    );
    const outboundSeatIds = resolvedOutboundSeats
      .map((seat) => seat?.tripSeatId)
      .filter((id): id is number => typeof id === 'number' && Number.isSafeInteger(id) && id > 0);

    const resolvedReturnSeats = returnSeats.map((seatNumber) =>
      returnSeatMap.find(
        (seat) => seat.seatNumber === seatNumber && seat.status === 'TRONG',
      ),
    );
    const returnSeatIds = resolvedReturnSeats
      .map((seat) => seat?.tripSeatId)
      .filter((id): id is number => typeof id === 'number' && Number.isSafeInteger(id) && id > 0);

    if (
      resolvedOutboundSeats.some((seat) => !seat) ||
      outboundSeatIds.length !== outboundSeats.length
    ) {
      setSubmitError('Sơ đồ ghế chuyến đi đã thay đổi. Hãy chọn lại ghế còn trống.');
      await refreshSeatMaps();
      return;
    }

    if (
      resolvedReturnSeats.some((seat) => !seat) ||
      returnSeatIds.length !== returnSeats.length
    ) {
      setSubmitError('Sơ đồ ghế chuyến về đã thay đổi. Hãy chọn lại ghế còn trống.');
      await refreshSeatMaps();
      return;
    }


    const overweightRegularCargoItem = findOverweightRegularCargoItem(allLuggageItems);
    if (overweightRegularCargoItem) {
      const effectiveUnitWeight = getEffectiveCargoUnitWeightKg(
        overweightRegularCargoItem,
      );
      setSubmitError(
        `Kiện "${overweightRegularCargoItem.type}" có khối lượng hiệu dụng ${effectiveUnitWeight}kg; mỗi kiện tối đa ${MAX_REGULAR_CARGO_PACKAGE_WEIGHT_KG}kg khi đi kèm vé.`,
      );
      return;
    }

    const mapCargo = (items: ILuggageItem[]) => {
      const valid = items.filter(isValidCargoItem);
      if (valid.length === 0) return undefined;
      return valid.map((item) => ({
        name:
          item.type === 'Xe máy'
            ? `Xe máy (${item.motorbikeType || 'Xe số'})`
            : item.type === 'Xe đạp'
              ? `Xe đạp (${item.bicycleType || 'Xe đạp thường'})`
              : item.type || 'Hành lý gửi kèm',
        type: item.type,
        quantity: item.quantity || 1,
        weight:
          item.type === 'Xe máy'
            ? 100
            : item.type === 'Xe đạp'
              ? 15
              : item.weight || 0,
        length: item.length,
        width: item.width,
        height: item.height,
        loaiHangHoaId: item.loaiHangHoaId,
        category: item.category,
        note: item.note,
        motorbikeModel: item.motorbikeType,
        bicycleType: item.bicycleType,
        licensePlate: item.licensePlate,
      }));
    };

    const outboundCargo = mapCargo(outboundLuggageItems);
    const returnCargo = mapCargo(returnLuggageItems);

    let outSenderPointId: number | undefined;
    let outReceiverPointId: number | undefined;
    if (outboundCargo && outboundCargoRoutePoints) {
      if (outboundCargoRoutePoints.senderPoints.length) {
        outSenderPointId = outboundCargoRoutePoints.senderPoints[0].id;
      }
      if (outboundCargoRoutePoints.receiverPoints.length) {
        const candidate =
          outboundCargoRoutePoints.receiverPoints.find((p) => p.id !== outSenderPointId) ??
          outboundCargoRoutePoints.receiverPoints[outboundCargoRoutePoints.receiverPoints.length - 1];
        outReceiverPointId = candidate?.id;
      }
    }

    let retSenderPointId: number | undefined;
    let retReceiverPointId: number | undefined;
    if (returnCargo && returnCargoRoutePoints) {
      if (returnCargoRoutePoints.senderPoints.length) {
        retSenderPointId = returnCargoRoutePoints.senderPoints[0].id;
      }
      if (returnCargoRoutePoints.receiverPoints.length) {
        const candidate =
          returnCargoRoutePoints.receiverPoints.find((p) => p.id !== retSenderPointId) ??
          returnCargoRoutePoints.receiverPoints[returnCargoRoutePoints.receiverPoints.length - 1];
        retReceiverPointId = candidate?.id;
      }
    }

    submissionLockRef.current = true;
    setIsSubmitting(true);

    let outboundHoldToken: string | null = null;
    let returnHoldToken: string | null = null;

    try {
      const outHoldRes = isAuthenticated
        ? await executeWithAuth((token) =>
            bookingsApi.createSeatHold({ tripId: outboundTripId, seatIds: outboundSeatIds }, token),
          )
        : await bookingsApi.createSeatHold({ tripId: outboundTripId, seatIds: outboundSeatIds });
      outboundHoldToken = outHoldRes.data.holdToken;

      try {
        const retHoldRes = isAuthenticated
          ? await executeWithAuth((token) =>
              bookingsApi.createSeatHold({ tripId: returnTripId, seatIds: returnSeatIds }, token),
            )
          : await bookingsApi.createSeatHold({ tripId: returnTripId, seatIds: returnSeatIds });
        returnHoldToken = retHoldRes.data.holdToken;
      } catch (retError) {
        if (outboundHoldToken) {
          await releaseSeatHoldSafely(outboundHoldToken);
          outboundHoldToken = null;
        }
        throw retError;
      }

      activeHoldsRef.current = {
        outbound: outboundHoldToken,
        return: returnHoldToken,
        bookingStarted: false,
      };

      activeHoldsRef.current.bookingStarted = true;

      const outboundPayload: CreateBookingPayload = {
        tripId: outboundTripId,
        seatIds: outboundSeatIds,
        contact: {
          fullName: customerName.trim(),
          phone: customerPhone.trim(),
          ...(customerEmail.trim() ? { email: customerEmail.trim() } : {}),
        },
        pickupPoint: selectedOutboundPickupStop?.name || outboundPickupOverride || outboundPost.province,
        dropoffPoint: selectedOutboundDropoffStop?.name || outboundDropoffOverride || outboundPost.district,
        diemDonChuyenXeId: selectedOutboundPickupPointId ?? undefined,
        diemTraChuyenXeId: selectedOutboundDropoffPointId ?? undefined,
        holdToken: outboundHoldToken,
        cargoItems: outboundCargo,
        ...(outboundCargo && outSenderPointId && outReceiverPointId
          ? { senderPointId: outSenderPointId, receiverPointId: outReceiverPointId }
          : {}),
      };

      let outboundBookingRes;
      try {
        outboundBookingRes = isAuthenticated
          ? await executeWithAuth((token) =>
              bookingsApi.createBooking(outboundPayload, token),
            )
          : await bookingsApi.createBooking(outboundPayload);
      } catch (outErr) {
        if (outboundHoldToken) await releaseSeatHoldSafely(outboundHoldToken);
        if (returnHoldToken) await releaseSeatHoldSafely(returnHoldToken);
        activeHoldsRef.current = null;
        throw outErr;
      }

      const returnPayload: CreateBookingPayload = {
        tripId: returnTripId,
        seatIds: returnSeatIds,
        contact: {
          fullName: customerName.trim(),
          phone: customerPhone.trim(),
          ...(customerEmail.trim() ? { email: customerEmail.trim() } : {}),
        },
        pickupPoint: selectedReturnPickupStop?.name || returnPickupOverride || returnLocations.pickup,
        dropoffPoint: selectedReturnDropoffStop?.name || returnDropoffOverride || returnLocations.dropoff,
        diemDonChuyenXeId: selectedReturnPickupPointId ?? undefined,
        diemTraChuyenXeId: selectedReturnDropoffPointId ?? undefined,
        holdToken: returnHoldToken,
        cargoItems: returnCargo,
        ...(returnCargo && retSenderPointId && retReceiverPointId
          ? { senderPointId: retSenderPointId, receiverPointId: retReceiverPointId }
          : {}),
      };

      let returnBookingRes;
      try {
        returnBookingRes = isAuthenticated
          ? await executeWithAuth((token) =>
              bookingsApi.createBooking(returnPayload, token),
            )
          : await bookingsApi.createBooking(returnPayload);
      } catch (retErr) {
        if (returnHoldToken) await releaseSeatHoldSafely(returnHoldToken);
        activeHoldsRef.current = null;
        throw retErr;
      }

      activeHoldsRef.current = null;
      if (!mountedRef.current) return;

      const b1 = outboundBookingRes.data as CreatedBookingData;
      const b2 = returnBookingRes.data as CreatedBookingData;

      const totalOrderAmount = Number(b1.totalAmount) + Number(b2.totalAmount);

      const draft = createPaymentDraft({
        tripType: 'round-trip',
        passenger: {
          fullName: customerName.trim(),
          phoneNumber: customerPhone.trim(),
          email: customerEmail.trim(),
        },
        legs: [
          {
            tripId: outboundTripId,
            route: outboundRoute,
            departureTime: outboundDepartureTimeText,
            seats: outboundSeats,
            pickup: outboundPost.province,
            dropoff: outboundPost.district,
            unitFare: outboundUnitFare,
            subtotal: Number(b1.totalAmount),
            busCompanyName: outboundPost.authorName || 'VexGo Transport',
            vehicleType: outboundPost.propertyType || 'Xe khách chất lượng cao',
            bookingId: b1.bookingId,
            bookingCode: b1.bookingCode,
            orderId: b1.orderId,
            orderCode: b1.orderCode,
            status: b1.status,
          },
          {
            tripId: returnTripId,
            route: returnRoute,
            departureTime: returnDepartureTimeText,
            seats: returnSeats,
            pickup: returnLocations.pickup,
            dropoff: returnLocations.dropoff,
            unitFare: returnUnitFare,
            subtotal: Number(b2.totalAmount),
            busCompanyName: returnPost.authorName || 'VexGo Transport',
            vehicleType: returnPost.propertyType || 'Xe khách chất lượng cao',
            bookingId: b2.bookingId,
            bookingCode: b2.bookingCode,
            orderId: b2.orderId,
            orderCode: b2.orderCode,
            status: b2.status,
          },
        ],
        luggage:
          luggageWeight > 0 || luggageFee > 0 || allLuggageItems.length > 0
            ? {
                fee: luggageFee,
                weight: luggageWeight,
                items: allLuggageItems,
                info: {
                  count: allLuggageItems.length,
                  weight: luggageWeight,
                  fee: luggageFee,
                  category: allLuggageItems[0]?.category || 'normal',
                },
              }
            : undefined,
        totalFare: totalOrderAmount,
        bookingId: b1.bookingId,
        bookingCode: b1.bookingCode,
        orderId: b1.orderId,
        orderCode: b1.orderCode,
        status: b1.status,
      });

      if (totalOrderAmount === 0 && b1.status === 'DA_THANH_TOAN' && b2.status === 'DA_THANH_TOAN') {
        router.push(`/invoice/${b1.bookingId}?returnBookingId=${b2.bookingId}`);
      } else {
        router.push(`/payment?draftId=${encodeURIComponent(draft.id)}`);
      }
    } catch (error) {
      if (mountedRef.current) {
        submissionLockRef.current = false;
        setIsSubmitting(false);
        if (error instanceof ApiError && error.status === 409) {
          setSubmitError(
            error.message || 'Ghế vừa được người khác giữ. Sơ đồ ghế đang được cập nhật.',
          );
          void refreshSeatMaps();
          return;
        }
        setSubmitError(
          error instanceof Error ? error.message : 'Không thể tạo đơn đặt vé khứ hồi. Vui lòng thử lại.',
        );
      }
    }
  };

  const outboundUnitFare = (outboundPost.minPriceNum ?? 0) + outboundTotalSurcharge;
  const returnUnitFare = (returnPost.minPriceNum ?? 0) + returnTotalSurcharge;
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
                tripSeats={outboundSeatMap}
                selectedSeats={outboundSeats}
                onToggle={toggleOutboundSeat}
                onVehicleInfoClick={() => setShowVehicleInfoModal(true)}
              />
              <SeatGrid
                title="Chuyến về"
                date={returnLabel}
                vehicleType={returnPost.propertyType}
                tripSeats={returnSeatMap}
                selectedSeats={returnSeats}
                onToggle={toggleReturnSeat}
                onVehicleInfoClick={() => setShowVehicleInfoModal(true)}
              />
            </div>

            {/* Chú giải */}
            <div className="p-3 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-center gap-6 sm:gap-8 text-[11px] font-bold text-slate-600">
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
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-600 text-[10px] font-bold">
                Tối đa 5 ghế/chuyến
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
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-black text-slate-700 uppercase">
                        Điểm đón
                      </h3>
                      {outboundPickupSurcharge > 0 && (
                        <span className="text-xs font-bold text-accent">
                          +{outboundPickupSurcharge.toLocaleString('vi-VN')}đ / vé
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs font-bold text-slate-600 mb-2">
                      <label className={`inline-flex items-center gap-1.5 cursor-pointer ${outboundPickupMode === 'station' ? 'text-accent' : ''}`}>
                        <input
                          type="radio"
                          name="pickupOut"
                          checked={outboundPickupMode === 'station'}
                          onChange={() => handleOutboundPickupModeChange('station')}
                          className="accent-accent"
                        />{' '}
                        Bến xe/VP {outboundPickupStations.length > 0 ? `(${outboundPickupStations.length})` : ''}
                      </label>
                      <label className={`inline-flex items-center gap-1.5 cursor-pointer ${outboundPickupMode === 'transfer' ? 'text-accent' : ''} ${outboundPickupTransfers.length === 0 ? 'opacity-40 cursor-not-allowed' : ''}`}>
                        <input
                          type="radio"
                          name="pickupOut"
                          checked={outboundPickupMode === 'transfer'}
                          disabled={outboundPickupTransfers.length === 0}
                          onChange={() => handleOutboundPickupModeChange('transfer')}
                          className="accent-accent"
                        />{' '}
                        Trung chuyển {outboundPickupTransfers.length > 0 ? `(${outboundPickupTransfers.length})` : ''}
                      </label>
                    </div>
                    <select
                      value={selectedOutboundPickupPointId ?? (outboundPickupOverride || outboundPost.province)}
                      onChange={handleOutboundPickupSelect}
                      className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm font-semibold outline-none focus:border-brand bg-white"
                    >
                      {(outboundPickupMode === 'transfer' ? outboundPickupTransfers : outboundPickupStations).length > 0 ? (
                        (outboundPickupMode === 'transfer' ? outboundPickupTransfers : outboundPickupStations).map((p) => (
                          <option key={p.diemDonTraChuyenXeId ?? p.id} value={p.diemDonTraChuyenXeId ?? p.name}>
                            {p.time ? `${p.time} - ` : ''}{p.name}{p.phuPhi && p.phuPhi > 0 ? ` (+${p.phuPhi.toLocaleString('vi-VN')}đ)` : ''}
                          </option>
                        ))
                      ) : (
                        <option value={outboundPost.province}>{outboundPost.province}</option>
                      )}
                    </select>
                    {selectedOutboundPickupStop?.address && (
                      <p className="text-[11px] text-slate-500 mt-1.5">
                        {selectedOutboundPickupStop.address}
                      </p>
                    )}
                    <p className="text-[11px] font-semibold text-slate-600 mt-2">
                      Quý khách vui lòng có mặt tại điểm đón{' '}
                      <strong className="text-accent">
                        trước {selectedOutboundPickupStop?.phutCoMatTruoc ?? 20} phút ({outboundDepartureTimeText})
                      </strong>{' '}
                      để kiểm tra thông tin trước khi lên xe.
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-black text-slate-700 uppercase">
                        Điểm trả
                      </h3>
                      {outboundDropoffSurcharge > 0 && (
                        <span className="text-xs font-bold text-accent">
                          +{outboundDropoffSurcharge.toLocaleString('vi-VN')}đ / vé
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs font-bold text-slate-600 mb-2">
                      <label className={`inline-flex items-center gap-1.5 cursor-pointer ${outboundDropoffMode === 'station' ? 'text-accent' : ''}`}>
                        <input
                          type="radio"
                          name="dropoffOut"
                          checked={outboundDropoffMode === 'station'}
                          onChange={() => handleOutboundDropoffModeChange('station')}
                          className="accent-accent"
                        />{' '}
                        Bến xe/VP {outboundDropoffStations.length > 0 ? `(${outboundDropoffStations.length})` : ''}
                      </label>
                      <label className={`inline-flex items-center gap-1.5 cursor-pointer ${outboundDropoffMode === 'transfer' ? 'text-accent' : ''} ${outboundDropoffTransfers.length === 0 ? 'opacity-40 cursor-not-allowed' : ''}`}>
                        <input
                          type="radio"
                          name="dropoffOut"
                          checked={outboundDropoffMode === 'transfer'}
                          disabled={outboundDropoffTransfers.length === 0}
                          onChange={() => handleOutboundDropoffModeChange('transfer')}
                          className="accent-accent"
                        />{' '}
                        Trung chuyển {outboundDropoffTransfers.length > 0 ? `(${outboundDropoffTransfers.length})` : ''}
                      </label>
                    </div>
                    <select
                      value={selectedOutboundDropoffPointId ?? (outboundDropoffOverride || outboundPost.district)}
                      onChange={handleOutboundDropoffSelect}
                      className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm font-semibold outline-none focus:border-brand bg-white"
                    >
                      {(outboundDropoffMode === 'transfer' ? outboundDropoffTransfers : outboundDropoffStations).length > 0 ? (
                        (outboundDropoffMode === 'transfer' ? outboundDropoffTransfers : outboundDropoffStations).map((p) => (
                          <option key={p.diemDonTraChuyenXeId ?? p.id} value={p.diemDonTraChuyenXeId ?? p.name}>
                            {p.time ? `${p.time} - ` : ''}{p.name}{p.phuPhi && p.phuPhi > 0 ? ` (+${p.phuPhi.toLocaleString('vi-VN')}đ)` : ''}
                          </option>
                        ))
                      ) : (
                        <option value={outboundPost.district}>{outboundPost.district}</option>
                      )}
                    </select>
                    {selectedOutboundDropoffStop?.address && (
                      <p className="text-[11px] text-slate-500 mt-1.5">
                        {selectedOutboundDropoffStop.address}
                      </p>
                    )}
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
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-black text-slate-700 uppercase">
                        Điểm đón
                      </h3>
                      {returnPickupSurcharge > 0 && (
                        <span className="text-xs font-bold text-accent">
                          +{returnPickupSurcharge.toLocaleString('vi-VN')}đ / vé
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs font-bold text-slate-600 mb-2">
                      <label className={`inline-flex items-center gap-1.5 cursor-pointer ${returnPickupMode === 'station' ? 'text-accent' : ''}`}>
                        <input
                          type="radio"
                          name="pickupIn"
                          checked={returnPickupMode === 'station'}
                          onChange={() => handleReturnPickupModeChange('station')}
                          className="accent-accent"
                        />{' '}
                        Bến xe/VP {returnPickupStations.length > 0 ? `(${returnPickupStations.length})` : ''}
                      </label>
                      <label className={`inline-flex items-center gap-1.5 cursor-pointer ${returnPickupMode === 'transfer' ? 'text-accent' : ''} ${returnPickupTransfers.length === 0 ? 'opacity-40 cursor-not-allowed' : ''}`}>
                        <input
                          type="radio"
                          name="pickupIn"
                          checked={returnPickupMode === 'transfer'}
                          disabled={returnPickupTransfers.length === 0}
                          onChange={() => handleReturnPickupModeChange('transfer')}
                          className="accent-accent"
                        />{' '}
                        Trung chuyển {returnPickupTransfers.length > 0 ? `(${returnPickupTransfers.length})` : ''}
                      </label>
                    </div>
                    <select
                      value={selectedReturnPickupPointId ?? (returnPickupOverride || returnLocations.pickup)}
                      onChange={handleReturnPickupSelect}
                      className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm font-semibold outline-none focus:border-brand bg-white"
                    >
                      {(returnPickupMode === 'transfer' ? returnPickupTransfers : returnPickupStations).length > 0 ? (
                        (returnPickupMode === 'transfer' ? returnPickupTransfers : returnPickupStations).map((p) => (
                          <option key={p.diemDonTraChuyenXeId ?? p.id} value={p.diemDonTraChuyenXeId ?? p.name}>
                            {p.time ? `${p.time} - ` : ''}{p.name}{p.phuPhi && p.phuPhi > 0 ? ` (+${p.phuPhi.toLocaleString('vi-VN')}đ)` : ''}
                          </option>
                        ))
                      ) : (
                        <option value={returnLocations.pickup}>{returnLocations.pickup}</option>
                      )}
                    </select>
                    {selectedReturnPickupStop?.address && (
                      <p className="text-[11px] text-slate-500 mt-1.5">
                        {selectedReturnPickupStop.address}
                      </p>
                    )}
                    <p className="text-[11px] font-semibold text-slate-600 mt-2">
                      Quý khách vui lòng có mặt tại điểm đón{' '}
                      <strong className="text-accent">
                        trước {selectedReturnPickupStop?.phutCoMatTruoc ?? 20} phút ({returnDepartureTimeText})
                      </strong>{' '}
                      để kiểm tra thông tin trước khi lên xe.
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-black text-slate-700 uppercase">
                        Điểm trả
                      </h3>
                      {returnDropoffSurcharge > 0 && (
                        <span className="text-xs font-bold text-accent">
                          +{returnDropoffSurcharge.toLocaleString('vi-VN')}đ / vé
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs font-bold text-slate-600 mb-2">
                      <label className={`inline-flex items-center gap-1.5 cursor-pointer ${returnDropoffMode === 'station' ? 'text-accent' : ''}`}>
                        <input
                          type="radio"
                          name="dropoffIn"
                          checked={returnDropoffMode === 'station'}
                          onChange={() => handleReturnDropoffModeChange('station')}
                          className="accent-accent"
                        />{' '}
                        Bến xe/VP {returnDropoffStations.length > 0 ? `(${returnDropoffStations.length})` : ''}
                      </label>
                      <label className={`inline-flex items-center gap-1.5 cursor-pointer ${returnDropoffMode === 'transfer' ? 'text-accent' : ''} ${returnDropoffTransfers.length === 0 ? 'opacity-40 cursor-not-allowed' : ''}`}>
                        <input
                          type="radio"
                          name="dropoffIn"
                          checked={returnDropoffMode === 'transfer'}
                          disabled={returnDropoffTransfers.length === 0}
                          onChange={() => handleReturnDropoffModeChange('transfer')}
                          className="accent-accent"
                        />{' '}
                        Trung chuyển {returnDropoffTransfers.length > 0 ? `(${returnDropoffTransfers.length})` : ''}
                      </label>
                    </div>
                    <select
                      value={selectedReturnDropoffPointId ?? (returnDropoffOverride || returnLocations.dropoff)}
                      onChange={handleReturnDropoffSelect}
                      className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm font-semibold outline-none focus:border-brand bg-white"
                    >
                      {(returnDropoffMode === 'transfer' ? returnDropoffTransfers : returnDropoffStations).length > 0 ? (
                        (returnDropoffMode === 'transfer' ? returnDropoffTransfers : returnDropoffStations).map((p) => (
                          <option key={p.diemDonTraChuyenXeId ?? p.id} value={p.diemDonTraChuyenXeId ?? p.name}>
                            {p.time ? `${p.time} - ` : ''}{p.name}{p.phuPhi && p.phuPhi > 0 ? ` (+${p.phuPhi.toLocaleString('vi-VN')}đ)` : ''}
                          </option>
                        ))
                      ) : (
                        <option value={returnLocations.dropoff}>{returnLocations.dropoff}</option>
                      )}
                    </select>
                    {selectedReturnDropoffStop?.address && (
                      <p className="text-[11px] text-slate-500 mt-1.5">
                        {selectedReturnDropoffStop.address}
                      </p>
                    )}
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
                  title="HÀNH LÝ CỦA CHUYẾN ĐI"
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
                      <span>✓ Đã sao chép danh sách hàng gửi hầm xe từ chuyến đi</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1.5 font-medium">
                      Bỏ tích &quot;Áp dụng giống chuyến đi&quot; ở trên nếu bạn muốn chỉnh sửa hoặc không gửi hàng ở chuyến về.
                    </p>
                  </div>
                ) : (
                  <LuggageStep
                    title="HÀNH LÝ CỦA CHUYẾN VỀ"
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
                    {totalFareLabel}
                  </span>
                </div>
                <span className="text-2xl font-black text-red-600">
                  {totalFare.toLocaleString('vi-VN')}đ
                </span>
              </div>
              <div className="flex flex-col gap-3 sm:items-end">
                {submitError && (
                  <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                    {submitError}
                  </div>
                )}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => router.back()}
                    disabled={isSubmitting}
                    className="min-h-11 px-6 rounded-lg border border-slate-300 bg-white text-slate-600 font-bold text-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-60"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="min-h-11 px-6 rounded-lg bg-accent text-white font-bold text-sm hover:bg-accent-hover shadow-sm disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand transition-colors"
                  >
                    {isSubmitting ? 'Đang xử lý…' : 'Thanh toán'}
                  </button>
                </div>
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
                            &quot;{item.note}&quot;
                          </p>
                        )}
                      </div>

                      {(() => {
                        const itemFee = calculateLuggageFee([item]);
                        return itemFee > 0 ? (
                          <span className="shrink-0 text-right text-xs font-bold text-red-600">
                            {itemFee.toLocaleString('vi-VN')}đ
                          </span>
                        ) : (
                          <span className="shrink-0 text-right text-xs font-semibold text-slate-500">
                            Theo bảng cước tuyến
                          </span>
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
                <LuggageSummary
                  fee={luggageFee}
                  totalWeight={luggageWeight}
                  hasCargo={hasCargoItems}
                />
                <div className="flex justify-between">
                  <span>Phí thanh toán</span>
                  <span>0đ</span>
                </div>
                <div className="flex justify-between pt-3 border-t border-slate-200">
                  <span className="text-sm font-bold text-slate-900">
                    {totalFareLabel}
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
                          &quot;{item.note}&quot;
                        </p>
                      )}
                    </div>

                    {(() => {
                      const itemFee = calculateLuggageFee([item]);
                      return itemFee > 0 ? (
                        <span className="font-extrabold text-red-600">
                          +{itemFee.toLocaleString('vi-VN')}đ
                        </span>
                      ) : (
                        <span className="font-bold text-emerald-600">
                          Theo bảng cước
                        </span>
                      );
                    })()}
                  </div>
                );
              })}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between text-xs">
              <span className="font-bold text-slate-600">Cước hàng</span>
              <strong className="text-red-600 text-sm">
                {luggageFee > 0 ? `${luggageFee.toLocaleString('vi-VN')}đ` : 'Miễn phí'}
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

      {/* Customer Info Alert Modal */}
      {showCustomerInfoAlert && (
        <div
          role="alertdialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">
              Thông tin khách hàng chưa đầy đủ
            </h3>
            <p className="mt-3 whitespace-pre-line text-sm text-slate-600">
              {customerInfoAlertMessage}
            </p>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setShowCustomerInfoAlert(false)}
                className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 cursor-pointer"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
