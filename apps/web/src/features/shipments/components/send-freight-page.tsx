/* eslint-disable react-hooks/preserve-manual-memoization, react-hooks/set-state-in-effect */
'use client';

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  Suspense,
} from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { formatCurrency } from '@/lib/format';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowRight,
  ArrowRightLeft,
  Building2,
  Check,
  CheckCircle,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  Filter,
  Info,
  MapPin,
  Package,
  PackageCheck,
  Phone,
  Plus,
  Receipt,
  RotateCcw,
  Search,
  ShieldCheck,
  Ticket,
  Trash2,
  User,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { LocationPicker } from '@/features/locations/components/location-picker';
import { QRCodeSVG } from 'qrcode.react';
import { ShipmentGuideModal } from './shipment-guide-modal';

import {
  shipmentsApi,
  type PublicShipmentLookupData,
  ApiError,
  type ShipmentOption,
  type ShipmentQuote,
  type ShipmentRoutePoints,
  type ShipmentResponseData,
} from '@/features/shipments/services/shipments.api';

import { useAuthSession } from '@/features/auth/auth-session';

function formatDisplayPhone(phone?: string | null): string {
  if (!phone) return '';
  if (phone.startsWith('+84')) {
    return '0' + phone.slice(3).replace(/\D/g, '');
  }
  return phone.replace(/\D/g, '').slice(0, 11);
}

function formatCategoryName(name: string, locale = 'vi'): string {
  if (!name) return '';
  const normalized = name.trim().toLocaleUpperCase('vi-VN');
  if (normalized === 'BƯU PHẨM') {
    return locale === 'en' ? 'Parcel / General Cargo' : 'Bưu Phẩm / Hàng Hóa Khác';
  }
  if (name !== name.toUpperCase()) return name;
  return name.toLowerCase().replace(/(^|\s)\S/g, (l) => l.toUpperCase());
}

export function getCarrierDeliveryEstimate(
  _trip?: {
    route?: {
      durationMinutes?: number | null;
      origin?: string;
      destination?: string;
    } | null;
    busCompany?: { id?: number; name?: string } | null;
  } | null,
  locale = 'vi',
): string {
  void _trip;
  return locale === 'en'
    ? 'Coordinated by operator upon receipt'
    : 'Nhà xe điều phối sau khi tiếp nhận';
}

