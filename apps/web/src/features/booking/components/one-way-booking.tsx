/* eslint-disable */
'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Armchair,
  Bus,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Info,
  Mail,
  MapPin,
  Package,
  PackageCheck,
  Phone,
  Tag,
  Ticket,
  User,
  X,
} from 'lucide-react';
import type { Post } from '@/features/posts/types/post';
import { AlertModal } from '@/components/ui/alert-modal';
import { LuggageStep, calculateLuggageFee } from './luggage/luggage-step';
import { LuggageSummary } from './luggage/luggage-summary';
import type { ILuggageItem } from './luggage/luggage-item';
import {
  canPayForOneWayBooking,
  formatTripDateTime,
} from '../utils/one-way-booking';
import { validatePassengerInfo } from '../utils/passenger-validation';
import { hydrateUntouchedProfileField } from '../utils/profile-hydration';
import {
  findOverweightRegularCargoItem,
  getEffectiveCargoUnitWeightKg,
  MAX_REGULAR_CARGO_PACKAGE_WEIGHT_KG,
} from '../utils/cargo-weight';
import { createPaymentDraft } from '../services/payment-draft';
import { FeaturePlaceholderModal } from './feature-placeholder-modal';
import { useAuthSession } from '@/features/auth/auth-session';
import { customerApi } from '@/features/account/services/customer.api';
import {
  ApiError,
  bookingsApi,
  type BookingQuoteData,
  type CreatedBookingData,
  type CreateBookingPayload,
} from '@/features/account/services/bookings.api';
import { tripsApi, type ApiTripSeat } from '@/features/trips/services/trips.api';
import {
  shipmentsApi,
  type ShipmentRoutePoints,
} from '@/features/shipments/services/shipments.api';
import {
  promotionsApi,
  type AvailablePromotion,
} from '@/features/promotions/services/promotions.api';


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

function isValidCargoItem(item: ILuggageItem): boolean {
  return (
    item.type === 'Xe máy' ||
    item.type === 'Xe đạp' ||
    (item.weight || 0) > 0 ||
    Boolean(item.length && item.width && item.height)
  );
}