function SendFreightContent() {
  const t = useTranslations('shipments');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, isHydrated, executeWithAuth } = useAuthSession();

  // Tab: 'create' | 'lookup'
  const [activeTab, setActiveTab] = useState<'create' | 'lookup'>(() =>
    searchParams.get('tab') === 'lookup' ? 'lookup' : 'create',
  );
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);
  const [showLookupGuideModal, setShowLookupGuideModal] =
    useState<boolean>(false);

  // Tuyến & Chuyến
  const [origin, setOrigin] = useState<string>(
    () => searchParams.get('from') || searchParams.get('origin') || '',
  );
  const [destination, setDestination] = useState<string>(
    () => searchParams.get('to') || searchParams.get('destination') || '',
  );
  const [date] = useState<string>(
    () => searchParams.get('date') || '',
  );
  const [trips, setTrips] = useState<ShipmentOption[]>([]);
  const [loadingTrips, setLoadingTrips] = useState<boolean>(false);
  const [chosenRouteId, setSelectedTripId] = useState<number | null>(null);
  const [selectedCompanyFilter, setSelectedCompanyFilter] =
    useState<string>('all');
  const [optionsPage, setOptionsPage] = useState(1);
  const [optionsTotalPages, setOptionsTotalPages] = useState(1);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [quoteResult, setQuote] = useState<
    (ShipmentQuote & { requestKey: string }) | null
  >(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteRetry, setQuoteRetry] = useState(0);
  const submissionRef = useRef<{ payload: string; key: string } | null>(null);
  const submittingRef = useRef(false);
  const [routePoints, setRoutePoints] = useState<ShipmentRoutePoints | null>(
    null,
  );
  const [routePointsLoading, setRoutePointsLoading] = useState(false);
  const [pointsRetry, setPointsRetry] = useState(0);
  const [routePointsError, setRoutePointsError] = useState<string | null>(null);
  const [senderPointId, setSenderPointId] = useState<number | null>(null);
  const [receiverPointId, setReceiverPointId] = useState<number | null>(null);

  const handleSwapLocations = () => {
    setOptionsPage(1);
    setOrigin(destination);
    setDestination(origin);
  };

  // Danh sách các nhà xe duy nhất từ kết quả tìm chuyến
  const availableCompanies = useMemo(() => {
    const map = new Map<number, { id: number; name: string }>();
    trips.forEach((t) => {
      if (t.busCompany?.id) {
        map.set(t.busCompany.id, {
          id: t.busCompany.id,
          name: t.busCompany.name,
        });
      }
    });
    return Array.from(map.values());
  }, [trips]);

  // Danh sách chuyến xe sau khi áp dụng bộ lọc nhà xe (mỗi nhà xe hiển thị 1 lựa chọn gửi hàng linh hoạt trong ngày)
  const filteredTrips = useMemo(() => {
    let result = [...trips];

    // 1. Lọc theo nhà xe
    if (selectedCompanyFilter !== 'all') {
      result = result.filter(
        (t) => String(t.busCompany?.id) === selectedCompanyFilter,
      );
    }

    return result;
  }, [trips, selectedCompanyFilter]);

  const selectedTripId = filteredTrips.some(
    (option) => option.routeId === chosenRouteId,
  )
    ? chosenRouteId
    : (filteredTrips[0]?.routeId ?? null);
  // Danh sách chuyến xe đang hiển thị (phục vụ cuộn dọc + nút Xem thêm)
  const visibleTrips = useMemo(() => {
    return filteredTrips;
  }, [filteredTrips]);

  // Người gửi
  const [senderName, setSenderName] = useState<string>('');
  const [senderPhone, setSenderPhone] = useState<string>('');
  const [senderEmail, setSenderEmail] = useState<string>('');
  const senderTouchedRef = useRef({ name: false, phone: false, email: false });

  // Tự động điền thông tin người gửi nếu đã đăng nhập
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    if (user.fullName && !senderTouchedRef.current.name) {
      setSenderName((curr) =>
        !senderTouchedRef.current.name ? user.fullName : curr,
      );
    }
    if (user.phoneNumber && !senderTouchedRef.current.phone) {
      setSenderPhone((curr) =>
        !senderTouchedRef.current.phone
          ? formatDisplayPhone(user.phoneNumber)
          : curr,
      );
    }
    const userEmail = (user as { email?: string | null }).email;
    if (userEmail && !senderTouchedRef.current.email) {
      setSenderEmail((curr) =>
        !senderTouchedRef.current.email ? userEmail : curr,
      );
    }
  }, [isAuthenticated, user]);

  // Người nhận
  const [receiverName, setReceiverName] = useState<string>('');
  const [receiverPhone, setReceiverPhone] = useState<string>('');
  const [receiverCccd, setReceiverCccd] = useState<string>('');

  // Hình thức thanh toán cước
  const [paymentOption, setPaymentOption] = useState<
    'SENDER_COUNTER' | 'RECEIVER_COUNTER'
  >('SENDER_COUNTER');
  const [createdSuccessShipment, setCreatedSuccessShipment] =
    useState<ShipmentResponseData | null>(null);

  // Kiện hàng
  const [cargoCategories, setCargoCategories] = useState<
    Array<{
      categoryId: number;
      name: string;
      description: string;
      capacityGroup: string;
    }>
  >([]);
  const [cargoCategoriesLoading, setCargoCategoriesLoading] = useState(true);
  const [cargoCategoriesError, setCargoCategoriesError] = useState<
    string | null
  >(null);
  const [cargoItems, setCargoItems] = useState<
    Array<{
      id: string;
      name: string;
      categoryId?: number;
      quantity: number;
      weight: number;
      length: string;
      width: string;
      height: string;
      serviceType: 'normal' | 'fragile' | 'valuable';
      note: string;
    }>
  >([
    {
      id: 'cargo-1',
      name: '',
      categoryId: undefined,
      quantity: 1,
      weight: 5,
      length: '',
      width: '',
      height: '',
      serviceType: 'normal',
      note: '',
    },
  ]);
  const [note, setNote] = useState<string>('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const clearFieldError = useCallback((fieldKey: string) => {
    setFieldErrors((prev) => {
      if (!prev[fieldKey]) return prev;
      const next = { ...prev };
      delete next[fieldKey];
      return next;
    });
  }, []);

  const hasFragile = useMemo(
    () => cargoItems.some((item) => item.serviceType === 'fragile'),
    [cargoItems],
  );
  const hasValuable = useMemo(
    () => cargoItems.some((item) => item.serviceType === 'valuable'),
    [cargoItems],
  );

  const handleAddCargoItem = () => {
    setCargoItems((prev) => [
      ...prev,
      {
        id: `cargo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: '',
        categoryId: prev[0]?.categoryId,
        quantity: 1,
        weight: 5,
        length: '',
        width: '',
        height: '',
        serviceType: 'normal',
        note: '',
      },
    ]);
  };

  const handleRemoveCargoItem = (id: string) => {
    setCargoItems((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((item) => item.id !== id);
    });
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[`itemName_${id}`];
      delete next[`itemCategory_${id}`];
      delete next[`itemWeight_${id}`];
      delete next[`itemDimensions_${id}`];
      return next;
    });
  };

  const handleUpdateCargoItem = (id: string, field: string, value: unknown) => {
    setCargoItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
  };

  // Tải danh mục loại hàng hóa từ API
  useEffect(() => {
    let isMounted = true;
    shipmentsApi
      .getCargoCategories()
      .then((res) => {
        if (isMounted) {
          const categories = res.data || [];
          setCargoCategories(categories);
          setCargoCategoriesError(
            categories.length === 0
              ? (locale === 'en' ? 'System has not configured cargo categories yet.' : 'Hệ thống chưa cấu hình danh mục loại hàng hóa.')
              : null,
          );
        }
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setCargoCategoriesError(
            error instanceof Error
              ? error.message
              : (locale === 'en' ? 'Failed to load cargo categories.' : 'Không thể tải danh mục loại hàng hóa.'),
          );
        }
      })
      .finally(() => {
        if (isMounted) setCargoCategoriesLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const availableCargoCategories = cargoCategories;
  const cargoItemsRef = useRef(cargoItems);
  useEffect(() => {
    cargoItemsRef.current = cargoItems;
  }, [cargoItems]);

  // Key xác định cước chỉ phụ thuộc vào tuyến, điểm bến, ngày, và thông số cước (loại hàng, trọng lượng, số lượng, kích thước, phụ phí).
  // Tuyệt đối KHÔNG đưa tên kiện hàng (item.name) vào đây để tránh việc gõ tên làm nhảy cước liên tục.
  const quotePricingKey = useMemo(
    () =>
      JSON.stringify([
        selectedTripId,
        senderPointId,
        receiverPointId,
        date,
        cargoItems.map((item) => [
          item.categoryId,
          Number(item.quantity) || 1,
          Number(item.weight) || 0,
          item.length ? Number(item.length) : null,
          item.width ? Number(item.width) : null,
          item.height ? Number(item.height) : null,
          item.serviceType,
        ]),
        hasFragile,
        hasValuable,
      ]),
    [
      selectedTripId,
      senderPointId,
      receiverPointId,
      date,
      cargoItems,
      hasFragile,
      hasValuable,
    ],
  );

  const quote = quoteResult?.requestKey === quotePricingKey ? quoteResult : null;

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (!active) return;
      setQuoteError(null);
      const currentItems = cargoItemsRef.current;
      const isInvalid =
        !selectedTripId ||
        !senderPointId ||
        !receiverPointId ||
        currentItems.some(
          (item) =>
            !item.categoryId || !(Number(item.weight) > 0) || !(Number(item.quantity) > 0),
        );

      if (isInvalid) {
        setQuote(null);
        setQuoteLoading(false);
        return;
      }

      setQuoteLoading(true);
      const itemsPayload = currentItems.map((item) => ({
        name: item.name.trim() || 'Hàng hóa',
        loaiHangHoaId: item.categoryId,
        quantity: Number(item.quantity) || 1,
        weight: Number(item.weight) || 0,
        length: item.length ? Number(item.length) : undefined,
        width: item.width ? Number(item.width) : undefined,
        height: item.height ? Number(item.height) : undefined,
        serviceType:
          item.serviceType === 'fragile'
            ? ('FRAGILE' as const)
            : item.serviceType === 'valuable'
              ? ('VALUABLE' as const)
              : ('NORMAL' as const),
      }));

      shipmentsApi
        .getQuote({
          routeId: selectedTripId,
          sendDate: date || undefined,
          senderPointId,
          receiverPointId,
          items: itemsPayload,
          isFragile: hasFragile,
          isValuable: hasValuable,
        })
        .then(({ data }) => {
          if (active) setQuote({ ...data, requestKey: quotePricingKey });
        })
        .catch((error: unknown) => {
          if (active) {
            setQuote(null);
            setQuoteError(
              error instanceof Error ? error.message : (locale === 'en' ? 'Cannot calculate freight quote.' : 'Không thể báo cước.'),
            );
          }
        })
        .finally(() => {
          if (active) setQuoteLoading(false);
        });
    }, 150);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [
    quotePricingKey,
    quoteRetry,
    selectedTripId,
    senderPointId,
    receiverPointId,
    date,
    hasFragile,
    hasValuable,
  ]);
  const calculatedPricing = {
    totalWeight: cargoItems.reduce(
      (sum, item) => sum + item.weight * item.quantity,
      0,
    ),
    baseFee: quote?.baseFee ?? 0,
    totalFee: quote?.totalFee ?? 0,
    serviceFee: quote?.serviceFee ?? 0,
    rateExceededWarning: quoteError,
  };

  // Trạng thái xử lý tạo đơn
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [missingFieldsModal, setMissingFieldsModal] = useState<boolean>(false);
  const [createdShipment, setCreatedShipment] =
    useState<ShipmentResponseData | null>(null);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Tra cứu vận đơn
  const [lookupCode, setLookupCode] = useState<string>(
    () => searchParams.get('code') || '',
  );
  const [lookupPhone, setLookupPhone] = useState<string>(
    () => searchParams.get('phone') || '',
  );
  const [isLookingUp, setIsLookingUp] = useState<boolean>(false);
  const [lookupResult, setLookupResult] =
    useState<PublicShipmentLookupData | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);
  const [cancelReason, setCancelReason] = useState<string>(
    'Đặt nhầm thông tin người gửi/nhận',
  );
  const [customCancelReason, setCustomCancelReason] = useState<string>('');
  const [isCancellingShipment, setIsCancellingShipment] =
    useState<boolean>(false);
  const [cancelShipmentError, setCancelShipmentError] = useState<string | null>(
    null,
  );
  const [cancelShipmentSuccess, setCancelShipmentSuccess] = useState<
    string | null
  >(null);

  // Each search invalidates older requests, including manual refresh and clearing the route.
  const tripRequestId = useRef(0);
  const fetchTrips = useCallback(async () => {
    const requestId = ++tripRequestId.current;
    if (optionsPage === 1) {
      setTrips([]);
      setSelectedTripId(null);
    }
    setOptionsError(null);
    if (!origin || !destination) {
      setLoadingTrips(false);
      return;
    }
    setLoadingTrips(true);
    try {
      const res = await shipmentsApi.getOptions({
        from: origin,
        to: destination,
        page: optionsPage,
        pageSize: 8,
      });
      if (tripRequestId.current !== requestId) return;
      const loadedTrips = res.data || [];
      setTrips((previous) =>
        optionsPage === 1 ? loadedTrips : [...previous, ...loadedTrips],
      );
      setOptionsTotalPages(res.meta.totalPages);
      if (optionsPage === 1) setSelectedTripId(loadedTrips[0]?.routeId ?? null);
    } catch (error: unknown) {
      if (tripRequestId.current === requestId)
        setOptionsError(
          error instanceof Error
            ? error.message
            : (locale === 'en' ? 'Failed to load operators for shipping.' : 'Không thể tải nhà xe nhận hàng.'),
        );
    } finally {
      if (tripRequestId.current === requestId) setLoadingTrips(false);
    }
  }, [origin, destination, optionsPage]);

  useEffect(() => {
    const timer = setTimeout(() => void fetchTrips(), 0);
    return () => {
      clearTimeout(timer);
      tripRequestId.current += 1;
    };
  }, [fetchTrips]);

  const selectedTrip = useMemo(() => {
    return trips.find((t) => t.routeId === selectedTripId) || null;
  }, [trips, selectedTripId]);

  const fragileSurcharge =
    quote?.surcharges?.fragile ??
    quoteResult?.surcharges?.fragile ??
    selectedTrip?.surcharges?.fragile ??
    20_000;
  const valuableSurcharge =
    quote?.surcharges?.valuable ??
    quoteResult?.surcharges?.valuable ??
    selectedTrip?.surcharges?.valuable ??
    50_000;

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (!active) return;
      setRoutePoints(null);
      setRoutePointsError(null);
      setSenderPointId(null);
      setReceiverPointId(null);
      if (!selectedTripId) {
        setRoutePointsLoading(false);
        return;
      }

      setRoutePointsLoading(true);
      shipmentsApi
        .getRoutePointsByRoute(selectedTripId)
        .then(({ data }) => {
          if (!active) return;
          setRoutePoints(data);
          if (data.senderPoints.length === 1) {
            setSenderPointId(data.senderPoints[0].id);
          }
          if (data.receiverPoints.length === 1) {
            setReceiverPointId(data.receiverPoints[0].id);
          }
        })
        .catch((error: unknown) => {
          if (active) {
            setRoutePointsError(
              error instanceof Error
                ? error.message
                : (locale === 'en' ? 'Failed to load departure and destination stations.' : 'Không thể tải điểm gửi và điểm nhận của chuyến xe.'),
            );
          }
        })
        .finally(() => {
          if (active) setRoutePointsLoading(false);
        });
    }, 0);
    return () => {
      clearTimeout(timer);
      active = false;
    };
  }, [selectedTripId, trips, pointsRetry]);

  // Xử lý tạo mã vận đơn
  const handleCreateShipment = async () => {
    if (submittingRef.current) return;
    setErrorMessage(null);

    if (!isHydrated) {
      setErrorMessage(
        locale === 'en' ? 'Verifying session. Please try again shortly.' : 'Đang xác minh phiên đăng nhập. Vui lòng thử lại sau giây lát.',
      );
      return;
    }

    const errors: Record<string, string> = {};
    let firstErrorId: string | null = null;

    const addFieldError = (
      fieldKey: string,
      domId: string,
      message: string,
    ) => {
      if (!errors[fieldKey]) {
        errors[fieldKey] = message;
        if (!firstErrorId) {
          firstErrorId = domId;
        }
      }
    };

    if (!selectedTripId) {
      addFieldError(
        'selectedTripId',
        'step-select-trip',
        t('errorSelectTrip'),
      );
    }
    if (!senderName.trim()) {
      addFieldError(
        'senderName',
        'input-sender-name',
        t('errorSenderName'),
      );
    }
    if (!senderPhone.trim()) {
      addFieldError(
        'senderPhone',
        'input-sender-phone',
        t('errorSenderPhone'),
      );
    } else if (!/^0\d{9,10}$/.test(senderPhone.trim())) {
      addFieldError(
        'senderPhone',
        'input-sender-phone',
        t('errorSenderPhoneInvalid'),
      );
    }

    if (!receiverName.trim()) {
      addFieldError(
        'receiverName',
        'input-receiver-name',
        t('errorReceiverName'),
      );
    }
    if (!receiverPhone.trim()) {
      addFieldError(
        'receiverPhone',
        'input-receiver-phone',
        t('errorReceiverPhone'),
      );
    } else if (!/^0\d{9,10}$/.test(receiverPhone.trim())) {
      addFieldError(
        'receiverPhone',
        'input-receiver-phone',
        t('errorReceiverPhoneInvalid'),
      );
    }

    if (receiverCccd.trim() && !/^(\d{9}|\d{12})$/.test(receiverCccd.trim())) {
      addFieldError(
        'receiverCccd',
        'input-receiver-cccd',
        t('errorReceiverCccdInvalid'),
      );
    }

    if (!senderPointId) {
      addFieldError(
        'senderPointId',
        'select-sender-point',
        t('errorSenderPoint'),
      );
    }
    if (!receiverPointId) {
      addFieldError(
        'receiverPointId',
        'select-receiver-point',
        t('errorReceiverPoint'),
      );
    } else if (senderPointId && senderPointId === receiverPointId) {
      addFieldError(
        'receiverPointId',
        'select-receiver-point',
        t('errorSamePoint'),
      );
    }

    cargoItems.forEach((item, index) => {
      const prefix = cargoItems.length > 1 ? (locale === 'en' ? `Package #${index + 1}: ` : `Kiện #${index + 1}: `) : '';
      if (!item.name.trim()) {
        addFieldError(
          `itemName_${item.id}`,
          `input-item-name-${item.id}`,
          `${prefix}${t('errorItemName')}`,
        );
      }
      if (!item.categoryId) {
        addFieldError(
          `itemCategory_${item.id}`,
          `select-item-category-${item.id}`,
          `${prefix}${t('errorItemCategory')}`,
        );
      }

      const hasAnyDimension = Boolean(
        item.length.trim() || item.width.trim() || item.height.trim(),
      );
      const hasAllValidDimensions =
        Number(item.length) > 0 &&
        Number(item.width) > 0 &&
        Number(item.height) > 0;
      if (hasAnyDimension && !hasAllValidDimensions) {
        addFieldError(
          `itemDimensions_${item.id}`,
          `input-item-length-${item.id}`,
          `${prefix}${t('errorItemDimensions')}`,
        );
      }
      if (!(Number(item.weight) > 0) && !hasAllValidDimensions) {
        addFieldError(
          `itemWeight_${item.id}`,
          `input-item-weight-${item.id}`,
          `${prefix}${t('errorItemWeight')}`,
        );
      }
    });

    if (calculatedPricing.rateExceededWarning) {
      addFieldError(
        'pricingWarning',
        'step-select-trip',
        calculatedPricing.rateExceededWarning,
      );
    }

    if (
      Object.keys(errors).length > 0 ||
      !selectedTripId ||
      !senderPointId ||
      !receiverPointId
    ) {
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        setMissingFieldsModal(true);
        if (firstErrorId) {
          setTimeout(() => {
            const el = document.getElementById(firstErrorId!);
            if (el) {
              if (typeof el.scrollIntoView === 'function') {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
              if ('focus' in el && typeof el.focus === 'function') {
                el.focus();
              }
            }
          }, 60);
        }
      }
      return;
    }

    if (cargoCategoriesLoading || cargoCategoriesError) {
      setErrorMessage(
        cargoCategoriesError ||
          locale === 'en' ? 'Cargo categories not ready. Please try again later.' : 'Danh mục loại hàng chưa sẵn sàng. Vui lòng thử lại sau.',
      );
      return;
    }

    if (routePointsLoading || routePointsError) {
      setErrorMessage(
        routePointsError || (locale === 'en' ? 'Loading stations. Please try again.' : 'Đang tải điểm gửi và điểm nhận. Vui lòng thử lại.'),
      );
      return;
    }

    if (!quote || quoteLoading || quoteError) {
      setErrorMessage(
        quoteError || (locale === 'en' ? 'Please wait for freight quote before creating waybill.' : 'Vui lòng chờ báo cước trước khi tạo vận đơn.'),
      );
      return;
    }
    submittingRef.current = true;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const freightPayer: 'NGUOI_NHAN' | 'NGUOI_GUI' =
        paymentOption === 'RECEIVER_COUNTER' ? 'NGUOI_NHAN' : 'NGUOI_GUI';
      const paymentMethod = 'TAI_BEN' as const;

      const payload = {
        routeId: selectedTripId,
        sendDate: date || undefined,
        senderPointId,
        receiverPointId,
        freightPayer,
        paymentMethod,
        sender: {
          fullName: senderName.trim(),
          phoneNumber: senderPhone.trim(),
          email: senderEmail.trim() || undefined,
        },
        receiver: {
          fullName: receiverName.trim(),
          phoneNumber: receiverPhone.trim(),
          cccd: receiverCccd.trim() || undefined,
        },
        items: cargoItems.map((item) => {
          const categoryName =
            cargoCategories.find((cat) => cat.categoryId === item.categoryId)
              ?.name || '';
          return {
            name: item.name.trim(),
            category: categoryName,
            loaiHangHoaId: item.categoryId,
            quantity: Math.max(1, Number(item.quantity) || 1),
            weight: Number(item.weight),
            length: item.length ? Number(item.length) : undefined,
            width: item.width ? Number(item.width) : undefined,
            height: item.height ? Number(item.height) : undefined,
            serviceType:
              item.serviceType === 'fragile'
                ? ('FRAGILE' as const)
                : item.serviceType === 'valuable'
                  ? ('VALUABLE' as const)
                  : ('NORMAL' as const),
            note: item.note.trim() || undefined,
          };
        }),
        isFragile: hasFragile,
        isValuable: hasValuable,
        note: note.trim() || undefined,
      };

      const serializedPayload = JSON.stringify(payload);
      if (submissionRef.current?.payload !== serializedPayload) {
        submissionRef.current = {
          payload: serializedPayload,
          key: crypto.randomUUID(),
        };
      }
      const idempotencyKey = submissionRef.current.key;
      const res = isAuthenticated
        ? await executeWithAuth((token) =>
            shipmentsApi.createShipment(payload, token, idempotencyKey),
          )
        : await shipmentsApi.createShipment(payload, undefined, idempotencyKey);
      const data = res.data;
      const totalFare = data?.pricing?.totalFee;
      if (
        !Number.isSafeInteger(data?.shipmentId) ||
        data.shipmentId <= 0 ||
        !data.waybillCode?.trim() ||
        !data.orderCode?.trim() ||
        typeof totalFare !== 'number' ||
        !Number.isFinite(totalFare) ||
        totalFare < 0 ||
        !Number.isFinite(Date.parse(data.paymentExpiresAt))
      ) {
        throw new Error(
          locale === 'en' ? 'Shipment created but missing full details. Please look up using waybill code or contact support.' : 'Đơn gửi đã được tạo nhưng chưa nhận đủ thông tin. Vui lòng tra cứu bằng mã vận đơn hoặc liên hệ hỗ trợ.',
        );
      }

      setCreatedSuccessShipment(data);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.details)
        setFieldErrors(
          Object.fromEntries(
            err.details.map((detail) => [detail.field, detail.message]),
          ),
        );
      setErrorMessage(
        (err instanceof Error ? err.message : '') ||
          locale === 'en' ? 'Cannot create shipment waybill. Please verify your details.' : 'Không thể tạo đơn gửi hàng. Vui lòng kiểm tra lại thông tin.',
      );
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  // Tra cứu vận đơn
  const executeLookup = useCallback(async (code: string, phone: string) => {
    setLookupError(null);
    setLookupResult(null);
    setCancelShipmentError(null);
    setCancelShipmentSuccess(null);

    if (!code.trim()) {
      setLookupError(locale === 'en' ? 'Please enter waybill code.' : 'Vui lòng nhập mã vận đơn.');
      return;
    }
    if (!phone.trim()) {
      setLookupError(locale === 'en' ? 'Please enter sender or receiver phone number.' : 'Vui lòng nhập số điện thoại người gửi hoặc người nhận.');
      return;
    }

    setIsLookingUp(true);
    try {
      const res = await shipmentsApi.lookupShipment({
        waybillCode: code.trim(),
        phoneNumber: phone.trim(),
      });
      setLookupResult(res.data);
    } catch (err: unknown) {
      setLookupError(
        (err instanceof Error ? err.message : '') ||
          locale === 'en' ? 'No waybill found matching the provided information.' : 'Không tìm thấy thông tin vận đơn khớp với thông tin đã nhập.',
      );
    } finally {
      setIsLookingUp(false);
    }
  }, []);

  const handleConfirmCancelShipment = async () => {
    if (!lookupResult) return;
    const finalReason =
      cancelReason === 'OTHER'
        ? customCancelReason.trim() || (locale === 'en' ? 'Customer cancelled shipment online' : 'Khách hàng chủ động hủy đơn trực tuyến')
        : cancelReason;

    setIsCancellingShipment(true);
    setCancelShipmentError(null);
    try {
      const res = await shipmentsApi.cancelShipment({
        waybillCode: lookupResult.waybillCode,
        phoneNumber: lookupPhone.trim(),
        reason: finalReason,
      });
      setLookupResult((prev) =>
        prev
          ? {
              ...prev,
              status: 'DA_HUY',
              orderStatus: 'DA_HUY',
              timeline: [
                ...(prev.timeline || []),
                { status: 'DA_HUY', time: res.data.updatedAt || new Date().toISOString() },
              ],
            }
          : prev,
      );
      setCancelShipmentSuccess(res.data.message);
      setShowCancelModal(false);
    } catch (err: unknown) {
      setCancelShipmentError(
        (err instanceof Error ? err.message : '') ||
          locale === 'en' ? 'Cannot cancel shipment. Please try again.' : 'Không thể hủy đơn gửi hàng. Vui lòng thử lại.',
      );
    } finally {
      setIsCancellingShipment(false);
    }
  };

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeLookup(lookupCode, lookupPhone);
  };

  useEffect(() => {
    const codeParam = searchParams.get('code');
    const phoneParam = searchParams.get('phone');
    if (
      searchParams.get('tab') === 'lookup' &&
      codeParam?.trim() &&
      phoneParam?.trim()
    ) {
      void executeLookup(codeParam.trim(), phoneParam.trim());
    }
  }, [searchParams, executeLookup]);

  const copyToClipboard = (text: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const formatIsoDate = (isoStr: string | null | undefined) => {
    if (!isoStr) return locale === 'en' ? 'Trip unassigned' : 'Chưa phân chuyến';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return isoStr;
    }
  };

  const formatIsoTime = (isoStr: string | null | undefined) => {
    if (!isoStr) return locale === 'en' ? 'Trip unassigned' : 'Chưa phân chuyến';
    try {
      const d = new Date(isoStr);
      return d.toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F6F8] font-sans pb-16">
      {/* ============================================================== */}
      {/* HERO BANNER SECTION */}
      {/* ============================================================== */}
      <div className="bg-[#17223B] text-white pt-10 pb-16 px-4 sm:px-6 relative z-0 overflow-hidden">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-2">
              {activeTab === 'lookup' ? (
                <>
                  {t('heroTitleLookup')} <br className="hidden sm:inline" />
                  <span className="text-[#FF7D42]">{t('heroSubtitleLookup')}</span>
                </>
              ) : (
                <>
                  {t('heroTitleCreate')} <br className="hidden sm:inline" />
                  <span className="text-[#FF7D42]">{t('heroSubtitleCreate')}</span>
                </>
              )}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl leading-relaxed">
              {activeTab === 'lookup'
                ? t('heroDescLookup')
                : t('heroDescCreate')}
            </p>
          </div>

          {activeTab === 'lookup' && (
            <div className="inline-flex p-1 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/10 self-start md:self-auto shrink-0">
              <Link
                href="/tickets/lookup"
                className="px-5 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all text-white/80 hover:text-white flex items-center gap-2"
              >
                <Ticket className="w-4 h-4 text-[#60a5fa]" />
                <span>{t('tabTicketsLookup')}</span>
              </Link>
              <Link
                href="/send-freight?tab=lookup"
                className="px-5 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all bg-white text-[#17223B] shadow-sm flex items-center gap-2"
              >
                <Package className="w-4 h-4 text-orange-500" />
                <span>{t('tabWaybillLookup')}</span>
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 -mt-8 relative">
        {/* ============================================================== */}
        {/* TAB 1: TẠO ĐƠN GỬI HÀNG */}
        {/* ============================================================== */}
        {activeTab === 'create' && (
          <>
            {/* THÔNG BÁO TẠO THÀNH CÔNG NẾU CÓ */}
            {createdShipment ? (
              <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-emerald-200 mb-8">
                <div className="text-center max-w-xl mx-auto">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full mb-4">
                    <CheckCircle className="w-10 h-10" />
                  </div>
                  <h2 className="text-2xl font-black text-slate-900 mb-2">
                    {t('createdTitle')}
                  </h2>
                  <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                    {t('createdDesc')}
                  </p>

                  {/* Mã vận đơn nổi bật */}
                  <div className="bg-slate-50 border-2 border-emerald-500/30 rounded-2xl p-5 mb-6 text-center">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      {t('yourWaybillCode')}
                    </div>
                    <div className="text-2xl md:text-3xl font-black text-[#0060c4] tracking-wide flex items-center justify-center gap-3">
                      <span>{createdShipment.waybillCode}</span>
                      <button
                        onClick={() =>
                          copyToClipboard(createdShipment.waybillCode)
                        }
                        className="p-2 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors"
                        title={locale === 'en' ? 'Copy code' : 'Sao chép mã'}
                      >
                        <Copy className="w-5 h-5" />
                      </button>
                    </div>
                    {copiedCode && (
                      <div className="text-xs text-emerald-600 font-bold mt-1">
                        {t('copiedToClipboard')}
                      </div>
                    )}
                    <div className="text-xs text-slate-500 mt-2">
                      {t('orderCode')}{' '}
                      <strong className="text-slate-700">
                        {createdShipment.orderCode}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Chi tiết tiếp nhận */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-100 pt-6 max-w-2xl mx-auto text-sm">
                  <div className="bg-slate-50 p-4 rounded-xl">
                    <div className="font-bold text-slate-800 flex items-center gap-2 mb-2">
                      <MapPin className="w-4 h-4 text-rose-500" /> Điểm gửi (Nơi
                      bạn mang hàng ra):
                    </div>
                    <div className="font-extrabold text-slate-900">
                      {createdShipment.pickupPoint.name}
                    </div>
                    <div className="text-xs text-slate-600 mt-1">
                      {createdShipment.pickupPoint.address}
                    </div>
                    <div className="text-xs text-blue-600 font-semibold mt-2">
                      {getCarrierDeliveryEstimate(createdShipment.trip)}
                    </div>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl">
                    <div className="font-bold text-slate-800 flex items-center gap-2 mb-2">
                      <MapPin className="w-4 h-4 text-emerald-500" /> Điểm nhận
                      (Nơi người nhận đến lấy):
                    </div>
                    <div className="font-extrabold text-slate-900">
                      {createdShipment.dropoffPoint.name}
                    </div>
                    <div className="text-xs text-slate-600 mt-1">
                      {createdShipment.dropoffPoint.address}
                    </div>
                    <div className="text-xs text-slate-600 font-semibold mt-2">
                      {locale === 'en' ? 'Receiver: ' : 'Người nhận: '}
                      <strong>{createdShipment.receiver.fullName}</strong> (
                      {createdShipment.receiver.phoneNumber})
                      {createdShipment.receiver.cccd && (
                        <span>
                          {' '}
                          · CCCD:{' '}
                          <strong className="font-mono">
                            {createdShipment.receiver.cccd}
                          </strong>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Hàng hóa & Cước */}
                <div className="max-w-2xl mx-auto mt-4 bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex justify-between items-center text-sm">
                  <div>
                    <span className="text-slate-600">{locale === 'en' ? 'Packages: ' : 'Kiện hàng: '}</span>
                    <strong className="text-slate-900">
                      {createdShipment.items
                        .map((i) => `${i.name} (${i.weight}kg)`)
                        .join(', ')}
                    </strong>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500">{locale === 'en' ? 'Total Freight' : 'Tổng cước phí'}</div>
                    <div className="text-lg font-black text-rose-600">
                      {createdShipment.pricing.totalFee.toLocaleString('vi-VN')}
                      đ
                    </div>
                  </div>
                </div>

                {/* Thông báo đã lưu vào tài khoản nếu đã đăng nhập */}
                {isAuthenticated && (
                  <div className="max-w-2xl mx-auto mt-4 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center justify-between gap-3 animate-in fade-in">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{t('autoSavedNotice')}</span>
                    </div>
                    <Link
                      href="/account/shipments"
                      className="font-bold text-emerald-700 hover:text-emerald-900 underline whitespace-nowrap"
                    >
                      {locale === 'en' ? 'My Shipments →' : 'Đơn hàng của tôi →'}
                    </Link>
                  </div>
                )}

                {/* Nút hành động */}
                <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 max-w-2xl mx-auto">
                  <button
                    onClick={() => {
                      setCreatedShipment(null);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="w-full sm:w-auto px-5 py-3 border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" /> {t('createNewOrder')}
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('lookup');
                      setLookupCode(createdShipment.waybillCode);
                      setLookupPhone(createdShipment.sender.phoneNumber);
                      void executeLookup(
                        createdShipment.waybillCode,
                        createdShipment.sender.phoneNumber,
                      );
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="w-full sm:w-auto px-5 py-3 bg-[#0060c4] hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                  >
                    <Search className="w-4 h-4" /> {locale === 'en' ? 'Track Journey Now' : 'Theo dõi hành trình ngay'}
                  </button>

                  {isAuthenticated && (
                    <Link
                      href="/account/shipments"
                      className="w-full sm:w-auto px-5 py-3 border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
                    >
                      <Package className="w-4 h-4 text-emerald-600" /> {locale === 'en' ? 'Manage in Account' : 'Quản lý trong tài khoản'}
                    </Link>
                  )}
                </div>
              </div>
            ) : (
              /* FORM TẠO ĐƠN GỬI HÀNG */
              <div className="space-y-6">
                {errorMessage && (
                  <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-2xl flex items-start gap-3 text-sm">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-500" />
                    <div>{errorMessage}</div>
                  </div>
                )}

                {/* STEP 1: CHỌN TUYẾN & NGÀY GỬI */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-6 text-slate-900">
                  {/* Tab Gửi hàng (không có nút Đặt vé theo yêu cầu) */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 pb-4">
                    <div className="inline-flex w-fit rounded-lg bg-slate-100 p-1">
                      <div className="h-10 px-4 rounded-md text-sm font-extrabold flex items-center gap-2 bg-brand text-white shadow-sm cursor-default">
                        <PackageCheck className="w-4 h-4" />
                        {t('tabCreate')}
                      </div>
                    </div>
                  </div>

                  {/* Vùng chọn tuyến & ngày gửi */}
                  <div className="flex flex-col pt-4">
                    <div className="flex flex-col md:flex-row gap-3">
                      {/* Nơi gửi */}
                      <div className="flex-1 space-y-1.5">
                        <label
                          htmlFor="shipment-origin"
                          className="text-[11px] font-extrabold text-slate-500 uppercase flex items-center gap-1.5"
                        >
                          <MapPin className="w-3.5 h-3.5 text-brand" />
                          {t('departureLocationText')}
                        </label>
                        <LocationPicker
                          id="shipment-origin"
                          value={origin}
                          onChange={(value) => {
                            setOptionsPage(1);
                            setOrigin(value);
                          }}
                          placeholder={t('originPlaceholder')}
                        />
                      </div>

                      {/* Nút đổi chiều tuyến */}
                      <div className="hidden md:flex items-end pb-1 lg:shrink-0">
                        <button
                          type="button"
                          onClick={handleSwapLocations}
                          className="w-11 h-11 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-brand flex items-center justify-center transition-colors cursor-pointer shrink-0"
                          title={t('swapRouteTitle')}
                        >
                          <ArrowRightLeft className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Nơi nhận */}
                      <div className="flex-1 space-y-1.5">
                        <label
                          htmlFor="shipment-destination"
                          className="text-[11px] font-extrabold text-slate-500 uppercase flex items-center gap-1.5"
                        >
                          <MapPin className="w-3.5 h-3.5 text-rose-500" />
                          {t('destinationLocationText')}
                        </label>
                        <LocationPicker
                          id="shipment-destination"
                          value={destination}
                          excludeValue={origin}
                          onChange={(value) => {
                            setOptionsPage(1);
                            setDestination(value);
                          }}
                          placeholder={t('destinationPlaceholder')}
                        />
                      </div>
                    </div>

                    {/* Hàng dưới: {t('shipmentGuide')} & Tìm nhà xe */}
                    <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => setShowGuideModal(true)}
                        className="text-sm font-bold text-[#FF5722] hover:text-[#E64A19] hover:underline transition-colors cursor-pointer text-left"
                      >
                        {t('shipmentGuide')}
                      </button>
                      <div>
                        <button
                          type="button"
                          disabled={loadingTrips}
                          onClick={() => {
                            fetchTrips();
                            const step2El =
                              document.getElementById('step-select-trip');
                            if (step2El) {
                              step2El.scrollIntoView({ behavior: 'smooth' });
                            }
                          }}
                          className="w-full sm:w-[170px] h-12 px-7 rounded-lg bg-accent hover:bg-accent-hover text-white font-black text-sm flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-75 transition-all"
                        >
                          {loadingTrips ? (
                            <>
                              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                              <span>{t('findingBusCompany')}</span>
                            </>
                          ) : (
                            <>
                              <Search className="w-4 h-4 shrink-0" />
                              <span>{t('findBusCompany')}</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2 CỘT CHÍNH: FORM NHẬP LIỆU & SIDEBAR DỰ TÍNH CƯỚC */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  <div className="lg:col-span-8 space-y-6">
                    {/* STEP 2: CHỌN NHÀ XE VẬN CHUYỂN */}
                    <div
                      id="step-select-trip"
                      className={`bg-white rounded-2xl p-6 shadow-sm border transition-colors ${
                        fieldErrors.selectedTripId
                          ? 'border-rose-500 ring-2 ring-rose-200'
                          : 'border-slate-200'
                      }`}
                    >
                      {fieldErrors.selectedTripId && (
                        <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>{fieldErrors.selectedTripId}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-6 h-6 rounded-full bg-[#EF4444] text-white flex items-center justify-center text-xs font-bold">
                            1
                          </div>
                          <div>
                            <h2 className="text-base font-extrabold text-slate-900">
                              {t('stepSelectTrip')}
                            </h2>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {t('stepSelectTripDesc')}
                            </p>
                          </div>
                        </div>

                        <span className="px-3 py-1 bg-blue-50 text-blue-600 font-bold text-xs rounded-full">
                          {loadingTrips
                            ? t('loadingTrips')
                            : t('optionsCount', { count: filteredTrips.length })}
                        </span>
                      </div>

                      {/* BỐ CỤC 2 CỘT: CỘT TRÁI BỘ LỌC - CỘT PHẢI DANH SÁCH XE */}
                      <div className="flex flex-col md:flex-row gap-5 items-start">
                        {/* CỘT TRÁI: BỘ LỌC DẠNG DROPDOWN SỔ XUỐNG */}
                        <div className="w-full md:w-56 shrink-0 bg-slate-50/80 p-4 rounded-2xl border border-slate-200 space-y-4">
                          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                            <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-800 uppercase tracking-wide">
                              <Filter className="w-3.5 h-3.5 text-slate-500" />
                              <span>{t('filterHeader')}</span>
                            </div>
                            {selectedCompanyFilter !== 'all' && (
                              <button
                                type="button"
                                onClick={() => setSelectedCompanyFilter('all')}
                                className="text-[11px] text-[#0060c4] hover:underline font-semibold flex items-center gap-0.5"
                              >
                                <RotateCcw className="w-3 h-3" /> {t('clearFilter')}
                              </button>
                            )}
                          </div>

                          {/* 1. Dropdown Nhà xe */}
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1.5 flex items-center gap-1">
                              <Building2 className="w-3 h-3 text-slate-400" />
                              <span>{t('busCompanyLabel')}</span>
                            </label>
                            <div className="relative">
                              <select
                                value={selectedCompanyFilter}
                                onChange={(e) =>
                                  setSelectedCompanyFilter(e.target.value)
                                }
                                className="w-full h-10 pl-3 pr-8 rounded-xl border border-slate-200 hover:border-slate-300 focus:outline-none focus:border-[#0060c4] font-medium text-slate-800 bg-white appearance-none cursor-pointer text-xs"
                              >
                                <option value="all">{t('allCompanies')}</option>
                                {availableCompanies.map((comp) => (
                                  <option key={comp.id} value={String(comp.id)}>
                                    {comp.name}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>
                          </div>
                        </div>

                        {/* CỘT PHẢI: HIỂN THỊ THÔNG TIN CHUYẾN XE */}
                        <div className="flex-1 min-w-0 w-full">
                          {loadingTrips ? (
                            <div className="p-8 text-center text-slate-400 text-sm bg-slate-50 rounded-xl">
                              {t('loadingTripsList')}
                            </div>
                          ) : optionsError ? (
                            <div role="alert">
                              {optionsError}
                              <button
                                type="button"
                                onClick={() => void fetchTrips()}
                              >
                                {t('retry')}
                              </button>
                            </div>
                          ) : filteredTrips.length === 0 ? (
                            <div className="py-5 px-4 text-center text-slate-500 text-sm bg-slate-50 rounded-xl border border-slate-200">
                              {!origin || !destination
                                ? (locale === 'en'
                                    ? 'Select origin and destination to see available operators.'
                                    : 'Chọn nơi gửi và nơi nhận để xem nhà xe có nhận vận chuyển.')
                                : trips.length > 0
                                  ? (locale === 'en'
                                      ? 'No matching operators found.'
                                      : 'Không tìm thấy nhà xe phù hợp.')
                                  : (locale === 'en'
                                      ? 'No operators available on this route.'
                                      : 'Chưa có nhà xe nhận gửi trên tuyến này.')}
                            </div>
                          ) : (
                            /* Khung cuộn cố định chiều cao kèm nút Xem thêm */
                            <div className="flex flex-col gap-2.5 w-full max-h-[400px] sm:max-h-[440px] overflow-y-auto pr-1 sm:pr-1.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-slate-100 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-slate-400">
                              {visibleTrips.map((trip) => {
                                const isSelected =
                                  selectedTripId === trip.routeId;
                                return (
                                  <div
                                    key={trip.routeId}
                                    id={`trip-card-${trip.routeId}`}
                                    onClick={() => {
                                      setSelectedTripId(trip.routeId);
                                      clearFieldError('selectedTripId');
                                    }}
                                    className={`py-2 px-3 sm:px-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between gap-2 sm:gap-3 w-full shrink-0 ${
                                      isSelected
                                        ? 'border-orange-500 bg-white ring-2 ring-orange-100 shadow-xs'
                                        : 'border-slate-200 bg-white hover:border-slate-300'
                                    }`}
                                  >
                                    {/* Cột 1: Thông tin nhà xe */}
                                    <div className="flex-1 min-w-0">
                                      <div className="font-extrabold text-slate-900 text-xs sm:text-sm leading-tight truncate">
                                        {trip.busCompany.name}
                                      </div>
                                      <div className="flex items-center gap-1 text-[10px] sm:text-[11px] text-emerald-600 font-semibold mt-0.5 truncate">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                                        <span className="truncate">
                                          {t('operatingHoursNote')}
                                        </span>
                                      </div>
                                    </div>

                                    <div className="shrink-0 text-right">
                                      <div className="text-xs font-extrabold text-orange-600">
                                        {trip.minimumEstimatedFee == null
                                          ? t('noReferencePrice')
                                          : (locale === 'en'
                                              ? `From ${trip.minimumEstimatedFee.toLocaleString('en-US')} VND`
                                              : `Cước từ ${trip.minimumEstimatedFee.toLocaleString('vi-VN')} đ`)}
                                      </div>
                                      {trip.minimumEstimatedFee != null && (
                                        <div className="mt-0.5 text-[10px] text-slate-500">
                                          {locale === 'en'
                                            ? 'Exact fare after selecting stations'
                                            : 'Giá chính xác sau khi chọn bưu cục'}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}

                              {/* Nút Xem thêm nhà xe khi còn chuyến chưa hiển thị */}
                              {optionsPage < optionsTotalPages ? (
                                <div className="pt-2 pb-1 flex flex-col items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setOptionsPage((prev) => prev + 1)
                                    }
                                    className="w-full py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-orange-50 hover:border-orange-300 hover:text-orange-600 font-extrabold text-xs text-slate-700 shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                  >
                                    <span>{t('viewMoreCompanies')}</span>
                                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                                  </button>
                                  <p className="text-[10px] text-slate-400">
                                    {locale === 'en'
                                      ? `Showing ${visibleTrips.length} / ${filteredTrips.length} operators`
                                      : `Đang hiển thị ${visibleTrips.length} / ${filteredTrips.length} chuyến`}
                                  </p>
                                </div>
                              ) : filteredTrips.length > 8 ? (
                                <div className="text-center pt-2 pb-1 text-[11px] text-slate-400 font-medium shrink-0">
                                  {locale === 'en'
                                    ? `✓ All ${filteredTrips.length} operators displayed`
                                    : `✓ Đã hiển thị tất cả ${filteredTrips.length} chuyến xe`}
                                </div>
                              ) : null}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* STEP 3: THÔNG TIN NGƯỜI GỬI & NGƯỜI NHẬN */}
                    <div
                      id="step-sender-receiver"
                      className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200"
                    >
                      <div className="flex items-center gap-2.5 mb-1">
                        <div className="w-6 h-6 rounded-full bg-[#EF4444] text-white flex items-center justify-center text-xs font-bold">
                          2
                        </div>
                        <h2 className="text-base font-extrabold text-slate-900">
                          {t('stepSenderReceiver')}
                        </h2>
                      </div>
                      <p className="text-xs text-slate-400 mb-5 pl-8.5">
                        {t('stepSenderReceiverDesc')}
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
                        {/* Người gửi */}
                        <div className="space-y-3.5">
                          <div className="flex items-center gap-2.5 pb-1">
                            <div className="w-8 h-8 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center">
                              <User className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="font-extrabold text-slate-900 text-sm">
                                {t('senderTitle')}
                              </div>
                              <div className="text-[11px] text-slate-400">
                                {t('senderSubtitle')}
                              </div>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                              {t('fullName')} <span className="text-rose-500">*</span>
                            </label>
                            <input
                              id="input-sender-name"
                              type="text"
                              value={senderName}
                              onChange={(e) => {
                                senderTouchedRef.current.name = true;
                                setSenderName(e.target.value);
                                clearFieldError('senderName');
                              }}
                              placeholder={t('fullNamePlaceholder')}
                              className={`w-full h-11 px-3.5 rounded-xl border text-slate-800 text-sm focus:outline-none transition-colors ${
                                fieldErrors.senderName
                                  ? 'border-rose-500 bg-rose-50/20 ring-1 ring-rose-500 focus:border-rose-500'
                                  : 'border-slate-200 bg-slate-50/50 focus:border-orange-500'
                              }`}
                            />
                            {fieldErrors.senderName && (
                              <p className="mt-1 text-xs text-rose-600 font-medium flex items-center gap-1 animate-in fade-in">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                <span>{fieldErrors.senderName}</span>
                              </p>
                            )}
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                              {t('phoneNumber')}{' '}
                              <span className="text-rose-500">*</span>
                            </label>
                            <input
                              id="input-sender-phone"
                              type="tel"
                              inputMode="numeric"
                              value={senderPhone}
                              onChange={(e) => {
                                senderTouchedRef.current.phone = true;
                                setSenderPhone(
                                  e.target.value
                                    .replace(/\D/g, '')
                                    .slice(0, 11),
                                );
                                clearFieldError('senderPhone');
                              }}
                              placeholder={t('phonePlaceholder')}
                              className={`w-full h-11 px-3.5 rounded-xl border text-slate-800 text-sm focus:outline-none transition-colors ${
                                fieldErrors.senderPhone
                                  ? 'border-rose-500 bg-rose-50/20 ring-1 ring-rose-500 focus:border-rose-500'
                                  : 'border-slate-200 bg-slate-50/50 focus:border-orange-500'
                              }`}
                            />
                            {fieldErrors.senderPhone && (
                              <p className="mt-1 text-xs text-rose-600 font-medium flex items-center gap-1 animate-in fade-in">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                <span>{fieldErrors.senderPhone}</span>
                              </p>
                            )}
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                              Email{' '}
                              <span className="text-slate-400 font-normal lowercase">
                                {locale === 'en' ? '(optional)' : '(không bắt buộc)'}
                              </span>
                            </label>
                            <input
                              type="email"
                              value={senderEmail}
                              onChange={(e) => {
                                senderTouchedRef.current.email = true;
                                setSenderEmail(e.target.value);
                              }}
                              placeholder="email@example.com"
                              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 focus:outline-none focus:border-orange-500 text-slate-800 bg-slate-50/50 text-sm"
                            />
                          </div>
                        </div>

                        {/* Người nhận */}
                        <div className="space-y-3.5">
                          <div className="flex items-center gap-2.5 pb-1">
                            <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                              <Users className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="font-extrabold text-slate-900 text-sm">
                                {t('receiverTitle')}
                              </div>
                              <div className="text-[11px] text-slate-400">
                                {locale === 'en'
                                  ? 'Receiver collects package at station with ID/phone number'
                                  : t('receiverSubtitle')}
                              </div>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                              {locale === 'en' ? 'Receiver Full Name' : t('receiverFullName')}{' '}
                              <span className="text-rose-500">*</span>
                            </label>
                            <input
                              id="input-receiver-name"
                              type="text"
                              value={receiverName}
                              onChange={(e) => {
                                setReceiverName(e.target.value);
                                clearFieldError('receiverName');
                              }}
                              placeholder={locale === 'en' ? 'e.g. Jane Doe' : 'Ví dụ: Lê Thị B'}
                              className={`w-full h-11 px-3.5 rounded-xl border text-slate-800 text-sm focus:outline-none transition-colors ${
                                fieldErrors.receiverName
                                  ? 'border-rose-500 bg-rose-50/20 ring-1 ring-rose-500 focus:border-rose-500'
                                  : 'border-slate-200 bg-slate-50/50 focus:border-blue-500'
                              }`}
                            />
                            {fieldErrors.receiverName && (
                              <p className="mt-1 text-xs text-rose-600 font-medium flex items-center gap-1 animate-in fade-in">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                <span>{fieldErrors.receiverName}</span>
                              </p>
                            )}
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                              {locale === 'en' ? 'Receiver Phone Number' : t('receiverPhone')}{' '}
                              <span className="text-rose-500">*</span>
                            </label>
                            <input
                              id="input-receiver-phone"
                              type="tel"
                              inputMode="numeric"
                              value={receiverPhone}
                              onChange={(e) => {
                                setReceiverPhone(
                                  e.target.value
                                    .replace(/\D/g, '')
                                    .slice(0, 11),
                                );
                                clearFieldError('receiverPhone');
                              }}
                              placeholder={t('phonePlaceholder')}
                              className={`w-full h-11 px-3.5 rounded-xl border text-slate-800 text-sm focus:outline-none transition-colors ${
                                fieldErrors.receiverPhone
                                  ? 'border-rose-500 bg-rose-50/20 ring-1 ring-rose-500 focus:border-rose-500'
                                  : 'border-slate-200 bg-slate-50/50 focus:border-blue-500'
                              }`}
                            />
                            {fieldErrors.receiverPhone && (
                              <p className="mt-1 text-xs text-rose-600 font-medium flex items-center gap-1 animate-in fade-in">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                <span>{fieldErrors.receiverPhone}</span>
                              </p>
                            )}
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                              {locale === 'en' ? 'Receiver Citizen ID / Passport' : t('receiverCccdLabel')}{' '}
                              <span className="text-slate-400 font-normal lowercase">
                                {locale === 'en' ? '(for verification on collection)' : '(đối chiếu khi nhận)'}
                              </span>
                            </label>
                            <input
                              id="input-receiver-cccd"
                              type="text"
                              inputMode="numeric"
                              value={receiverCccd}
                              onChange={(e) => {
                                setReceiverCccd(
                                  e.target.value
                                    .replace(/\D/g, '')
                                    .slice(0, 12),
                                );
                                clearFieldError('receiverCccd');
                              }}
                              placeholder={locale === 'en' ? 'e.g. 079xxxxxxxxx' : 'Ví dụ: 079xxxxxxxxx'}
                              className={`w-full h-11 px-3.5 rounded-xl border text-slate-800 text-sm font-mono focus:outline-none transition-colors ${
                                fieldErrors.receiverCccd
                                  ? 'border-rose-500 bg-rose-50/20 ring-1 ring-rose-500 focus:border-rose-500'
                                  : 'border-slate-200 bg-slate-50/50 focus:border-blue-500'
                              }`}
                            />
                            {fieldErrors.receiverCccd && (
                              <p className="mt-1 text-xs text-rose-600 font-medium flex items-center gap-1 animate-in fade-in">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                <span>{fieldErrors.receiverCccd}</span>
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mt-6 border-t border-slate-100 pt-5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                          <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                            <Building2 className="w-4 h-4 text-orange-600" />
                            <span>{t('officesSectionTitle')}</span>
                          </h3>
                          {selectedTrip && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-orange-50 text-orange-700 border border-orange-200 self-start sm:self-auto">
                              <CheckCircle2 className="w-3 h-3 text-orange-600" />
                              {selectedTrip.busCompany.name}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {selectedTrip
                            ? (locale === 'en'
                                ? `Pick-up and drop-off stations of ${selectedTrip.busCompany.name}`
                                : `Danh sách bưu cục và văn phòng tiếp nhận của nhà xe ${selectedTrip.busCompany.name}`)
                            : t('officesSectionDesc')}
                        </p>
                        {routePointsLoading ? (
                          <p
                            role="status"
                            className="mt-3 text-sm text-slate-500"
                          >
                            {t('loadingOfficesNotice')}
                          </p>
                        ) : routePointsError ? (
                          <p
                            role="alert"
                            className="mt-3 text-sm font-semibold text-rose-700"
                          >
                            {routePointsError}
                            <button
                              type="button"
                              className="ml-2 underline"
                              onClick={() =>
                                setPointsRetry((value) => value + 1)
                              }
                            >
                              {t('retryOffices')}
                            </button>
                          </p>
                        ) : (
                          <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                            <label className="block">
                              <span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">
                                {t('departureStationLabel')}{' '}
                                <span className="text-rose-500">*</span>
                              </span>
                              <select
                                id="select-sender-point"
                                value={senderPointId ?? ''}
                                onChange={(event) => {
                                  const nextId =
                                    Number(event.target.value) || null;
                                  setSenderPointId(nextId);
                                  clearFieldError('senderPointId');
                                  if (nextId === receiverPointId) {
                                    setReceiverPointId(null);
                                  }
                                }}
                                disabled={!selectedTripId || !routePoints?.senderPoints.length}
                                className={`h-11 w-full rounded-xl border bg-white px-3 text-sm font-semibold text-slate-800 focus:outline-none disabled:bg-slate-50 transition-colors ${
                                  fieldErrors.senderPointId
                                    ? 'border-rose-500 bg-rose-50/20 ring-1 ring-rose-500 focus:border-rose-500'
                                    : 'border-slate-200 focus:border-orange-500'
                                }`}
                              >
                                <option value="">
                                  {selectedTrip
                                    ? (locale === 'en'
                                        ? `Select departure station (${selectedTrip.busCompany.name})`
                                        : `Chọn bưu cục / điểm gửi (${selectedTrip.busCompany.name})`)
                                    : t('selectOperatorFirstNotice')}
                                </option>
                                {routePoints?.senderPoints.map((point) => (
                                  <option key={point.id} value={point.id}>
                                    {point.name} — {point.address}
                                  </option>
                                ))}
                              </select>
                              {fieldErrors.senderPointId && (
                                <p className="mt-1 text-xs text-rose-600 font-medium flex items-center gap-1 animate-in fade-in">
                                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                  <span>{fieldErrors.senderPointId}</span>
                                </p>
                              )}
                              {!fieldErrors.senderPointId &&
                                (!selectedTripId ? (
                                  <span className="mt-1 block text-xs text-amber-700">
                                    {t('selectOperatorFirstNotice')}
                                  </span>
                                ) : !routePoints?.senderPoints.length ? (
                                  <span className="mt-1 block text-xs text-amber-700">
                                    {t('noActivePickupPoints')}
                                  </span>
                                ) : null)}
                            </label>
                            <label className="block">
                              <span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">
                                {t('destinationStationLabel')}{' '}
                                <span className="text-rose-500">*</span>
                              </span>
                              <select
                                id="select-receiver-point"
                                value={receiverPointId ?? ''}
                                onChange={(event) => {
                                  setReceiverPointId(
                                    Number(event.target.value) || null,
                                  );
                                  clearFieldError('receiverPointId');
                                }}
                                disabled={!selectedTripId || !routePoints?.receiverPoints.length}
                                className={`h-11 w-full rounded-xl border bg-white px-3 text-sm font-semibold text-slate-800 focus:outline-none disabled:bg-slate-50 transition-colors ${
                                  fieldErrors.receiverPointId
                                    ? 'border-rose-500 bg-rose-50/20 ring-1 ring-rose-500 focus:border-rose-500'
                                    : 'border-slate-200 focus:border-orange-500'
                                }`}
                              >
                                <option value="">
                                  {selectedTrip
                                    ? (locale === 'en'
                                        ? `Select destination station (${selectedTrip.busCompany.name})`
                                        : `Chọn bưu cục / điểm nhận (${selectedTrip.busCompany.name})`)
                                    : t('selectOperatorFirstNotice')}
                                </option>
                                {routePoints?.receiverPoints.map((point) => (
                                  <option
                                    key={point.id}
                                    value={point.id}
                                    disabled={point.id === senderPointId}
                                  >
                                    {point.name} — {point.address}
                                  </option>
                                ))}
                              </select>
                              {fieldErrors.receiverPointId && (
                                <p className="mt-1 text-xs text-rose-600 font-medium flex items-center gap-1 animate-in fade-in">
                                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                  <span>{fieldErrors.receiverPointId}</span>
                                </p>
                              )}
                              {!fieldErrors.receiverPointId &&
                                (!selectedTripId ? (
                                  <span className="mt-1 block text-xs text-amber-700">
                                    {t('selectOperatorFirstNotice')}
                                  </span>
                                ) : !routePoints?.receiverPoints.length ? (
                                  <span className="mt-1 block text-xs text-amber-700">
                                    {t('noActiveDropoffPoints')}
                                  </span>
                                ) : null)}
                            </label>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* STEP 3: THÔNG TIN KIỆN HÀNG */}
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                      <div className="flex items-center gap-2.5 mb-1">
                        <div className="w-6 h-6 rounded-full bg-[#EF4444] text-white flex items-center justify-center text-xs font-bold">
                          3
                        </div>
                        <h2 className="text-base font-extrabold text-slate-900">
                          {t('stepCargo')}{' '}
                          {cargoItems.length > 1
                            ? `(${t('packagesCount', { count: cargoItems.length })})`
                            : ''}
                        </h2>
                      </div>
                      <p className="text-xs text-slate-400 mb-5 pl-8.5">
                        {t('stepCargoDesc')}
                      </p>

                      <div className="space-y-4">
                        {cargoItems.map((item, index) => {
                          const isMulti = cargoItems.length > 1;
                          return (
                            <div
                              key={item.id}
                              className={`p-4 border rounded-xl relative space-y-4 ${
                                isMulti
                                  ? 'border-orange-200/80 bg-orange-50/20 shadow-2xs'
                                  : 'border-slate-200 bg-slate-50'
                              }`}
                            >
                              {isMulti && (
                                <div className="flex items-center justify-between border-b border-orange-200/60 pb-2.5 mb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-white border border-orange-200 text-xs font-extrabold text-[#FF7D42] shadow-2xs">
                                      <Package className="w-3.5 h-3.5" />
                                      Kiện #{index + 1}
                                    </span>
                                    {item.name.trim() && (
                                      <span className="text-xs font-semibold text-slate-700 truncate max-w-[220px]">
                                        {item.name}
                                      </span>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleRemoveCargoItem(item.id)
                                    }
                                    className="text-xs text-rose-500 hover:text-rose-700 font-bold flex items-center gap-1 px-2 py-1 rounded hover:bg-rose-50 cursor-pointer transition-colors"
                                    title="Xóa kiện này"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" /> {t('removeCargoItem')}
                                  </button>
                                </div>
                              )}

                              {/* Tên hàng hóa */}
                              <label className="block">
                                <span className="text-xs font-bold text-slate-700">
                                  Tên hàng hóa{' '}
                                  {isMulti ? `(Kiện #${index + 1})` : ''}{' '}
                                  <span className="text-rose-500">*</span>
                                </span>
                                <input
                                  id={`input-item-name-${item.id}`}
                                  type="text"
                                  value={item.name}
                                  onChange={(e) => {
                                    handleUpdateCargoItem(
                                      item.id,
                                      'name',
                                      e.target.value,
                                    );
                                    clearFieldError(`itemName_${item.id}`);
                                  }}
                                  placeholder={
                                    index === 0
                                      ? 'Ví dụ: Thùng hoa quả, tài liệu, quần áo...'
                                      : `Ví dụ: Kiện hàng số ${index + 1}...`
                                  }
                                  className={`mt-1 h-10 w-full rounded-lg border px-3 text-sm font-semibold outline-none bg-white text-slate-800 transition-colors ${
                                    fieldErrors[`itemName_${item.id}`]
                                      ? 'border-rose-500 ring-1 ring-rose-500 bg-rose-50/20 focus:border-rose-500'
                                      : 'border-slate-300 focus:border-accent'
                                  }`}
                                />
                                {fieldErrors[`itemName_${item.id}`] && (
                                  <p className="mt-1 text-xs text-rose-600 font-medium flex items-center gap-1 animate-in fade-in">
                                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                    <span>
                                      {fieldErrors[`itemName_${item.id}`]}
                                    </span>
                                  </p>
                                )}
                              </label>

                              {/* Lưới: Danh mục (50%), Số lượng (25%), Khối lượng (25%) */}
                              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                {/* Danh mục loại hàng hóa */}
                                <label className="block md:col-span-6">
                                  <span className="text-xs font-bold text-slate-700">
                                    Danh mục hàng hóa{' '}
                                    <span className="text-rose-500">*</span>
                                  </span>
                                  {cargoCategoriesLoading ? (
                                    <p
                                      role="status"
                                      className="mt-2 text-xs text-slate-500"
                                    >
                                      Đang tải danh mục loại hàng...
                                    </p>
                                  ) : cargoCategoriesError ? (
                                    <p
                                      role="alert"
                                      className="mt-2 text-xs font-semibold text-rose-700"
                                    >
                                      {cargoCategoriesError}
                                    </p>
                                  ) : (
                                    <div className="mt-1">
                                      <div className="relative">
                                        <select
                                          id={`select-item-category-${item.id}`}
                                          aria-label={
                                            index === 0
                                              ? 'Loại hàng hóa'
                                              : `Loại hàng hóa kiện #${index + 1}`
                                          }
                                          value={item.categoryId ?? ''}
                                          onChange={(e) => {
                                            const val = e.target.value
                                              ? Number(e.target.value)
                                              : undefined;
                                            handleUpdateCargoItem(
                                              item.id,
                                              'categoryId',
                                              val,
                                            );
                                            clearFieldError(
                                              `itemCategory_${item.id}`,
                                            );
                                          }}
                                          className={`h-10 w-full appearance-none rounded-lg border bg-white px-3 pr-9 text-sm font-semibold text-slate-800 outline-none cursor-pointer transition-colors ${
                                            fieldErrors[
                                              `itemCategory_${item.id}`
                                            ]
                                              ? 'border-rose-500 ring-1 ring-rose-500 bg-rose-50/20 focus:border-rose-500'
                                              : 'border-slate-300 focus:border-accent'
                                          }`}
                                        >
                                          <option value="">
                                            -- Chọn danh mục --
                                          </option>
                                          {availableCargoCategories.map(
                                            (category) => (
                                              <option
                                                key={category.categoryId}
                                                value={category.categoryId}
                                              >
                                                {formatCategoryName(
                                                  category.name,
                                                )}
                                              </option>
                                            ),
                                          )}
                                        </select>
                                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                      </div>
                                      {fieldErrors[
                                        `itemCategory_${item.id}`
                                      ] && (
                                        <p className="mt-1 text-xs text-rose-600 font-medium flex items-center gap-1 animate-in fade-in">
                                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                          <span>
                                            {
                                              fieldErrors[
                                                `itemCategory_${item.id}`
                                              ]
                                            }
                                          </span>
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </label>

                                {/* Số lượng */}
                                <label className="block md:col-span-3">
                                  <span className="text-xs font-bold text-slate-700">
                                    Số lượng kiện
                                  </span>
                                  <input
                                    type="number"
                                    min="1"
                                    className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-semibold outline-none focus:border-accent bg-white text-slate-800"
                                    value={item.quantity}
                                    onChange={(e) =>
                                      handleUpdateCargoItem(
                                        item.id,
                                        'quantity',
                                        Math.max(
                                          1,
                                          parseInt(e.target.value, 10) || 1,
                                        ),
                                      )
                                    }
                                  />
                                </label>

                                {/* Khối lượng ước tính (kg) */}
                                <label className="block md:col-span-3">
                                  <span className="text-xs font-bold text-slate-700">
                                    Khối lượng (kg){' '}
                                    <span className="text-rose-500">*</span>
                                  </span>
                                  <input
                                    id={`input-item-weight-${item.id}`}
                                    type="number"
                                    min="0"
                                    className={`mt-1 h-10 w-full rounded-lg border px-3 text-sm font-semibold outline-none bg-white text-slate-800 transition-colors ${
                                      fieldErrors[`itemWeight_${item.id}`]
                                        ? 'border-rose-500 ring-1 ring-rose-500 bg-rose-50/20 focus:border-rose-500'
                                        : 'border-slate-300 focus:border-accent'
                                    }`}
                                    value={item.weight || ''}
                                    onChange={(e) => {
                                      handleUpdateCargoItem(
                                        item.id,
                                        'weight',
                                        Math.max(
                                          0,
                                          parseFloat(e.target.value) || 0,
                                        ),
                                      );
                                      clearFieldError(`itemWeight_${item.id}`);
                                    }}
                                    placeholder="Ví dụ: 15"
                                  />
                                  {fieldErrors[`itemWeight_${item.id}`] && (
                                    <p className="mt-1 text-xs text-rose-600 font-medium flex items-center gap-1 animate-in fade-in">
                                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                      <span>
                                        {fieldErrors[`itemWeight_${item.id}`]}
                                      </span>
                                    </p>
                                  )}
                                </label>
                              </div>

                              {/* Kích thước kiện hàng (cm) */}
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-bold text-slate-700">
                                    Kích thước (cm){' '}
                                    <span className="font-normal text-slate-400">
                                      (Không bắt buộc – nhập nếu hàng cồng kềnh)
                                    </span>
                                  </span>
                                  {Number(item.length) > 0 &&
                                  Number(item.width) > 0 &&
                                  Number(item.height) > 0 ? (
                                    <span className="text-[11px] font-semibold text-[#0060c4]">
                                      Quy đổi:{' '}
                                      {Number(
                                        (
                                          (Number(item.length) *
                                            Number(item.width) *
                                            Number(item.height)) /
                                          5000
                                        ).toFixed(2),
                                      )}{' '}
                                      kg
                                    </span>
                                  ) : null}
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                  <input
                                    id={`input-item-length-${item.id}`}
                                    type="number"
                                    min="1"
                                    placeholder="Dài (cm)"
                                    className={`h-10 w-full rounded-lg border px-3 text-sm font-semibold outline-none bg-white text-slate-800 transition-colors ${
                                      fieldErrors[`itemDimensions_${item.id}`]
                                        ? 'border-rose-500 ring-1 ring-rose-500 bg-rose-50/20 focus:border-rose-500'
                                        : 'border-slate-300 focus:border-accent'
                                    }`}
                                    value={item.length}
                                    onChange={(e) => {
                                      handleUpdateCargoItem(
                                        item.id,
                                        'length',
                                        e.target.value,
                                      );
                                      clearFieldError(
                                        `itemDimensions_${item.id}`,
                                      );
                                    }}
                                  />
                                  <input
                                    id={`input-item-width-${item.id}`}
                                    type="number"
                                    min="1"
                                    placeholder="Rộng (cm)"
                                    className={`h-10 w-full rounded-lg border px-3 text-sm font-semibold outline-none bg-white text-slate-800 transition-colors ${
                                      fieldErrors[`itemDimensions_${item.id}`]
                                        ? 'border-rose-500 ring-1 ring-rose-500 bg-rose-50/20 focus:border-rose-500'
                                        : 'border-slate-300 focus:border-accent'
                                    }`}
                                    value={item.width}
                                    onChange={(e) => {
                                      handleUpdateCargoItem(
                                        item.id,
                                        'width',
                                        e.target.value,
                                      );
                                      clearFieldError(
                                        `itemDimensions_${item.id}`,
                                      );
                                    }}
                                  />
                                  <input
                                    id={`input-item-height-${item.id}`}
                                    type="number"
                                    min="1"
                                    placeholder="Cao (cm)"
                                    className={`h-10 w-full rounded-lg border px-3 text-sm font-semibold outline-none bg-white text-slate-800 transition-colors ${
                                      fieldErrors[`itemDimensions_${item.id}`]
                                        ? 'border-rose-500 ring-1 ring-rose-500 bg-rose-50/20 focus:border-rose-500'
                                        : 'border-slate-300 focus:border-accent'
                                    }`}
                                    value={item.height}
                                    onChange={(e) => {
                                      handleUpdateCargoItem(
                                        item.id,
                                        'height',
                                        e.target.value,
                                      );
                                      clearFieldError(
                                        `itemDimensions_${item.id}`,
                                      );
                                    }}
                                  />
                                </div>
                                {fieldErrors[`itemDimensions_${item.id}`] ? (
                                  <p className="mt-1.5 text-[11px] text-rose-600 font-semibold flex items-center gap-1 animate-in fade-in">
                                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                    <span>
                                      {fieldErrors[`itemDimensions_${item.id}`]}
                                    </span>
                                  </p>
                                ) : (item.length.trim() ||
                                    item.width.trim() ||
                                    item.height.trim()) &&
                                  !(
                                    Number(item.length) > 0 &&
                                    Number(item.width) > 0 &&
                                    Number(item.height) > 0
                                  ) ? (
                                  <p className="mt-1.5 text-[11px] text-amber-600 font-semibold">
                                    Vui lòng nhập đủ cả 3 chiều Dài, Rộng, Cao
                                    để tính khối lượng quy đổi (hoặc để trống cả
                                    3 ô).
                                  </p>
                                ) : null}
                              </div>

                              {/* Dịch vụ bảo quản & Ghi chú riêng từng kiện */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <label className="block">
                                  <span className="text-xs font-bold text-slate-700">
                                    Dịch vụ bảo quản
                                  </span>
                                  <div className="relative mt-1">
                                    <select
                                      id={`select-item-service-type-${item.id}`}
                                      aria-label={
                                        index === 0
                                          ? 'Dịch vụ bảo quản'
                                          : `Dịch vụ bảo quản kiện #${index + 1}`
                                      }
                                      className="h-10 w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 pr-9 text-sm font-semibold text-slate-800 outline-none focus:border-accent cursor-pointer"
                                      value={item.serviceType}
                                      onChange={(e) =>
                                        handleUpdateCargoItem(
                                          item.id,
                                          'serviceType',
                                          e.target.value as
                                            'normal' | 'fragile' | 'valuable',
                                        )
                                      }
                                    >
                                      <option value="normal">
                                        Hàng thường
                                      </option>
                                      <option value="fragile">
                                        Dễ vỡ (+{fragileSurcharge.toLocaleString('vi-VN')}đ phụ phí)
                                      </option>
                                      <option value="valuable">
                                        Giá trị cao (+{valuableSurcharge.toLocaleString('vi-VN')}đ phụ phí)
                                      </option>
                                    </select>
                                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                  </div>
                                  {item.serviceType === 'normal' && (
                                    <p className="mt-1 text-[11px] text-slate-500">
                                      Xếp khoang hành lý tiêu chuẩn, không phụ
                                      phí.
                                    </p>
                                  )}
                                  {item.serviceType === 'fragile' && (
                                    <p className="mt-1 text-[11px] text-amber-600 font-medium">
                                      Dán tem hàng dễ vỡ, xếp riêng chống va đập
                                      (+{fragileSurcharge.toLocaleString('vi-VN')}đ).
                                    </p>
                                  )}
                                  {item.serviceType === 'valuable' && (
                                    <p className="mt-1 text-[11px] text-emerald-600 font-medium">
                                      Niêm phong riêng, ưu tiên kiểm soát & bảo
                                      hiểm (+{valuableSurcharge.toLocaleString('vi-VN')}đ).
                                    </p>
                                  )}
                                </label>

                                <label className="block">
                                  <span className="text-xs font-bold text-slate-700">
                                    Lưu ý riêng kiện này
                                  </span>
                                  <input
                                    type="text"
                                    aria-label={
                                      index === 0
                                        ? 'Lưu ý kiện'
                                        : `Lưu ý kiện #${index + 1}`
                                    }
                                    className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-semibold outline-none focus:border-accent bg-white text-slate-800"
                                    value={item.note}
                                    onChange={(e) =>
                                      handleUpdateCargoItem(
                                        item.id,
                                        'note',
                                        e.target.value,
                                      )
                                    }
                                    placeholder="Ví dụ: Để đứng, tránh va đập..."
                                  />
                                </label>
                              </div>
                            </div>
                          );
                        })}

                        {calculatedPricing.rateExceededWarning && (
                          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2 text-xs text-amber-800 font-semibold">
                            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <span>{calculatedPricing.rateExceededWarning}</span>
                          </div>
                        )}

                        {/* Nút thêm kiện hàng ở phía dưới danh sách kiện */}
                        <div>
                          <button
                            type="button"
                            onClick={handleAddCargoItem}
                            className="w-full py-2.5 rounded-xl border-2 border-dashed border-orange-300 hover:border-[#FF7D42] bg-orange-50/50 hover:bg-orange-100/70 text-[#FF7D42] font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Plus className="w-4 h-4" /> Thêm kiện hàng
                          </button>
                        </div>

                        {/* Ghi chú chung toàn đơn */}
                        <div className="pt-3 border-t border-slate-100">
                          <label className="block">
                            <span className="text-xs font-bold text-slate-700">
                              Ghi chú vận chuyển & giao nhận{' '}
                              <span className="font-normal text-slate-400">
                                (Chung cho toàn đơn)
                              </span>
                            </span>
                            <input
                              type="text"
                              className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-semibold outline-none focus:border-accent bg-white text-slate-800"
                              value={note}
                              onChange={(e) => setNote(e.target.value)}
                              placeholder="Ví dụ: Gọi người nhận trước khi tới bến 15–30 phút..."
                            />
                          </label>
                        </div>
                      </div>

                      {/* Quy định giao nhận */}
                      <div className="mt-4 bg-amber-50/70 rounded-xl p-4 text-xs text-amber-900 border border-amber-200/50 flex items-start gap-2.5">
                        <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div className="leading-relaxed">
                          <strong>Quy định giao nhận:</strong> Người gửi mang
                          kiện hàng ra bưu cục/văn phòng nhà xe đã chọn trong
                          giờ làm việc để làm thủ tục gửi hàng. Người nhận mang
                          CCCD/SĐT ra bưu cục đích để đối chiếu và nhận hàng.
                          Nhà xe không nhận vận chuyển hàng cấm, vũ khí, chất
                          cháy nổ.
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* CỘT PHẢI: DỰ TÍNH CƯỚC PHÍ & VẬN ĐƠN STICKY */}
                  <div className="lg:col-span-4 sticky top-6 space-y-4">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                      {/* Card Header dark blue */}
                      <div className="bg-[#17223B] p-5 text-white">
                        <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-3">
                          {locale === 'en' ? 'ESTIMATED FREIGHT · WAYBILL' : 'DỰ TÍNH CƯỚC PHÍ · VẬN ĐƠN'}
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-xl font-black">{origin}</div>
                            <div className="text-[11px] text-slate-400">
                              {t('departureLocationText')}
                            </div>
                          </div>

                          <div className="flex items-center px-4 flex-1 max-w-[120px] justify-center">
                            <div className="w-full border-t border-dashed border-slate-500"></div>
                          </div>

                          <div className="text-right">
                            <div className="text-xl font-black">
                              {destination}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {t('destinationLocationText')}
                            </div>
                          </div>
                        </div>

                        {/* Mini selected trip card */}
                        {selectedTrip && (
                          <div className="mt-4 p-2.5 rounded-xl bg-white/10 border border-white/10 flex items-center gap-2.5">
                            <div className="w-6 h-6 rounded-md bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                              {selectedTrip.busCompany.name.charAt(0)}
                            </div>
                            <div className="text-xs min-w-0 flex-1">
                              <div className="font-extrabold truncate">
                                {selectedTrip.busCompany.name}
                              </div>
                              <div className="text-[11px] text-slate-300 flex items-center gap-1.5 flex-wrap">
                                <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                                  <Clock className="w-3 h-3" />
                                  {getCarrierDeliveryEstimate(selectedTrip)}
                                </span>
                                <span>·</span>
                                <span>
                                  {date
                                    ? date.includes('-')
                                      ? date.split('-').reverse().join('/')
                                      : date
                                    : (locale === 'en' ? 'Flexible dispatch (72h limit)' : 'Gửi linh hoạt (Hạn 72h)')}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Card Body pricing details */}
                      <div className="p-5 space-y-3 text-sm">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-500">
                            Cước dự tính ({calculatedPricing.totalWeight} kg
                            {cargoItems.length > 1
                              ? ` • ${cargoItems.reduce((acc, i) => acc + (Number(i.quantity) || 1), 0)} kiện`
                              : ''}
                            )
                          </span>
                          <span className="font-bold text-slate-900">
                            {quote
                              ? `${calculatedPricing.baseFee.toLocaleString('vi-VN')}đ`
                              : 'Chưa báo cước'}
                          </span>
                        </div>

                        {calculatedPricing.serviceFee > 0 && (
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-500">
                              {t('surchargePreservation')}
                            </span>
                            <span className="font-bold text-slate-900">
                              +
                              {calculatedPricing.serviceFee.toLocaleString(
                                'vi-VN',
                              )}
                              đ
                            </span>
                          </div>
                        )}

                        <div className="pt-3 border-t border-slate-100 flex items-baseline justify-between">
                          <span className="text-sm font-extrabold text-slate-900">
                            {t('provisionalFreightFee')}
                          </span>
                          <span className="text-xl font-black text-[#EF4444]">
                            {quote
                              ? calculatedPricing.totalFee.toLocaleString(
                                  'vi-VN',
                                )
                              : '—'}
                            đ
                          </span>
                        </div>
                        <p className="text-xs leading-relaxed text-slate-500">
                          Cước dự tính do nhà xe báo, được xác nhận sau khi cân
                          đo thực tế. Mang hàng đến trong 72 giờ theo giờ mở
                          cửa. Đơn quá hạn chưa tiếp nhận sẽ bị hủy; tiền đã trả
                          không tự hoàn. Liên hệ nhà xe đã chọn qua bưu cục gửi
                          trước khi thanh toán.
                        </p>

                        {(senderPointId ||
                          receiverPointId ||
                          receiverCccd.trim()) && (
                          <div className="pt-2.5 pb-0.5 text-[11px] text-slate-600 space-y-1.5 border-t border-slate-100">
                            {senderPointId && (
                              <div className="flex items-start gap-1">
                                <span className="font-bold text-slate-700 shrink-0">
                                  {t('dropoffStationColon')}
                                </span>
                                <span className="text-slate-600 truncate">
                                  {
                                    routePoints?.senderPoints.find(
                                      (p) => p.id === senderPointId,
                                    )?.name
                                  }
                                </span>
                              </div>
                            )}
                            {receiverPointId && (
                              <div className="flex items-start gap-1">
                                <span className="font-bold text-slate-700 shrink-0">
                                  {t('pickupStationColon')}
                                </span>
                                <span className="text-slate-600 truncate">
                                  {
                                    routePoints?.receiverPoints.find(
                                      (p) => p.id === receiverPointId,
                                    )?.name
                                  }
                                </span>
                              </div>
                            )}
                            {receiverCccd.trim() && (
                              <div className="flex items-center gap-1">
                                <span className="font-bold text-slate-700 shrink-0">
                                  {t('cccdReceiverColon')}
                                </span>
                                <span className="font-mono text-slate-800 font-semibold">
                                  {receiverCccd.trim()}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                        {/* Hình thức thanh toán cước */}
                        <div className="pt-3 border-t border-slate-100 space-y-2">
                          <span className="text-xs font-bold text-slate-800 block">
                            {t('paymentMethodHeading')}
                          </span>
                          <div className="space-y-1.5">
                            <label
                              className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                                paymentOption === 'SENDER_COUNTER'
                                  ? 'border-[#FF7D42] bg-orange-50/70 font-semibold text-slate-900'
                                  : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                              }`}
                            >
                              <input
                                type="radio"
                                name="paymentOption"
                                value="SENDER_COUNTER"
                                checked={paymentOption === 'SENDER_COUNTER'}
                                onChange={() =>
                                  setPaymentOption('SENDER_COUNTER')
                                }
                                className="mt-0.5 text-[#FF7D42] focus:ring-[#FF7D42]"
                              />
                              <div>
                                <span className="font-bold text-slate-900">
                                  {t('senderPaysOption')}
                                </span>
                                <p className="text-[11px] text-slate-500 font-normal mt-0.5">
                                  {t('senderPaysOptionDesc')}
                                </p>
                              </div>
                            </label>

                            <label
                              className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                                paymentOption === 'RECEIVER_COUNTER'
                                  ? 'border-[#FF7D42] bg-orange-50/70 font-semibold text-slate-900'
                                  : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                              }`}
                            >
                              <input
                                type="radio"
                                name="paymentOption"
                                value="RECEIVER_COUNTER"
                                checked={paymentOption === 'RECEIVER_COUNTER'}
                                onChange={() =>
                                  setPaymentOption('RECEIVER_COUNTER')
                                }
                                className="mt-0.5 text-[#FF7D42] focus:ring-[#FF7D42]"
                              />
                              <div>
                                <span className="font-bold text-slate-900">
                                  {t('receiverPaysOption')}
                                </span>
                                <p className="text-[11px] text-slate-500 font-normal mt-0.5">
                                  {t('receiverPaysOptionDesc')}
                                </p>
                              </div>
                            </label>

                            <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/60 text-[11px] text-amber-800 leading-relaxed">
                              <strong>Lưu ý:</strong> Cước phí hiển thị là cước dự kiến theo khối lượng quý khách khai báo. Cước phí chính xác sẽ được nhân viên xác nhận khi cân đo kiện hàng thực tế tại bưu cục.
                            </div>
                          </div>
                        </div>

                        {/* Action button */}
                        <div className="pt-2">
                          <button
                            onClick={handleCreateShipment}
                            disabled={isSubmitting}
                            className="w-full h-12 bg-[#FF7D42] hover:bg-[#F06A2D] text-white font-extrabold rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed text-sm cursor-pointer"
                          >
                            <span>
                              {isSubmitting ? t('creatingWaybill') : t('createWaybillButton')}
                            </span>
                            <ArrowRight className="w-4 h-4" />
                          </button>

                          <p className="text-[11px] text-center text-slate-400 mt-2.5 leading-tight">
                            {t('createWaybillNotice')}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ============================================================== */}
        {/* TAB 2: TRA CỨU VẬN ĐƠN */}
        {/* ============================================================== */}
        {activeTab === 'lookup' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <h2 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
                <Search className="w-5 h-5 text-[#0060c4]" /> {locale === 'en' ? 'Track Shipment Status' : 'Tra cứu trạng thái đơn gửi hàng'}
              </h2>
              <p className="text-xs text-slate-500 mb-6">
                {locale === 'en' ? 'Enter waybill code (e.g. FUTA-VD-...) and sender/receiver phone number to view destination station and shipment status.' : 'Nhập mã vận đơn (VD: FUTA-VD-...) và số điện thoại người gửi hoặc người nhận để xem chi tiết bến nhận và trạng thái đơn hàng.'}
              </p>

              <form onSubmit={handleLookup} className="space-y-4">
                {lookupError && (
                  <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{lookupError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1.5">
                    {t('lookupCodeLabel')} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={lookupCode}
                    onChange={(e) =>
                      setLookupCode(e.target.value.toUpperCase())
                    }
                    placeholder="VD: FUTA-VD-09102026..."
                    className="w-full h-11 px-4 rounded-xl border border-slate-300 focus:outline-none focus:border-[#0060c4] font-semibold text-slate-800 uppercase"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1.5">
                    {t('lookupPhoneLabel')}{' '}
                    <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={lookupPhone}
                    onChange={(e) =>
                      setLookupPhone(
                        e.target.value.replace(/\D/g, '').slice(0, 11),
                      )
                    }
                    placeholder="09xxxxxxxx"
                    className="w-full h-11 px-4 rounded-xl border border-slate-300 focus:outline-none focus:border-[#0060c4] font-semibold text-slate-800"
                  />
                </div>

                <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setShowLookupGuideModal(true)}
                    className="text-sm font-bold text-[#f05123] hover:text-[#ea4a18] hover:underline transition-colors cursor-pointer text-left"
                  >
                    Hướng dẫn tra cứu đơn
                  </button>
                  <button
                    type="submit"
                    disabled={isLookingUp}
                    className="w-full sm:w-auto px-10 h-12 bg-[#f05123] hover:bg-[#ea4a18] active:scale-[0.99] text-white font-bold text-sm sm:text-base rounded-full transition-all shadow-md shadow-[#f05123]/25 disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Search className="w-4 h-4 shrink-0" />
                    <span>{isLookingUp ? t('lookingUp') : t('lookupButton')}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* KẾT QUẢ TRA CỨU */}
            {lookupResult && (() => {
              const currentShipment =
                createdSuccessShipment &&
                createdSuccessShipment.waybillCode === lookupResult.waybillCode
                  ? createdSuccessShipment
                  : null;

              return (
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6 animate-in fade-in duration-300">
                  {/* 1. Header Mã vận đơn & Trạng thái */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
                    <div>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        {locale === 'en' ? 'Parcel Waybill Code' : 'Mã vận đơn bưu kiện'}
                      </span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xl sm:text-2xl font-black font-mono text-[#0060c4]">
                          {lookupResult.waybillCode}
                        </span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(lookupResult.waybillCode)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                          title={locale === 'en' ? 'Copy waybill code' : 'Sao chép mã vận đơn'}
                        >
                          {copiedCode ? (
                            <Check className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                    <div>
                      <span
                        className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-black rounded-full shadow-2xs ${
                          lookupResult.status === 'DA_GIAO'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : lookupResult.status === 'DANG_VAN_CHUYEN'
                              ? 'bg-blue-100 text-blue-800 border border-blue-200'
                              : lookupResult.status === 'DA_TIEP_NHAN'
                                ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                                : lookupResult.status === 'DA_HUY'
                                  ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                  : 'bg-amber-100 text-amber-900 border border-amber-300'
                        }`}
                      >
                        {lookupResult.status === 'MOI_TAO' && (
                          <Clock className="w-3.5 h-3.5 text-amber-700 animate-pulse" />
                        )}
                        {lookupResult.status === 'MOI_TAO'
                          ? t('statusNew')
                          : lookupResult.status === 'DA_TIEP_NHAN'
                            ? t('statusReceived')
                            : lookupResult.status === 'DANG_VAN_CHUYEN'
                              ? t('statusInTransit')
                              : lookupResult.status === 'DA_GIAO'
                                ? t('statusDelivered')
                                : lookupResult.status === 'DA_HUY'
                                  ? t('statusCancelled')
                                  : lookupResult.status}
                      </span>
                    </div>
                  </div>

                  {/* 2. Cảnh báo Hạn chót & Hướng dẫn mang hàng ra bến khi trạng thái MOI_TAO */}
                  {lookupResult.status === 'MOI_TAO' && (
                    <div className="rounded-2xl border border-amber-300 bg-amber-50/80 p-4 sm:p-5 text-xs text-amber-950 space-y-3 shadow-xs">
                      <div className="flex items-center gap-2 font-extrabold text-amber-900 text-sm">
                        <Clock className="w-4 h-4 text-amber-700 shrink-0" />
                        <span>Đơn hàng đang chờ mang ra bến gửi</span>
                      </div>
                      <div className="bg-white/90 rounded-xl p-3 border border-amber-200 space-y-1.5 text-slate-700">
                        <p className="text-amber-900 font-medium">
                          Hạn chót gửi hàng tại quầy:{' '}
                          <strong className="text-amber-950 underline font-black">
                            {lookupResult.dropoffDeadline
                              ? `${formatIsoTime(lookupResult.dropoffDeadline)} ngày ${formatIsoDate(lookupResult.dropoffDeadline)}`
                              : 'Trong vòng 72 giờ kể từ khi tạo đơn'}
                          </strong>
                        </p>
                        <div className="font-bold text-slate-900 mt-2">
                          Quy trình 3 bước gửi hàng tại bến:
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="font-black text-amber-700 shrink-0">1.</span>
                          <span>
                            Mang kiện hàng đến quầy bến xe:{' '}
                            <strong className="text-slate-900">{lookupResult.pickupPoint.name}</strong>{' '}
                            ({lookupResult.pickupPoint.address}).
                          </span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="font-black text-amber-700 shrink-0">2.</span>
                          <span>
                            Đọc mã vận đơn <strong className="font-mono text-[#0060c4]">{lookupResult.waybillCode}</strong> hoặc đưa mã QR bên dưới cho nhân viên bến xe.
                          </span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="font-black text-amber-700 shrink-0">3.</span>
                          <span>
                            Nhân viên cân đo thực tế, dán tem lên kiện hàng và{' '}
                            <strong className="text-slate-900">
                              {lookupResult.freightPayer === 'NGUOI_NHAN'
                                ? 'tiếp nhận (Người nhận sẽ thanh toán tiền mặt khi lấy hàng tại bến đích)'
                                : 'thu tiền cước mặt tại quầy'}
                            </strong>.
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 3. Mã QR Vận Đơn cho nhân viên quét nhanh */}
                  <div className="flex flex-col items-center justify-center p-5 bg-slate-50/80 rounded-2xl border border-slate-200 text-center">
                    <div className="p-3 bg-white rounded-2xl shadow-xs border border-slate-200 mb-2">
                      <QRCodeSVG
                        value={lookupResult.waybillCode}
                        size={144}
                        level="M"
                        role="img"
                        aria-label={`Mã QR vận đơn ${lookupResult.waybillCode}`}
                        className="w-36 h-36"
                      />
                    </div>
                    <span className="text-xs text-slate-700 font-bold mt-1">
                      Mã QR Vận Đơn
                    </span>
                    <span className="text-[11px] text-slate-500 max-w-xs mt-0.5">
                      Đưa mã QR này cho nhân viên nhà xe tại quầy bến để quét tra cứu và tiếp nhận kiện hàng nhanh chóng
                    </span>
                  </div>

                  {/* 4. Khung Thông Tin Cước Phí & Thanh Toán Tại Bến */}
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5 space-y-3.5">
                    <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wide">
                        <Receipt className="w-4 h-4 text-[#0060c4]" />
                        <span>Thông tin cước phí & thanh toán</span>
                      </div>
                      {lookupResult.orderCode && (
                        <span className="text-[11px] font-mono text-slate-500">
                          Mã giao dịch: <strong>{lookupResult.orderCode}</strong>
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-1">
                        <span className="text-slate-500 font-semibold block">
                          Tổng cước vận chuyển:
                        </span>
                        <div className="text-2xl font-black text-rose-600">
                          {Number(lookupResult.amount ?? 0).toLocaleString('vi-VN')} đ
                        </div>
                        {currentShipment && (
                          <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500 space-y-1">
                            <div className="flex justify-between">
                              <span>Cước chính:</span>
                              <span className="font-semibold text-slate-800">
                                {currentShipment.pricing.baseFee.toLocaleString('vi-VN')} đ
                              </span>
                            </div>
                            {currentShipment.pricing.serviceFee > 0 && (
                              <div className="flex justify-between">
                                <span>Phụ phí bảo quản:</span>
                                <span className="font-semibold text-slate-800">
                                  {currentShipment.pricing.serviceFee.toLocaleString('vi-VN')} đ
                                </span>
                              </div>
                            )}
                            {currentShipment.pricing.discount > 0 && (
                              <div className="flex justify-between text-emerald-600">
                                <span>Khuyến mại:</span>
                                <span className="font-semibold">
                                  -{currentShipment.pricing.discount.toLocaleString('vi-VN')} đ
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                        <span className="text-slate-500 font-semibold block">
                          Hình thức thanh toán cước:
                        </span>
                        <div>
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black ${
                              lookupResult.freightPayer === 'NGUOI_NHAN'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-amber-100 text-amber-900'
                            }`}
                          >
                            {lookupResult.freightPayer === 'NGUOI_NHAN'
                              ? 'Người nhận thanh toán khi lấy hàng'
                              : 'Người gửi thanh toán tại bến gửi'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 leading-relaxed">
                          {lookupResult.freightPayer === 'NGUOI_NHAN'
                            ? '• Người nhận sẽ thanh toán tiền mặt tại quầy bến xe khi đến nhận kiện hàng.'
                            : '• Người gửi thanh toán tiền mặt tại quầy giao dịch bến xe khi mang hàng ra gửi.'}
                        </p>
                        <div className="pt-1">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-black ${
                              ['DA_THANH_TOAN', 'THANH_CONG'].includes(
                                lookupResult.paymentStatus ?? '',
                              )
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-50 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {['DA_THANH_TOAN', 'THANH_CONG'].includes(
                              lookupResult.paymentStatus ?? '',
                            )
                              ? 'Đã thanh toán tại bến'
                              : 'Chưa thanh toán (Thanh toán tiền mặt tại quầy bến xe)'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 5. Điểm Gửi & Điểm Nhận */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
                      <span className="font-bold text-slate-500 uppercase block mb-1">
                        Điểm gửi hàng
                      </span>
                      <div className="font-extrabold text-slate-900 text-sm">
                        {lookupResult.pickupPoint.name}
                      </div>
                      <div className="text-slate-600 mt-1 leading-relaxed">
                        {lookupResult.pickupPoint.address}
                      </div>
                      {currentShipment && (
                        <div className="mt-2 pt-2 border-t border-slate-200/80 text-[11px] text-slate-700">
                          <span className="font-bold">{locale === 'en' ? 'Sender: ' : 'Người gửi: '}</span>
                          <span>{currentShipment.sender.fullName} ({currentShipment.sender.phoneNumber})</span>
                        </div>
                      )}
                    </div>

                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
                      <span className="font-bold text-slate-500 uppercase block mb-1">
                        Điểm nhận hàng
                      </span>
                      <div className="font-extrabold text-slate-900 text-sm">
                        {lookupResult.dropoffPoint.name}
                      </div>
                      <div className="text-slate-600 mt-1 leading-relaxed">
                        {lookupResult.dropoffPoint.address}
                      </div>
                      {currentShipment && (
                        <div className="mt-2 pt-2 border-t border-slate-200/80 text-[11px] text-slate-700">
                          <span className="font-bold">{locale === 'en' ? 'Receiver: ' : 'Người nhận: '}</span>
                          <span>{currentShipment.receiver.fullName} ({currentShipment.receiver.phoneNumber})</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 6. Chuyến xe vận chuyển */}
                  <div className="p-3.5 bg-blue-50/50 rounded-xl border border-blue-100 text-xs">
                    <span className="text-slate-500 font-semibold block mb-0.5">
                      {locale === 'en' ? 'Bus Departure Trip:' : 'Chuyến xe vận chuyển:'}
                    </span>
                    <div className="font-extrabold text-slate-900 text-sm">
                      {lookupResult.carrier.name} • {lookupResult.route.origin} → {lookupResult.route.destination}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 mt-1.5 text-slate-600">
                      <div>
                        {locale === 'en' ? 'Departure: ' : 'Khởi hành: '}
                        <strong>
                          {formatIsoTime(lookupResult.scheduledDepartureAt)} ngày{' '}
                          {formatIsoDate(lookupResult.scheduledDepartureAt)}
                        </strong>
                      </div>
                      {lookupResult.estimatedArrivalAt && (
                        <div>
                          {locale === 'en' ? 'Estimated Arrival: ' : 'Dự kiến đến: '}
                          <strong>
                            {formatIsoTime(lookupResult.estimatedArrivalAt)} ngày{' '}
                            {formatIsoDate(lookupResult.estimatedArrivalAt)}
                          </strong>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 7. Chi tiết Kiện hàng */}
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-700 uppercase">
                        Thông tin kiện hàng
                      </span>
                      <span className="font-extrabold text-slate-900">
                        {lookupResult.packageCount} kiện
                      </span>
                    </div>

                    {currentShipment && currentShipment.items.length > 0 && (
                      <div className="divide-y divide-slate-200/80 pt-1">
                        {currentShipment.items.map((item, idx) => (
                          <div key={item.id ?? idx} className="py-2 flex items-center justify-between text-xs">
                            <div>
                              <span className="font-bold text-slate-800">{item.name}</span>{' '}
                              <span className="text-slate-500">({item.category})</span>
                              {item.note && (
                                <span className="block text-[11px] text-slate-400">Ghi chú: {item.note}</span>
                              )}
                            </div>
                            <div className="text-right font-semibold text-slate-700">
                              {item.quantity} kiện · {item.weight} kg
                              {item.dimensions ? ` (${item.dimensions})` : ''}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {lookupResult.bookingPromotionCode && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-bold text-slate-700">
                          Mã khuyến mãi tham chiếu từ đơn vé
                        </span>
                        <strong className="font-mono text-emerald-800">
                          {lookupResult.bookingPromotionCode}
                        </strong>
                      </div>
                      <p className="mt-1 text-slate-600">
                        Mã chỉ giảm tiền vé của đơn đặt chỗ; không giảm cước gửi hàng.
                      </p>
                    </div>
                  )}

                  {/* 8. Timeline lịch sử hành trình */}
                  {lookupResult.timeline && lookupResult.timeline.length > 0 && (
                    <div>
                      <span className="text-xs font-bold text-slate-500 uppercase block mb-2">
                        Lịch sử xử lý:
                      </span>
                      <div className="space-y-2 border-l-2 border-slate-200 ml-2 pl-3">
                        {lookupResult.timeline.map((log) => (
                          <div
                            key={`${log.status}-${log.time}`}
                            className="text-xs"
                          >
                            <span className="font-bold text-slate-800">
                              {log.status === 'MOI_TAO'
                                ? 'Tạo đơn gửi hàng'
                                : log.status === 'DA_TIEP_NHAN'
                                  ? 'Tiếp nhận hàng tại quầy bến xe'
                                  : log.status === 'DANG_VAN_CHUYEN'
                                    ? 'Xe đang lăn bánh chở hàng'
                                    : log.status === 'DA_GIAO'
                                      ? 'Đã trả hàng cho người nhận'
                                      : log.status === 'DA_HUY'
                                        ? 'Đã hủy đơn gửi hàng'
                                        : log.status}
                            </span>
                            <span className="text-slate-400 ml-2">
                              ({formatIsoTime(log.time)} {formatIsoDate(log.time)}
                              )
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 9. Khu vực Hủy đơn gửi hàng / Thông báo hỗ trợ */}
                  {cancelShipmentSuccess && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs sm:text-sm text-emerald-900 flex items-start gap-2.5">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">{cancelShipmentSuccess}</p>
                        <p className="text-xs text-emerald-700 mt-0.5">
                          Mã vận đơn <strong>{lookupResult.waybillCode}</strong> đã chuyển sang trạng thái Đã hủy.
                        </p>
                      </div>
                    </div>
                  )}

                  {lookupResult.status === 'MOI_TAO' && (
                    <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="text-xs text-slate-500">
                        <strong className="text-slate-700">Bạn muốn hủy đơn gửi hàng?</strong>{' '}
                        Có thể hủy trực tuyến miễn phí khi chưa mang hàng ra bến xe.
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setCancelShipmentError(null);
                          setShowCancelModal(true);
                        }}
                        className="px-4 py-2.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs sm:text-sm transition-colors flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Hủy đơn gửi hàng</span>
                      </button>
                    </div>
                  )}

                  {(lookupResult.status === 'DA_TIEP_NHAN' ||
                    lookupResult.status === 'DANG_VAN_CHUYEN') && (
                    <div className="rounded-xl border border-blue-200/80 bg-blue-50/60 p-3.5 text-xs text-slate-700 flex items-start gap-2.5">
                      <Info className="w-4 h-4 text-[#0060c4] shrink-0 mt-0.5" />
                      <div className="leading-relaxed">
                        <strong className="text-slate-900">Hàng hóa đã được tiếp nhận tại bến:</strong>{' '}
                        Đơn hàng không thể hủy trực tuyến sau khi đã bàn giao kiện hàng. Nếu cần hỗ trợ hoặc thay đổi thông tin, quý khách vui lòng liên hệ trực tiếp nhà xe{' '}
                        <strong className="text-[#0060c4]">{lookupResult.carrier.name}</strong> tại điểm gửi{' '}
                        <strong>{lookupResult.pickupPoint.name}</strong>.
                      </div>
                    </div>
                  )}

                  {lookupResult.status === 'DA_HUY' && !cancelShipmentSuccess && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3.5 text-xs text-rose-900 flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <strong>Đơn gửi hàng này đã bị hủy.</strong> Mã vận đơn không còn hiệu lực tiếp nhận tại quầy bến xe. Quý khách có thể tạo đơn gửi hàng mới nếu có nhu cầu.
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* Modal Xác nhận Hủy đơn gửi hàng */}
        {showCancelModal && lookupResult && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2 text-rose-600">
                  <Trash2 className="w-5 h-5" />
                  <h3 className="text-base font-black text-slate-900">
                    {t('cancelWaybillTitle')}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCancelModal(false)}
                  disabled={isCancellingShipment}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="text-xs sm:text-sm text-slate-600 space-y-2">
                <p>
                  Bạn đang yêu cầu hủy mã vận đơn{' '}
                  <strong className="font-mono text-[#0060c4]">
                    {lookupResult.waybillCode}
                  </strong>{' '}
                  ({lookupResult.route.origin} → {lookupResult.route.destination}).
                </p>
                <p className="text-xs text-slate-500">
                  {t('cancelWaybillNotice')}
                </p>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 uppercase">
                  {t('cancelReasonPrompt')}
                </label>
                <div className="space-y-1.5">
                  {[
                    'Đặt nhầm thông tin người gửi/nhận',
                    'Thay đổi kế hoạch gửi hàng',
                    'Muốn đổi nhà xe hoặc điểm gửi khác',
                    'OTHER',
                  ].map((option) => (
                    <label
                      key={option}
                      className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs sm:text-sm cursor-pointer transition-colors ${
                        cancelReason === option
                          ? 'border-rose-400 bg-rose-50/60 font-bold text-slate-900'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <input
                        type="radio"
                        name="cancelShipmentReason"
                        value={option}
                        checked={cancelReason === option}
                        onChange={() => setCancelReason(option)}
                        className="accent-rose-600"
                      />
                      <span>
                        {option === 'OTHER' ? t('cancelReasonOther') : (locale === 'en' ? (option === 'Đặt nhầm thông tin người gửi/nhận' ? 'Entered incorrect sender/receiver info' : option === 'Thay đổi kế hoạch gửi hàng' ? 'Change of shipping plans' : option === 'Muốn đổi nhà xe hoặc điểm gửi khác' ? 'Want to switch operator or station' : option) : option)}
                      </span>
                    </label>
                  ))}
                </div>
                {cancelReason === 'OTHER' && (
                  <input
                    type="text"
                    value={customCancelReason}
                    onChange={(e) => setCustomCancelReason(e.target.value)}
                    placeholder={t('cancelReasonPlaceholder')}
                    maxLength={200}
                    className="w-full mt-2 px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:border-rose-500 focus:outline-none"
                  />
                )}
              </div>

              {cancelShipmentError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{cancelShipmentError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCancelModal(false)}
                  disabled={isCancellingShipment}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs sm:text-sm transition-colors cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCancelShipment}
                  disabled={isCancellingShipment}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs sm:text-sm transition-colors cursor-pointer"
                >
                  {isCancellingShipment ? 'Đang hủy đơn...' : 'Xác nhận hủy đơn'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Hướng dẫn gửi hàng đồng bộ */}
        <ShipmentGuideModal
          isOpen={showGuideModal}
          onClose={() => setShowGuideModal(false)}
        />

        {/* Modal Hướng dẫn tra cứu vận đơn */}
        {showLookupGuideModal && (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
            onClick={() => setShowLookupGuideModal(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="shipment-lookup-guide-title"
          >
            <div
              className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-orange-50/70 via-white to-amber-50/50">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f05123] text-white shadow-xs">
                    <Package className="h-5 w-5" />
                  </div>
                  <div>
                    <h2
                      id="shipment-lookup-guide-title"
                      className="text-base sm:text-lg font-black text-slate-900 tracking-tight"
                    >
                      Hướng dẫn tra cứu đơn gửi hàng
                    </h2>
                    <p className="text-xs text-slate-500 font-medium">
                      4 bước theo dõi hành trình bưu kiện và trạng thái giao nhận trên VexGo
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLookupGuideModal(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors cursor-pointer"
                  aria-label="Đóng"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Content */}
              <div className="overflow-y-auto p-5 sm:p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {[
                    {
                      step: '1',
                      icon: Receipt,
                      title: locale === 'en' ? 'Prepare Waybill Code & Phone' : 'Chuẩn bị Mã vận đơn & SĐT',
                      desc: locale === 'en' ? 'Have your Waybill code (e.g. FUTA-VD-... issued upon order creation) and sender/receiver phone number ready.' : 'Lấy Mã vận đơn (VD: FUTA-VD-... được cấp khi tạo đơn gửi hàng) và Số điện thoại người gửi hoặc người nhận.',
                      tag: locale === 'en' ? 'Verification' : 'Thông tin xác thực',
                      bg: 'bg-blue-50 text-blue-600 border-blue-200',
                    },
                    {
                      step: '2',
                      icon: Search,
                      title: locale === 'en' ? 'Enter Lookup Details' : 'Nhập thông tin tra cứu',
                      desc: locale === 'en' ? 'Enter accurate Waybill code and sender or receiver phone number in the form, then click "Track Waybill".' : 'Điền chính xác Mã vận đơn và Số điện thoại người gửi hoặc người nhận vào biểu mẫu, sau đó nhấn "Tra cứu vận đơn".',
                      tag: locale === 'en' ? 'Instant Lookup' : 'Tra cứu tức thì',
                      bg: 'bg-emerald-50 text-emerald-600 border-emerald-200',
                    },
                    {
                      step: '3',
                      icon: MapPin,
                      title: locale === 'en' ? 'Track Journey & Destination' : 'Theo dõi lộ trình & Bến nhận',
                      desc: locale === 'en' ? 'View package handling status (Created, Received, In Transit, Arrived, Delivered), bus trip details and freight fee.' : 'Xem trạng thái xử lý kiện hàng (Mới tạo, Đã nhận hàng, Đang vận chuyển, Đã đến bến nhận, Đã giao hàng), thông tin chuyến xe và cước phí.',
                      tag: locale === 'en' ? 'Real-time' : 'Cập nhật thời gian thực',
                      bg: 'bg-amber-50 text-amber-700 border-amber-200',
                    },
                    {
                      step: '4',
                      icon: RotateCcw,
                      title: locale === 'en' ? 'Manage & Cancel Online' : 'Quản lý & Hủy đơn trực tuyến',
                      desc: locale === 'en' ? 'When the shipment is in Created status (before physical handover at station), you can cancel the order directly on screen.' : 'Khi đơn gửi hàng đang ở trạng thái Mới tạo (chưa bàn giao kiện hàng tại quầy nhà xe), bạn có thể hủy đơn trực tiếp trên màn hình tra cứu.',
                      tag: locale === 'en' ? 'Online Utility' : 'Tiện ích trực tuyến',
                      bg: 'bg-rose-50 text-rose-600 border-rose-200',
                    },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.step}
                        className="rounded-xl border border-slate-200/90 bg-slate-50/60 p-4 transition-all hover:bg-white hover:border-[#f05123]/40 hover:shadow-xs flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2.5">
                            <div className="flex items-center gap-2">
                              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#f05123] text-white text-xs font-black shadow-2xs">
                                {item.step}
                              </span>
                              <h3 className="font-extrabold text-slate-900 text-sm">
                                {item.title}
                              </h3>
                            </div>
                            <div className={`p-1.5 rounded-lg ${item.bg} shrink-0`}>
                              <Icon className="h-4 w-4" />
                            </div>
                          </div>
                          <p className="text-xs leading-relaxed text-slate-600 font-medium">
                            {item.desc}
                          </p>
                        </div>
                        <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                            {item.tag}
                          </span>
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                            {locale === 'en' ? '✓ Online' : '✓ Trực tuyến'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="rounded-xl border border-blue-200/80 bg-blue-50/50 p-4">
                  <h4 className="text-xs font-black text-[#0060c4] uppercase tracking-wide flex items-center gap-1.5 mb-2">
                    <ShieldCheck className="w-4 h-4 text-[#0060c4]" />
                    {locale === 'en' ? 'Notes on dropping off and picking up parcels' : 'Lưu ý khi gửi & nhận hàng tại nhà xe'}
                  </h4>
                  <ul className="text-xs text-slate-700 space-y-1.5 font-medium">
                    <li className="flex items-start gap-1.5">
                      <span className="text-[#f05123] font-bold">•</span>
                      <span>
                        {locale === 'en' ? <>Both <strong>sender</strong> and <strong>receiver</strong> can use their phone number with the Waybill code to track package status.</> : <>Cả <strong>người gửi</strong> và <strong>người nhận</strong> đều có thể dùng số điện thoại của mình kèm Mã vận đơn để tra cứu trạng thái kiện hàng.</>}
                      </span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-[#f05123] font-bold">•</span>
                      <span>
                        {locale === 'en' ? <>After creating a waybill online, please drop off the package at the selected station within <strong>72 hours</strong> for staff confirmation.</> : <>Sau khi tạo mã vận đơn trực tuyến, quý khách vui lòng mang hàng ra bưu cục/bến xe đã chọn trong vòng <strong>72 giờ</strong> để nhân viên xác nhận.</>}
                      </span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-[#f05123] font-bold">•</span>
                      <span>
                        {locale === 'en' ? <>When the parcel reaches <strong>Arrived at Destination</strong>, the receiver should bring their ID card (CCCD) and state the waybill code to collect.</> : <>Khi kiện hàng chuyển sang trạng thái <strong>Đã đến bến nhận</strong>, người nhận vui lòng mang theo giấy tờ tùy thân (CCCD) và đọc mã vận đơn để nhận hàng.</>}
                      </span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                  <Phone className="w-4 h-4 text-[#f05123]" />
                  <span>
                    {locale === 'en' ? '24/7 Customer Care Hotline:' : 'Tổng đài CSKH 24/7:'} <strong className="text-slate-900">1900 6067</strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLookupGuideModal(false)}
                  className="px-5 py-2 rounded-xl bg-[#f05123] hover:bg-[#d8441a] text-white font-extrabold text-xs transition-all shadow-xs cursor-pointer active:scale-95"
                >
                  Đã hiểu
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Thông Báo Thiếu Thông Tin */}
        {missingFieldsModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto bg-black/60 p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
              <button
                type="button"
                onClick={() => setMissingFieldsModal(false)}
                className="absolute right-4 top-4 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2.5 text-amber-600 mb-3">
                <AlertCircle className="w-6 h-6" />
                <h3 className="text-base font-black text-slate-900">
                  {t('incompleteInfoTitle')}
                </h3>
              </div>
              <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                {t('incompleteInfoNoticeText')}
              </p>
              {Object.values(fieldErrors).length > 0 && (
                <div className="mb-5 max-h-44 overflow-y-auto space-y-1.5 bg-amber-50/70 p-3 rounded-xl border border-amber-200/80 text-xs text-amber-900">
                  {Object.values(fieldErrors).map((err, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-amber-500 font-bold shrink-0">
                        •
                      </span>
                      <span className="font-medium">{err}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setMissingFieldsModal(false)}
                  className="w-full py-2.5 rounded-xl bg-brand text-white font-bold text-sm hover:bg-brand/90 transition-colors cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Thành Công Tạo Vận Đơn Thu Cước Tại Bến */}
        {createdSuccessShipment && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto bg-black/60 p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
              <button
                type="button"
                onClick={() => setCreatedSuccessShipment(null)}
                className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer transition-colors"
                aria-label="Đóng"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="text-center pt-1 pb-4">
                <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3 border border-emerald-100">
                  <CheckCircle className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-black text-slate-900">
                  {t('waybillCreatedHeading')}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  {t('waybillCreatedNotice')}
                </p>
              </div>

              {/* Waybill Code Card */}
              <div className="p-4 rounded-xl bg-orange-50/70 border border-orange-200 text-center mb-4">
                <div className="text-[11px] font-bold uppercase tracking-wider text-orange-700">
                  {t('yourWaybillCode')}
                </div>
                <div className="text-2xl font-mono font-black text-[#F06A2D] my-1 tracking-wide break-all">
                  {createdSuccessShipment.waybillCode}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      createdSuccessShipment.waybillCode,
                    );
                    setCopiedCode(true);
                    setTimeout(() => setCopiedCode(false), 2000);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-orange-300 rounded-lg text-xs font-bold text-orange-700 hover:bg-orange-100/50 transition-colors cursor-pointer mt-1"
                >
                  {copiedCode ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{t('copied')}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>{t('copyCode')}</span>
                    </>
                  )}
                </button>
              </div>

              {/* QR Code Container */}
              <div className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-xl border border-slate-200 mb-4 text-center">
                <div className="p-2 bg-white rounded-xl shadow-xs border border-slate-200 mb-2">
                  <QRCodeSVG
                    value={createdSuccessShipment.waybillCode}
                    size={144}
                    level="M"
                    role="img"
                    aria-label={`Mã QR vận đơn ${createdSuccessShipment.waybillCode}`}
                    className="w-36 h-36"
                  />
                </div>
                <span className="text-[11px] text-slate-500 font-medium">
                  {t('qrScanStationNotice')}
                </span>
              </div>

              {/* Chi tiết đơn */}
              <div className="space-y-2 text-xs text-slate-600 border-t border-slate-100 pt-3 mb-5">
                <div className="flex justify-between items-baseline py-1 border-b border-dashed border-slate-100">
                  <span className="text-slate-500">{t('provisionalFeeLabel')}</span>
                  <span className="font-extrabold text-base text-[#EF4444]">
                    {createdSuccessShipment.pricing.totalFee.toLocaleString(
                      'vi-VN',
                    )}{' '}
                    đ
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-dashed border-slate-100">
                  <span className="text-slate-500">{t('paymentMethodLabel')}</span>
                  <span className="font-bold text-slate-800">
                    {paymentOption === 'RECEIVER_COUNTER'
                      ? t('receiverPaysOption')
                      : t('senderPaysOption')}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-dashed border-slate-100">
                  <span className="text-slate-500">{t('busCompanyLabel')}</span>
                  <span className="font-bold text-slate-800">
                    {createdSuccessShipment.trip.busCompany.name}
                  </span>
                </div>
                <div className="py-1">
                  <span className="text-slate-500 block">{t('dropoffStationColon')}</span>
                  <span className="font-semibold text-slate-800 block">
                    {createdSuccessShipment.pickupPoint.name} —{' '}
                    {createdSuccessShipment.pickupPoint.address}
                  </span>
                </div>
                <div className="py-1">
                  <span className="text-slate-500 block">{t('pickupStationColon')}</span>
                  <span className="font-semibold text-slate-800 block">
                    {createdSuccessShipment.dropoffPoint.name} —{' '}
                    {createdSuccessShipment.dropoffPoint.address}
                  </span>
                </div>
              </div>

              {/* Alert 72h Dropoff Guide */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-amber-800 text-xs mb-5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong>Chờ mang hàng đến gửi.</strong> Hạn gửi:{' '}
                  <strong>
                    {formatIsoTime(createdSuccessShipment.dropoffDeadline)}{' '}
                    {formatIsoDate(createdSuccessShipment.dropoffDeadline)}
                  </strong>{' '}
                  (72 giờ từ lúc tạo). Nhân viên nhà xe sẽ cân đo thực tế và
                  tiến hành tiếp nhận vận chuyển.
                </div>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const code = createdSuccessShipment.waybillCode;
                    const phone = createdSuccessShipment.sender.phoneNumber;
                    setCreatedSuccessShipment(null);
                    setActiveTab('lookup');
                    setLookupCode(code);
                    setLookupPhone(phone);
                  }}
                  className="w-full py-2.5 px-3 rounded-xl border border-slate-300 font-bold text-xs text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Tra cứu vận đơn
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCreatedSuccessShipment(null);
                    senderTouchedRef.current = {
                      name: false,
                      phone: false,
                      email: false,
                    };
                    setSenderName('');
                    setSenderPhone('');
                    setSenderEmail('');
                    setReceiverName('');
                    setReceiverPhone('');
                    setReceiverCccd('');
                    setNote('');
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-[#FF7D42] text-white font-bold text-xs hover:bg-[#F06A2D] transition-colors cursor-pointer shadow-sm"
                >
                  {locale === 'en' ? 'Create New Shipment' : 'Tạo đơn gửi mới'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SendFreightPage() {
  const t = useTranslations('shipments');
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          {t('loadingPage')}
        </div>
      }
    >
      <SendFreightContent />
    </Suspense>
  );
}