export const OneWayBooking: React.FC<OneWayBookingProps> = ({
  post,
  tripSeats,
}) => {
  const router = useRouter();
  const { user, executeWithAuth, isAuthenticated, isHydrated } = useAuthSession();
  const isTicket = post.needType === 'BUY';
  const [userNameOverride, setUserNameOverride] = useState<string | null>(null);
  const [userPhoneOverride, setUserPhoneOverride] = useState<string | null>(null);
  const [verifiedAccountPhone, setVerifiedAccountPhone] = useState<string | null>(null);
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
        setVerifiedAccountPhone(
          res.data.phoneVerified && res.data.phoneNumber
            ? formatDisplayPhone(res.data.phoneNumber)
            : null,
        );
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
          setVerifiedAccountPhone(
            res.data.phoneVerified && res.data.phoneNumber
              ? formatDisplayPhone(res.data.phoneNumber)
              : null,
          );
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
  const [promotionInput, setPromotionInput] = useState('');
  const [activePromotionCode, setActivePromotionCode] = useState<string | null>(null);
  const [promotionRequestVersion, setPromotionRequestVersion] = useState(0);
  const [promotionQuoteState, setPromotionQuoteState] = useState<{
    requestKey: string;
    status: 'idle' | 'loading' | 'valid' | 'invalid';
    message: string;
    quote?: BookingQuoteData;
  }>({ requestKey: '', status: 'idle', message: '' });
  const promotionInputRef = useRef<HTMLInputElement | null>(null);
  const [seatMap, setSeatMap] = useState(tripSeats);
  const activeTripIdRef = useRef(Number(post.id));
  const latestTripIdRef = useRef(Number(post.id));
  latestTripIdRef.current = Number(post.id);
  const mountedRef = useRef(true);
  const submissionLockRef = useRef(false);
  const submissionUnknownRef = useRef(false);
  const activeHoldRef = useRef<{
    holdToken: string;
    tripId: number;
    bookingRequestStarted: boolean;
  } | null>(null);
  const [submissionUnknown, setSubmissionUnknown] = useState(false);
  const [holdExpiresAt, setHoldExpiresAt] = useState<string | null>(null);
  const [requiresLogin, setRequiresLogin] = useState(false);
  const [showTripInfoModal, setShowTripInfoModal] = useState(false);
  const [showCargoInfoModal, setShowCargoInfoModal] = useState(false);
  const [showCustomerInfoAlert, setShowCustomerInfoAlert] = useState(false);
  const [customerInfoAlertMessage, setCustomerInfoAlertMessage] = useState('');
  const customerInfoSectionRef = useRef<HTMLDivElement>(null);
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
    seatMap.some((s) => s.position?.includes('Tầng'));

  const seatGroups = Object.entries(
    seatMap.reduce<Record<string, string[]>>((groups, seat) => {
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
    seatMap
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

  const releaseSeatHoldSafely = useCallback(async (holdToken: string) => {
    try {
      const response = await bookingsApi.releaseSeatHold(holdToken);
      return response.data?.success === true;
    } catch {
      // The backend TTL remains the fallback if release cannot be confirmed.
      return false;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const activeHold = activeHoldRef.current;
      if (activeHold && !activeHold.bookingRequestStarted) {
        activeHoldRef.current = null;
        void releaseSeatHoldSafely(activeHold.holdToken);
      }
    };
  }, [releaseSeatHoldSafely]);

  useEffect(() => {
    const nextTripId = Number(post.id);
    if (activeTripIdRef.current === nextTripId) return;

    activeTripIdRef.current = nextTripId;
    setSeatMap(tripSeats);
    setSelectedSeats([]);
    setSubmitError(null);
    setHoldExpiresAt(null);
    setRequiresLogin(false);

    const activeHold = activeHoldRef.current;
    if (activeHold && !activeHold.bookingRequestStarted) {
      activeHoldRef.current = null;
      void releaseSeatHoldSafely(activeHold.holdToken);
    }
  }, [post.id, releaseSeatHoldSafely, tripSeats]);

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

  const [availablePromotions, setAvailablePromotions] = useState<AvailablePromotion[]>([]);
  const [loadingPromotions, setLoadingPromotions] = useState(false);

  useEffect(() => {
    let active = true;
    const tripId = Number(post.id);
    if (!Number.isSafeInteger(tripId) || tripId <= 0) {
      setAvailablePromotions([]);
      return;
    }

    setLoadingPromotions(true);
    promotionsApi
      .getAvailablePromotions({ tripId })
      .then(({ data }) => {
        if (active) {
          setAvailablePromotions(data);
        }
      })
      .catch(() => {
        if (active) {
          setAvailablePromotions([]);
        }
      })
      .finally(() => {
        if (active) {
          setLoadingPromotions(false);
        }
      });

    return () => {
      active = false;
    };
  }, [post.id]);

  const [luggageFee, setLuggageFee] = useState(0);

  const [luggageWeight, setLuggageWeight] = useState(0);
  const [luggageItems, setLuggageItems] = useState<ILuggageItem[]>([]);
  const hasSelectedCargoItems = luggageItems.length > 0;
  const validCargoItems = luggageItems.filter(isValidCargoItem);
  const hasCargoItems = validCargoItems.length > 0;
  const overweightRegularCargoItem = findOverweightRegularCargoItem(luggageItems);
  const luggagePackageCount = luggageItems.reduce(
    (total, item) => total + (Number.isFinite(item.quantity) ? item.quantity : 0),
    0,
  );
  const [cargoRoutePoints, setCargoRoutePoints] =
    useState<ShipmentRoutePoints | null>(null);
  const [cargoRoutePointsLoading, setCargoRoutePointsLoading] = useState(false);
  const [cargoRoutePointsError, setCargoRoutePointsError] = useState<string | null>(null);
  const [senderPointId, setSenderPointId] = useState<number | null>(null);
  const [receiverPointId, setReceiverPointId] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    const tripId = Number(post.id);
    setCargoRoutePoints(null);
    setCargoRoutePointsError(null);
    setSenderPointId(null);
    setReceiverPointId(null);
    if (!hasCargoItems || !Number.isSafeInteger(tripId) || tripId <= 0) {
      setCargoRoutePointsLoading(false);
      return;
    }

    setCargoRoutePointsLoading(true);
    shipmentsApi
      .getRoutePoints(tripId)
      .then(({ data }) => {
        if (!active) return;
        setCargoRoutePoints(data);
        const senderId =
          data.senderPoints.length > 0 ? data.senderPoints[0].id : null;
        const receiverCandidate =
          data.receiverPoints.find((p) => p.id !== senderId) ??
          data.receiverPoints[data.receiverPoints.length - 1];
        const receiverId = receiverCandidate ? receiverCandidate.id : null;
        setSenderPointId(senderId);
        setReceiverPointId(receiverId);
      })
      .catch((error: unknown) => {
        if (active) {
          setCargoRoutePointsError(
            error instanceof Error
              ? error.message
              : 'Không thể tải điểm gửi và điểm nhận hàng.',
          );
        }
      })
      .finally(() => {
        if (active) setCargoRoutePointsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [hasCargoItems, post.id]);

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
  const quoteTripId = Number(post.id);
  const quoteSeatIds = selectedSeats
    .map((seatNumber) =>
      seatMap.find((seat) => seat.seatNumber === seatNumber && seat.status === 'TRONG')?.tripSeatId,
    )
    .filter(
      (seatId): seatId is number =>
        typeof seatId === 'number' && Number.isSafeInteger(seatId) && seatId > 0,
    );
  const promotionIdentityPhone = isAuthenticated ? '' : customerPhone.trim();
  const promotionRequestKey = JSON.stringify({
    tripId: quoteTripId,
    seatIds: quoteSeatIds,
    selectedSeats,
    promotionCode: activePromotionCode,
    identityPhone: promotionIdentityPhone,
    isAuthenticated,
    isHydrated,
    fare: baseFareNumber,
    version: promotionRequestVersion,
  });
  const currentPromotionState =
    promotionQuoteState.requestKey === promotionRequestKey
      ? promotionQuoteState
      : null;
  const promotionStatus = activePromotionCode
    ? currentPromotionState?.status ?? 'loading'
    : 'idle';
  const promotionMessage = currentPromotionState?.message ?? '';
  const promotionQuote =
    promotionStatus === 'valid' ? currentPromotionState?.quote ?? null : null;
  const hasCurrentPromotionQuote = Boolean(promotionQuote);
  const quotedTicketTotal = promotionQuote ? Number(promotionQuote.finalTotal) : null;
  const totalFare =
    quotedTicketTotal !== null && Number.isFinite(quotedTicketTotal)
      ? quotedTicketTotal + luggageFee
      : baseFareNumber * selectedSeats.length + luggageFee;
  const isPromotionQuotePending =
    Boolean(activePromotionCode) && promotionStatus === 'loading';
  const totalFareText = isPromotionQuotePending
    ? 'Đang xác minh…'
    : `${totalFare.toLocaleString('vi-VN')}đ`;
  const totalFareLabel = hasCurrentPromotionQuote
    ? 'Tổng thanh toán tạm tính'
    : hasSelectedCargoItems
      ? 'Tạm tính tiền vé'
      : 'Tổng tiền';
  const canPay = canPayForOneWayBooking(selectedSeats, isAcceptedTerms);
  const hasUnappliedPromotionInput = Boolean(
    promotionInput.trim() && !activePromotionCode,
  );
  const canPayWithPromotion =
    !hasUnappliedPromotionInput &&
    (!activePromotionCode || hasCurrentPromotionQuote);

  useEffect(() => {
    if (!activePromotionCode) {
      setPromotionQuoteState({
        requestKey: promotionRequestKey,
        status: 'idle',
        message: '',
      });
      return;
    }

    if (!isHydrated) {
      setPromotionQuoteState({
        requestKey: promotionRequestKey,
        status: 'idle',
        message: 'Đang xác minh trạng thái tài khoản trước khi kiểm tra mã.',
      });
      return;
    }

    if (selectedSeats.length === 0) {
      setPromotionQuoteState({
        requestKey: promotionRequestKey,
        status: 'idle',
        message: 'Chọn ít nhất một ghế để kiểm tra mã khuyến mãi.',
      });
      return;
    }

    if (!isAuthenticated && !customerPhone.trim()) {
      setPromotionQuoteState({
        requestKey: promotionRequestKey,
        status: 'idle',
        message: 'Nhập số điện thoại để kiểm tra điều kiện sử dụng mã.',
      });
      return;
    }

    if (
      !Number.isSafeInteger(quoteTripId) ||
      quoteTripId <= 0 ||
      quoteSeatIds.length !== selectedSeats.length
    ) {
      setPromotionQuoteState({
        requestKey: promotionRequestKey,
        status: 'invalid',
        message: 'Không thể xác minh chuyến hoặc ghế đã chọn. Hãy tải lại sơ đồ ghế.',
      });
      promotionInputRef.current?.focus();
      return;
    }

    const controller = new AbortController();
    let isCurrent = true;
    setPromotionQuoteState({
      requestKey: promotionRequestKey,
      status: 'loading',
      message: 'Đang kiểm tra mã khuyến mãi…',
    });

    const timeout = setTimeout(async () => {
      try {
        const payload = {
          tripId: quoteTripId,
          seatIds: [...quoteSeatIds].sort((a, b) => a - b),
          promotionCode: activePromotionCode,
          ...(!isAuthenticated ? { contactPhone: customerPhone.trim() } : {}),
        };
        const response = isAuthenticated
          ? await executeWithAuth((token) =>
              bookingsApi.getBookingQuote(payload, token, controller.signal),
            )
          : await bookingsApi.getBookingQuote(payload, undefined, controller.signal);
        if (!isCurrent || controller.signal.aborted) return;

        const quote = response.data;
        const amounts = [quote.originalTotal, quote.discountAmount, quote.finalTotal].map(Number);
        if (
          !quote.appliedPromotionCode ||
          quote.appliedPromotionCode.toUpperCase() !== activePromotionCode ||
          amounts.some((amount) => !Number.isFinite(amount) || amount < 0)
        ) {
          throw new Error('Máy chủ chưa xác nhận được mã khuyến mãi. Hãy kiểm tra lại mã.');
        }

        setPromotionQuoteState({
          requestKey: promotionRequestKey,
          status: 'valid',
          message: `Mã ${quote.appliedPromotionCode} đã được áp dụng.`,
          quote,
        });
      } catch (error) {
        if (!isCurrent || controller.signal.aborted) return;
        setPromotionQuoteState({
          requestKey: promotionRequestKey,
          status: 'invalid',
          message:
            error instanceof Error
              ? error.message
              : 'Không thể kiểm tra mã khuyến mãi. Vui lòng thử lại.',
        });
        promotionInputRef.current?.focus();
      }
    }, 250);

    return () => {
      isCurrent = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [promotionRequestKey]);

  const handleApplyPromotion = (codeOverride?: unknown) => {
    const rawCode =
      typeof codeOverride === 'string' ? codeOverride : promotionInput;
    const code = rawCode.trim().toUpperCase();
    if (!code) {
      promotionInputRef.current?.focus();
      return;
    }
    if (typeof codeOverride === 'string') {
      setPromotionInput(codeOverride);
    }
    setSubmitError(null);
    setActivePromotionCode(code);
    setPromotionRequestVersion((version) => version + 1);
  };



  const handleRemovePromotion = () => {
    setPromotionInput('');
    setActivePromotionCode(null);
    setPromotionQuoteState({ requestKey: '', status: 'idle', message: '' });
    setSubmitError(null);
  };

  const toggleSeat = (seat: string) => {
    if (bookedSeats.has(seat) || isSubmitting || submissionUnknown) return;
    setSubmitError(null);
    setRequiresLogin(false);
    setSelectedSeats((prev) => {
      if (prev.includes(seat)) {
        return prev.filter((item) => item !== seat);
      }
      if (prev.length >= 5) {
        setSubmitError('Mỗi chuyến xe chỉ được chọn tối đa 5 ghế.');
        return prev;
      }
      return [...prev, seat];
    });
  };

  const refreshSeatMap = async (tripId: number) => {
    try {
      const refreshedSeats = await tripsApi.getTripSeats(tripId);
      if (mountedRef.current && latestTripIdRef.current === tripId) {
        setSeatMap(refreshedSeats);
        setSelectedSeats((current) =>
          current.filter((seatNumber) =>
            refreshedSeats.some(
              (seat) => seat.seatNumber === seatNumber && seat.status === 'TRONG',
            ),
          ),
        );
      }
    } catch {
      // The booking error remains visible if the seat-map refresh also fails.
    }
  };

  const showApiError = (error: unknown, tripId: number) => {
    if (!mountedRef.current) return;
    if (error instanceof ApiError && error.status === 409) {
      setSubmitError(
        error.message || 'Ghế vừa được người khác giữ. Sơ đồ ghế đang được cập nhật.',
      );
      void refreshSeatMap(tripId);
      return;
    }
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      setRequiresLogin(isAuthenticated);
      setSubmitError(
        isAuthenticated
          ? 'Phiên đăng nhập không còn hợp lệ. Hãy đăng nhập lại rồi thử đặt vé.'
          : error.message || 'Bạn chưa được phép thực hiện thao tác này.',
      );
      return;
    }
    setSubmitError(
      error instanceof Error
        ? error.message
        : 'Không thể tạo đơn đặt vé. Vui lòng thử lại.',
    );
  };

  const handleSubmit = async () => {
    if (submissionLockRef.current || submissionUnknownRef.current) return;

    setValidationAttempted(true);
    setSubmitError(null);
    setRequiresLogin(false);
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
    if (selectedSeats.length === 0) return;
    if (selectedSeats.length > 5) {
      setSubmitError('Mỗi chuyến xe chỉ được chọn tối đa 5 ghế.');
      return;
    }
    if (!isAcceptedTerms) return;
    if (promotionInput.trim() && !activePromotionCode) {
      setSubmitError('Hãy áp dụng hoặc bỏ mã khuyến mãi đã nhập trước khi tiếp tục.');
      promotionInputRef.current?.focus();
      return;
    }
    if (activePromotionCode && !hasCurrentPromotionQuote) {
      setSubmitError(
        promotionMessage || 'Đang kiểm tra mã khuyến mãi. Vui lòng đợi rồi thử lại.',
      );
      promotionInputRef.current?.focus();
      return;
    }

    const tripId = Number(post.id);
    if (!Number.isSafeInteger(tripId) || tripId <= 0) {
      setSubmitError('Không xác định được chuyến xe. Vui lòng tải lại trang.');
      return;
    }

    const resolvedSeats = selectedSeats.map((seatNumber) =>
      seatMap.find(
        (seat) => seat.seatNumber === seatNumber && seat.status === 'TRONG',
      ),
    );
    const seatIds = resolvedSeats.map((seat) => seat?.tripSeatId);
    const requestedSeatIds = seatIds.filter(
      (seatId): seatId is number =>
        typeof seatId === 'number' && Number.isSafeInteger(seatId) && seatId > 0,
    );
    if (
      resolvedSeats.some((seat) => !seat) ||
      requestedSeatIds.length !== seatIds.length
    ) {
      setSubmitError('Sơ đồ ghế đã thay đổi. Hãy chọn lại ghế còn trống.');
      await refreshSeatMap(tripId);
      return;
    }

    const oversizedItem = luggageItems.find(
      (item) =>
        item.type !== 'Xe máy' &&
        item.type !== 'Xe đạp' &&
        ((item.length && item.length > 150) ||
          (item.width && item.width > 80) ||
          (item.height && item.height > 80)),
    );
    if (oversizedItem) {
      setSubmitError(
        `Kiện "${oversizedItem.type}" vượt quá kích thước cho phép (Dài ≤ 150cm, Rộng ≤ 80cm, Cao ≤ 80cm).`,
      );
      return;
    }
    if (overweightRegularCargoItem) {
      const effectiveUnitWeight = getEffectiveCargoUnitWeightKg(
        overweightRegularCargoItem,
      );
      setSubmitError(
        `Kiện "${overweightRegularCargoItem.type}" có khối lượng hiệu dụng ${effectiveUnitWeight}kg; mỗi kiện tối đa ${MAX_REGULAR_CARGO_PACKAGE_WEIGHT_KG}kg khi đi kèm vé.`,
      );
      return;
    }

    let finalSenderPointId = senderPointId;
    let finalReceiverPointId = receiverPointId;
    if (validCargoItems.length > 0) {
      if (cargoRoutePointsLoading) {
        setSubmitError('Đang tải điểm gửi và điểm nhận hàng. Vui lòng thử lại.');
        return;
      }
      if (cargoRoutePointsError) {
        setSubmitError(cargoRoutePointsError);
        return;
      }
      if (!finalSenderPointId && cargoRoutePoints?.senderPoints.length) {
        finalSenderPointId = cargoRoutePoints.senderPoints[0].id;
      }
      if (!finalReceiverPointId && cargoRoutePoints?.receiverPoints.length) {
        const candidate = cargoRoutePoints.receiverPoints.find(
          (p) => p.id !== finalSenderPointId,
        ) ?? cargoRoutePoints.receiverPoints[cargoRoutePoints.receiverPoints.length - 1];
        finalReceiverPointId = candidate ? candidate.id : null;
      }
      if (!finalSenderPointId || !finalReceiverPointId) {
        setSubmitError('Tuyến xe chưa có điểm gửi/nhận hàng khả dụng.');
        return;
      }
      if (finalSenderPointId === finalReceiverPointId) {
        setSubmitError('Điểm gửi và điểm nhận hàng phải khác nhau.');
        return;
      }
    }
    const mappedCargoItems =
      validCargoItems.length > 0
        ? validCargoItems.map((item) => ({
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
          }))
        : undefined;

    const bookingDetails: Omit<CreateBookingPayload, 'holdToken'> = {
      tripId,
      seatIds: requestedSeatIds,
      contact: {
        fullName: customerName.trim(),
        phone: customerPhone.trim(),
        ...(customerEmail.trim() ? { email: customerEmail.trim() } : {}),
      },
      pickupPoint: pickup || post.province,
      dropoffPoint: dropoff || post.district,
      cargoItems: mappedCargoItems,
      ...(activePromotionCode ? { promotionCode: activePromotionCode } : {}),
      ...(mappedCargoItems
        ? { senderPointId: finalSenderPointId!, receiverPointId: finalReceiverPointId! }
        : {}),
    };

    submissionLockRef.current = true;
    setIsSubmitting(true);
    setHoldExpiresAt(null);

    let holdToken: string | null = null;
    try {
      const holdResponse = isAuthenticated
        ? await executeWithAuth((token) =>
            bookingsApi.createSeatHold({ tripId, seatIds: requestedSeatIds }, token),
          )
        : await bookingsApi.createSeatHold({ tripId, seatIds: requestedSeatIds });
      const hold = holdResponse.data;
      const expiresAtMs = Date.parse(hold?.expiresAt || '');
      const sortedRequestedSeatIds = [...requestedSeatIds].sort((a, b) => a - b);
      const sortedReturnedSeatIds = Array.isArray(hold?.seatIds)
        ? [...hold.seatIds].sort((a, b) => a - b)
        : [];
      const sameSeats =
        sortedReturnedSeatIds.length === sortedRequestedSeatIds.length &&
        sortedReturnedSeatIds.every(
          (id, index) => id === sortedRequestedSeatIds[index],
        );

      if (
        !hold ||
        typeof hold.holdToken !== 'string' ||
        hold.holdToken.trim().length === 0 ||
        hold.tripId !== tripId ||
        !sameSeats ||
        !Number.isFinite(expiresAtMs) ||
        expiresAtMs <= Date.now()
      ) {
        const released = hold?.holdToken
          ? await releaseSeatHoldSafely(hold.holdToken)
          : false;
        if (!released) {
          submissionUnknownRef.current = true;
          if (mountedRef.current) {
            setSubmissionUnknown(true);
            setSubmitError(
              'Chưa xác định được kết quả giữ ghế. Ghế có thể đang được giữ; vui lòng không gửi lại yêu cầu ngay.',
            );
          }
          return;
        }
        setSubmitError('Không thể xác nhận lượt giữ ghế từ máy chủ. Hãy chọn lại ghế.');
        await refreshSeatMap(tripId);
        return;
      }

      holdToken = hold.holdToken;
      activeHoldRef.current = {
        holdToken,
        tripId,
        bookingRequestStarted: false,
      };
      if (mountedRef.current) setHoldExpiresAt(hold.expiresAt);

      if (!mountedRef.current || latestTripIdRef.current !== tripId) {
        activeHoldRef.current = null;
        await releaseSeatHoldSafely(holdToken);
        return;
      }

      activeHoldRef.current.bookingRequestStarted = true;
      const bookingPayload: CreateBookingPayload = {
        ...bookingDetails,
        holdToken,
      };

      let bookingResponse;
      try {
        bookingResponse = isAuthenticated
          ? await executeWithAuth((token) =>
              bookingsApi.createBooking(bookingPayload, token),
            )
          : await bookingsApi.createBooking(bookingPayload);
      } catch (error) {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
          activeHoldRef.current = null;
          const released = await releaseSeatHoldSafely(holdToken);
          if (!released) {
            submissionUnknownRef.current = true;
            if (mountedRef.current) {
              setSubmissionUnknown(true);
              setSubmitError(
                'Đơn chưa được tạo, nhưng chưa xác nhận được việc giải phóng ghế. Vui lòng không gửi lại yêu cầu ngay.',
              );
            }
            return;
          }
          if (mountedRef.current) setHoldExpiresAt(null);
          if (
            mountedRef.current &&
            activePromotionCode &&
            error instanceof ApiError &&
            error.code?.startsWith('PROMOTION_')
          ) {
            setPromotionQuoteState({
              requestKey: promotionRequestKey,
              status: 'invalid',
              message: error.message,
            });
            setSubmitError(null);
            promotionInputRef.current?.focus();
          } else {
            showApiError(error, tripId);
          }
          return;
        }

        activeHoldRef.current = null;
        submissionUnknownRef.current = true;
        if (mountedRef.current) {
          setSubmissionUnknown(true);
          setSubmitError(
            'Chưa xác định được kết quả đặt vé. Vui lòng không gửi lại yêu cầu; kiểm tra lịch sử đặt vé hoặc liên hệ hỗ trợ.',
          );
        }
        return;
      }

      const booking = bookingResponse.data as CreatedBookingData | undefined;
      const totalAmount = Number(booking?.totalAmount);
      if (
        !booking ||
        !Number.isSafeInteger(booking.bookingId) ||
        booking.bookingId <= 0 ||
        booking.tripId !== tripId ||
        !Array.isArray(booking.seatIds) ||
        booking.seatIds.length !== requestedSeatIds.length ||
        ![...booking.seatIds].sort((a, b) => a - b).every(
          (id, index) => id === sortedRequestedSeatIds[index],
        ) ||
        !Number.isSafeInteger(booking.orderId) ||
        booking.orderId <= 0 ||
        !booking.bookingCode ||
        !booking.orderCode ||
        !Number.isFinite(totalAmount) ||
        totalAmount < 0
      ) {
        activeHoldRef.current = null;
        submissionUnknownRef.current = true;
        if (mountedRef.current) {
          setSubmissionUnknown(true);
          setSubmitError(
            'Chưa xác định được kết quả đặt vé. Máy chủ chưa trả đủ mã đơn để tiếp tục; vui lòng kiểm tra lịch sử đặt vé hoặc liên hệ hỗ trợ.',
          );
        }
        return;
      }

      activeHoldRef.current = null;
      if (!mountedRef.current) return;

      const serverShippingFee = Number(booking.shippingFee);
      const finalLuggageFee = Number.isFinite(serverShippingFee)
        ? serverShippingFee
        : 0;
      const draft = createPaymentDraft({
        tripType: 'one-way',
        passenger: {
          fullName: customerName.trim(),
          phoneNumber: customerPhone.trim(),
          email: customerEmail.trim(),
        },
        legs: [
          {
            tripId,
            route: post.title || `${post.province} - ${post.district}`,
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
                        count: luggagePackageCount,
                        weight: luggageWeight,
                        fee: finalLuggageFee,
                        category: luggageItems[0]?.category || 'normal',
                      }
                    : undefined,
              }
            : undefined,
        totalFare: totalAmount,
        bookingId: booking.bookingId,
        orderId: booking.orderId,
        bookingCode: booking.bookingCode,
        orderCode: booking.orderCode,
        status: booking.status,
      });

      setHoldExpiresAt(null);
      if (totalAmount === 0 && booking.status === 'DA_THANH_TOAN') {
        router.push(`/invoice/${booking.bookingId}`);
      } else {
        router.push(`/payment?draftId=${encodeURIComponent(draft.id)}`);
      }
    } catch (error) {
      if (holdToken && activeHoldRef.current?.holdToken === holdToken) {
        const activeHold = activeHoldRef.current;
        activeHoldRef.current = null;
        if (!activeHold.bookingRequestStarted) {
          await releaseSeatHoldSafely(holdToken);
        }
      }

      if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
        showApiError(error, tripId);
      } else {
        submissionUnknownRef.current = true;
        if (mountedRef.current) {
          setSubmissionUnknown(true);
          setSubmitError(
            holdToken
              ? 'Chưa xác định được kết quả đặt vé. Vui lòng không gửi lại yêu cầu; kiểm tra lịch sử đặt vé hoặc liên hệ hỗ trợ.'
              : 'Chưa xác định được kết quả giữ ghế. Ghế có thể đã được giữ trong tối đa 10 phút; vui lòng không gửi lại yêu cầu ngay.',
          );
        }
      }
    } finally {
      submissionLockRef.current = false;
      if (mountedRef.current) setIsSubmitting(false);
    }
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
    seatMap.forEach((seat) => {
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
      const all = seatMap.map((s) => s.seatNumber);
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
        disabled={isBooked || isSubmitting || submissionUnknown}
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
                      {seatMap.length} chỗ
                    </span>
                    <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                      Tối đa 5 ghế
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
              <div ref={customerInfoSectionRef} className="p-4 md:p-5 border-b lg:border-b-0 lg:border-r border-slate-200">
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

            <section
              className="p-4 md:p-5 border-b border-slate-200"
              aria-labelledby="booking-promotion-heading"
            >
              <h2
                id="booking-promotion-heading"
                className="text-base font-black text-slate-950 mb-3 flex items-center gap-2"
              >
                <Tag className="w-4 h-4 text-accent" />
                Mã khuyến mãi
              </h2>
              <div className="max-w-2xl">
                <label
                  htmlFor="booking-promotion-code"
                  className="block text-xs font-bold text-slate-700 mb-1.5"
                >
                  Nhập một mã cho đơn đặt vé
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    ref={promotionInputRef}
                    id="booking-promotion-code"
                    type="text"
                    autoComplete="off"
                    value={promotionInput}
                    onChange={(event) => {
                      const value = event.target.value.toUpperCase();
                      setPromotionInput(value);
                      if (activePromotionCode && value.trim() !== activePromotionCode) {
                        setActivePromotionCode(null);
                      }
                    }}
                    aria-invalid={promotionStatus === 'invalid'}
                    aria-describedby="booking-promotion-feedback"
                    className={`h-11 min-w-0 flex-1 rounded-lg border px-3 text-sm font-bold uppercase tracking-wide outline-none focus:ring-2 focus:ring-accent/20 ${
                      promotionStatus === 'invalid'
                        ? 'border-red-500 focus:border-red-500'
                        : promotionStatus === 'valid'
                          ? 'border-emerald-500 focus:border-emerald-500'
                          : 'border-slate-300 focus:border-accent'
                    }`}
                    placeholder="Ví dụ: VEXGO50"
                  />
                  <button
                    type="button"
                    onClick={handleApplyPromotion}
                    disabled={!promotionInput.trim() || promotionStatus === 'loading'}
                    className="min-h-11 rounded-lg bg-accent px-5 text-sm font-black text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {promotionStatus === 'loading'
                      ? 'Đang kiểm tra…'
                      : activePromotionCode
                        ? 'Kiểm tra lại'
                        : 'Áp dụng'}
                  </button>
                  {(promotionInput || activePromotionCode) && (
                    <button
                      type="button"
                      onClick={handleRemovePromotion}
                      className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50"
                    >
                      Bỏ mã
                    </button>
                  )}
                </div>
                {promotionMessage && (
                  <p
                    id="booking-promotion-feedback"
                    role={promotionStatus === 'invalid' ? 'alert' : 'status'}
                    aria-live="polite"
                    className={`mt-2 text-sm font-semibold flex items-center gap-1.5 ${
                      promotionStatus === 'invalid'
                        ? 'text-red-700'
                        : promotionStatus === 'valid'
                          ? 'text-emerald-700'
                          : 'text-slate-600'
                    }`}
                  >
                    {promotionStatus === 'valid' && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    )}
                    {promotionMessage}
                  </p>
                )}

                {availablePromotions.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-dashed border-slate-200">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <Ticket className="w-3.5 h-3.5 text-accent" />
                        Mã ưu đãi có sẵn ({availablePromotions.length}):
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {availablePromotions.map((promo) => {
                        const isCurrentActive = activePromotionCode === promo.code;
                        const discountText =
                          promo.discountType === 'PHAN_TRAM'
                            ? `Giảm ${Number(promo.discountValue)}%${
                                promo.maxDiscount
                                  ? ` (tối đa ${Number(promo.maxDiscount).toLocaleString('vi-VN')}đ)`
                                  : ''
                              }`
                            : `Giảm ${Number(promo.discountValue).toLocaleString('vi-VN')}đ`;

                        return (
                          <div
                            key={promo.id}
                            className={`relative flex flex-col justify-between p-3.5 rounded-lg border transition-all ${
                              isCurrentActive
                                ? 'border-accent bg-orange-50/60 shadow-sm ring-1 ring-accent/30'
                                : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-mono font-black text-xs text-accent bg-orange-100/80 px-2 py-0.5 rounded tracking-wider border border-orange-200">
                                  {promo.code}
                                </span>
                                <span className="text-[11px] font-semibold text-slate-400">
                                  HSD: {promo.endsOn}
                                </span>
                              </div>
                              <h4 className="mt-2 text-xs font-bold text-slate-900 line-clamp-1">
                                {promo.name}
                              </h4>
                              <p className="text-xs font-semibold text-accent mt-0.5">
                                {discountText}
                              </p>
                              {promo.minimumTicketAmount &&
                                Number(promo.minimumTicketAmount) > 0 && (
                                  <p className="text-[11px] text-slate-500 mt-0.5">
                                    Đơn tối thiểu:{' '}
                                    {Number(
                                      promo.minimumTicketAmount,
                                    ).toLocaleString('vi-VN')}
                                    đ
                                  </p>
                                )}
                            </div>
                            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                              <span className="text-[11px] text-slate-500">
                                Còn {promo.remainingUses} lượt
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  if (isCurrentActive) {
                                    handleRemovePromotion();
                                  } else {
                                    handleApplyPromotion(promo.code);
                                  }
                                }}
                                disabled={promotionStatus === 'loading'}
                                className={`px-3 py-1 text-xs font-black rounded transition-colors ${
                                  isCurrentActive
                                    ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                                    : 'bg-accent text-white hover:bg-accent-hover'
                                }`}
                              >
                                {isCurrentActive ? 'Bỏ chọn' : 'Áp dụng'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </section>


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
                  <div className="relative">
                    <select
                      value={pickup}
                      onChange={(e) => setPickupOverride(e.target.value)}
                      className="h-11 w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 pr-9 text-sm font-bold text-slate-900 outline-none focus:border-accent"
                    >
                      <option value={post.province}>{post.province}</option>
                      <option value={`Bến xe ${post.province}`}>
                        Bến xe {post.province}
                      </option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  </div>
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
                  <div className="relative">
                    <select
                      value={dropoff}
                      onChange={(e) => setDropoffOverride(e.target.value)}
                      className="h-11 w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 pr-9 text-sm font-bold text-slate-900 outline-none focus:border-accent"
                    >
                      <option value={post.district}>{post.district}</option>
                      <option value={`Bến xe ${post.district}`}>
                        Bến xe {post.district}
                      </option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  </div>
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

            {hasCargoItems && (
              <div className="hidden" aria-hidden="true">
                <select
                  aria-label="Điểm gửi hàng"
                  value={senderPointId ?? ''}
                  onChange={(event) => {
                    const nextId = Number(event.target.value) || null;
                    setSenderPointId(nextId);
                    if (nextId === receiverPointId) setReceiverPointId(null);
                  }}
                >
                  <option value="">Chọn điểm gửi</option>
                  {cargoRoutePoints?.senderPoints.map((point) => (
                    <option key={point.id} value={point.id}>
                      {point.name} — {point.address}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Điểm nhận hàng"
                  value={receiverPointId ?? ''}
                  onChange={(event) =>
                    setReceiverPointId(Number(event.target.value) || null)
                  }
                >
                  <option value="">Chọn điểm nhận</option>
                  {cargoRoutePoints?.receiverPoints.map((point) => (
                    <option
                      key={point.id}
                      value={point.id}
                      disabled={point.id === senderPointId}
                    >
                      {point.name} — {point.address}
                    </option>
                  ))}
                </select>
              </div>
            )}

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

            {(isSubmitting || submissionUnknown || holdExpiresAt) && (
              <div className="px-4 pt-4 md:px-5" aria-live="polite">
                {isSubmitting && (
                  <p role="status" className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800">
                    Đang giữ ghế và gửi yêu cầu đặt vé. Vui lòng không đóng trang.
                  </p>
                )}
                {holdExpiresAt && (
                  <p className="mt-2 text-sm text-slate-600">
                    Ghế đang được giữ đến {new Date(holdExpiresAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}.
                  </p>
                )}
                {submissionUnknown && (
                  <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
                    Kết quả chưa xác định
                  </p>
                )}
              </div>
            )}
            {submitError && (
              <div className="px-4 pt-4 md:px-5">
                <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">
                  {submitError}
                </p>
                {requiresLogin && (
                  <Link className="mt-2 inline-flex min-h-11 items-center text-sm font-bold text-accent underline underline-offset-2" href="/login">
                    Đăng nhập lại
                  </Link>
                )}
              </div>
            )}

            <div className="p-4 md:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex px-2 py-1 rounded-md bg-brand text-white text-[10px] font-black">
                    VEXGO
                  </span>
                  <span className="text-xs font-bold text-slate-500">
                    {totalFareLabel}
                  </span>
                </div>
                <p className="text-2xl font-black text-red-600">
                  {totalFareText}
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
                  disabled={!canPay || !canPayWithPromotion || !isHydrated || isSubmitting || submissionUnknown}
                  onClick={handleSubmit}
                  className="h-11 px-8 rounded-full bg-accent hover:bg-accent-hover text-white text-sm font-black transition-colors disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {submissionUnknown
                    ? 'Kết quả chưa xác định'
                    : isSubmitting
                      ? 'Đang xử lý...'
                      : 'Thanh toán'}
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
                      {luggagePackageCount} kiện • {Number(luggageWeight.toFixed(2))}kg
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
                  <strong className="text-slate-800">
                    {(baseFareNumber * selectedSeats.length).toLocaleString('vi-VN')}đ
                  </strong>
                </div>

                {promotionQuote && Number(promotionQuote.discountAmount) > 0 && (
                  <div className="flex justify-between gap-3 text-emerald-700">
                    <span className="font-semibold flex items-center gap-1">
                      Giảm giá ({promotionQuote.appliedPromotionCode})
                    </span>
                    <strong>
                      −{Number(promotionQuote.discountAmount).toLocaleString('vi-VN')}đ
                    </strong>
                  </div>
                )}


                <LuggageSummary
                  fee={luggageFee}
                  totalWeight={luggageWeight}
                  hasCargo={hasSelectedCargoItems}
                />
              </div>
              <div className="pt-4 flex justify-between gap-3 text-sm">
                <span className="text-slate-500 font-black">{totalFareLabel}</span>
                <strong className="text-red-600 text-base">
                  {totalFareText}
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
                  <span className="font-black text-slate-700">{totalFareLabel}</span>
                  <strong className="text-right text-red-600 text-sm">
                    {totalFareText}
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
                  Tổng cộng: {luggagePackageCount} kiện • {Number(luggageWeight.toFixed(2))}kg
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

                    {(() => {
                      const itemFee = calculateLuggageFee([item]);
                      return itemFee > 0 ? (
                        <div className="shrink-0 text-right text-xs font-bold text-red-600">
                          {itemFee.toLocaleString('vi-VN')}đ
                        </div>
                      ) : (
                        <div className="shrink-0 text-right text-xs font-semibold text-slate-500">
                          Theo bảng cước tuyến
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between text-xs">
              <span className="font-bold text-slate-600">Cước hàng</span>
              <strong className={luggageFee > 0 ? "text-red-600 text-sm font-bold" : "text-slate-600 text-xs"}>
                {luggageFee > 0 ? `${luggageFee.toLocaleString('vi-VN')}đ` : 'Máy chủ xác định theo bảng cước tuyến'}
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

      <AlertModal
        isOpen={showCustomerInfoAlert}
        title="Thông tin khách hàng chưa đầy đủ"
        message={customerInfoAlertMessage}
        variant="warning"
        confirmText="Bổ sung thông tin"
        onClose={() => {
          setShowCustomerInfoAlert(false);
          customerInfoSectionRef.current?.scrollIntoView?.({
            behavior: 'smooth',
            block: 'center',
          });
        }}
      />
    </div>
  );
};
