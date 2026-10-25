/* eslint-disable */
'use client';

import React, { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Package,
  MapPin,
  Calculator,
  ArrowRight,
  Truck,
  User,
  Users,
  CheckCircle,
  Copy,
  Clock,
  Search,
  AlertCircle,
  Info,
  Calendar,
  CalendarDays,
  Building2,
  QrCode,
  RotateCcw,
  Minus,
  Plus,
  ArrowLeftRight,
  ArrowRightLeft,
  PackageCheck,
  X,
  ShieldCheck,
  Check,
  ChevronDown,
  Filter,
  ArrowUpDown,
  Trash2,
} from 'lucide-react';
import { LocationCombobox } from '@/features/home/components/location-combobox';
import { tripsApi, type ApiTrip } from '@/features/trips/services/trips.api';
import {
  shipmentsApi,
  type PublicShipmentLookupData,
  type ShipmentCargoRate,
  type ShipmentRoutePoints,
  type ShipmentResponseData,
} from '@/features/shipments/services/shipments.api';
import {
  createPaymentDraft,
  getPaymentDraft,
} from '@/features/booking/services/payment-draft';
import { useAuthSession } from '@/features/auth/auth-session';

const POPULAR_LOCATIONS = [
  'Đà Lạt',
  'TP.HCM',
  'Hà Nội',
  'Đà Nẵng',
  'Nha Trang',
  'Cần Thơ',
  'Vũng Tàu',
  'Phan Thiết',
  'Bảo Lộc',
  'Buôn Ma Thuột',
];

function formatCategoryName(name: string): string {
  if (!name) return '';
  if (name !== name.toUpperCase()) return name;
  return name.toLowerCase().replace(/(^|\s)\S/g, (l) => l.toUpperCase());
}

function SendFreightContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isHydrated, executeWithAuth } = useAuthSession();

  // Tab: 'create' | 'lookup'
  const [activeTab, setActiveTab] = useState<'create' | 'lookup'>('create');
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);

  // Tuyến & Chuyến
  const todayStr = useMemo(
    () =>
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Ho_Chi_Minh',
      }).format(new Date()),
    [],
  );
  const [origin, setOrigin] = useState<string>('Đà Lạt');
  const [destination, setDestination] = useState<string>('TP.HCM');
  const [date, setDate] = useState<string>(
    () =>
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Ho_Chi_Minh',
      }).format(new Date()),
  );
  const [trips, setTrips] = useState<ApiTrip[]>([]);
  const [loadingTrips, setLoadingTrips] = useState<boolean>(false);
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>('all');
  const [selectedTimeFilter, setSelectedTimeFilter] = useState<string>('all'); // 'all' | 'morning' | 'afternoon' | 'evening' | 'night'
  const [visibleTripCount, setVisibleTripCount] = useState<number>(8);
  const [routePoints, setRoutePoints] = useState<ShipmentRoutePoints | null>(null);
  const [routePointsLoading, setRoutePointsLoading] = useState(false);
  const [routePointsError, setRoutePointsError] = useState<string | null>(null);
  const [senderPointId, setSenderPointId] = useState<number | null>(null);
  const [receiverPointId, setReceiverPointId] = useState<number | null>(null);

  const handleSwapLocations = () => {
    setOrigin(destination);
    setDestination(origin);
  };

  // Danh sách các nhà xe duy nhất từ kết quả tìm chuyến
  const availableCompanies = useMemo(() => {
    const map = new Map<number, { id: number; name: string }>();
    trips.forEach((t) => {
      if (t.busCompany?.id) {
        map.set(t.busCompany.id, { id: t.busCompany.id, name: t.busCompany.name });
      }
    });
    return Array.from(map.values());
  }, [trips]);

  // Danh sách chuyến xe sau khi áp dụng bộ lọc nhà xe và khung giờ
  const filteredTrips = useMemo(() => {
    let result = [...trips];

    // 1. Lọc theo nhà xe
    if (selectedCompanyFilter !== 'all') {
      result = result.filter((t) => String(t.busCompany?.id) === selectedCompanyFilter);
    }

    // 2. Lọc theo khung giờ khởi hành
    if (selectedTimeFilter !== 'all') {
      result = result.filter((t) => {
        try {
          const d = new Date(t.departureTime);
          const hour = d.getHours();
          if (selectedTimeFilter === 'morning') return hour >= 6 && hour < 12; // Sáng 06:00 - 12:00
          if (selectedTimeFilter === 'afternoon') return hour >= 12 && hour < 18; // Chiều 12:00 - 18:00
          if (selectedTimeFilter === 'evening') return hour >= 18 && hour < 22; // Tối 18:00 - 22:00
          if (selectedTimeFilter === 'night') return hour >= 22 || hour < 6; // Đêm 22:00 - 06:00
          return true;
        } catch {
          return true;
        }
      });
    }

    return result;
  }, [trips, selectedCompanyFilter, selectedTimeFilter]);

  // Tự động reset về 8 chuyến ban đầu khi thay đổi tuyến đường hoặc bộ lọc
  useEffect(() => {
    setVisibleTripCount(8);
  }, [selectedCompanyFilter, selectedTimeFilter, origin, destination, date]);

  // Danh sách chuyến xe đang hiển thị (phục vụ cuộn dọc + nút Xem thêm)
  const visibleTrips = useMemo(() => {
    return filteredTrips.slice(0, visibleTripCount);
  }, [filteredTrips, visibleTripCount]);

  // Người gửi
  const [senderName, setSenderName] = useState<string>('');
  const [senderPhone, setSenderPhone] = useState<string>('');
  const [senderEmail, setSenderEmail] = useState<string>('');

  // Người nhận
  const [receiverName, setReceiverName] = useState<string>('');
  const [receiverPhone, setReceiverPhone] = useState<string>('');

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
  const [cargoCategoriesError, setCargoCategoriesError] = useState<string | null>(null);
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

  const hasFragile = useMemo(
    () => cargoItems.some((item) => item.serviceType === 'fragile'),
    [cargoItems],
  );
  const hasValuable = useMemo(
    () => cargoItems.some((item) => item.serviceType === 'valuable'),
    [cargoItems],
  );

  const cargoCategoryId = cargoItems[0]?.categoryId;
  const cargoCategory =
    cargoCategories.find((category) => category.categoryId === cargoCategoryId)?.name || '';

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
  };

  const handleUpdateCargoItem = (
    id: string,
    field: string,
    value: unknown,
  ) => {
    setCargoItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, [field]: value } : item,
      ),
    );
  };

  // Tải danh mục loại hàng hóa từ API
  useEffect(() => {
    let isMounted = true;
    setCargoCategoriesLoading(true);
    shipmentsApi
      .getCargoCategories()
      .then((res) => {
        if (isMounted) {
          const categories = res.data || [];
          setCargoCategories(categories);
          setCargoCategoriesError(
            categories.length === 0
              ? 'Hệ thống chưa cấu hình danh mục loại hàng hóa.'
              : null,
          );
        }
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setCargoCategoriesError(
            error instanceof Error
              ? error.message
              : 'Không thể tải danh mục loại hàng hóa.',
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

  const [companyPricingMap, setCompanyPricingMap] = useState<
    Record<number, { minFee: number | null; rates: ShipmentCargoRate[] }>
  >({});

  const resolveFeeFromRates = useCallback(
    (
      rates: ShipmentCargoRate[] | undefined,
      totalW: number,
      sPointId?: number | null,
      rPointId?: number | null,
      catId?: number,
    ): number => {
      if (rates && rates.length > 0) {
        const matched = rates.find(
          (r) =>
            (!sPointId || r.senderPointId === sPointId) &&
            (!rPointId || r.receiverPointId === rPointId) &&
            (!catId || r.categoryId === catId) &&
            r.minWeight <= totalW &&
            (r.maxWeight === null || r.maxWeight >= totalW),
        );
        if (matched) return matched.fee;

        const weightMatched = rates.find(
          (r) =>
            r.minWeight <= totalW &&
            (r.maxWeight === null || r.maxWeight >= totalW),
        );
        if (weightMatched) return weightMatched.fee;
      }

      if (totalW <= 1) return 30_000;
      if (totalW <= 5) return 50_000;
      if (totalW <= 10) return 80_000;
      if (totalW <= 20) return 120_000;
      if (totalW <= 50) return 180_000;
      return 250_000;
    },
    [],
  );

  // Dự tính cước phí theo đúng khung bảng cước gửi hàng (BangCuocGuiHang) của nhà xe đã chọn
  const calculatedPricing = useMemo(() => {
    let totalAggregatedWeight = 0;
    let totalVolumetric = 0;

    cargoItems.forEach((item) => {
      const l = Number(item.length) || 0;
      const w = Number(item.width) || 0;
      const h = Number(item.height) || 0;
      const itemVolumetric =
        l > 0 && w > 0 && h > 0
          ? Math.round(((l * w * h) / 5000) * 10) / 10
          : 0;
      const qty = Math.max(1, Number(item.quantity) || 1);
      totalVolumetric += itemVolumetric * qty;
      const unitWeight = Math.max(
        item.weight > 0 ? item.weight : 0.5,
        itemVolumetric,
      );
      totalAggregatedWeight += unitWeight * qty;
    });

    const totalWeight = Math.round(totalAggregatedWeight * 100) / 100;

    const baseFee = resolveFeeFromRates(
      routePoints?.rates,
      totalWeight,
      senderPointId,
      receiverPointId,
      cargoCategoryId,
    );

    const fragileFee = hasFragile ? 20_000 : 0;
    const valuableFee = hasValuable ? 50_000 : 0;
    const totalFee = baseFee + fragileFee + valuableFee;

    return {
      volumetricWeight: totalVolumetric,
      unitWeight: totalWeight,
      totalWeight,
      baseFee,
      fragileFee,
      valuableFee,
      totalFee,
    };
  }, [
    cargoItems,
    hasFragile,
    hasValuable,
    routePoints?.rates,
    senderPointId,
    receiverPointId,
    cargoCategoryId,
    resolveFeeFromRates,
  ]);

  // Trạng thái xử lý tạo đơn
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [missingFieldsModal, setMissingFieldsModal] = useState<boolean>(false);
  const [createdShipment, setCreatedShipment] = useState<ShipmentResponseData | null>(null);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Tra cứu vận đơn
  const [lookupCode, setLookupCode] = useState<string>('');
  const [lookupPhone, setLookupPhone] = useState<string>('');
  const [isLookingUp, setIsLookingUp] = useState<boolean>(false);
  const [lookupResult, setLookupResult] = useState<PublicShipmentLookupData | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Khởi tạo params từ URL nếu có
  useEffect(() => {
    if (searchParams) {
      const fromParam = searchParams.get('from') || searchParams.get('origin');
      const toParam = searchParams.get('to') || searchParams.get('destination');
      const dateParam = searchParams.get('date');
      if (fromParam) setOrigin(fromParam);
      if (toParam) setDestination(toParam);
      if (dateParam) setDate(dateParam);
      if (searchParams.get('tab') === 'lookup') setActiveTab('lookup');
      if (searchParams.get('code')) setLookupCode(searchParams.get('code') as string);
      if (searchParams.get('phone')) setLookupPhone(searchParams.get('phone') as string);
    }
  }, [searchParams]);

  // Hàm tải danh sách chuyến xe
  const fetchTrips = useCallback(async () => {
    if (!origin || !destination) return;
    setLoadingTrips(true);
    setSelectedTripId(null);
    setCompanyPricingMap({});
    try {
      const res = await tripsApi.searchTrips({
        from: origin,
        to: destination,
        departureDate: date,
      });
      const loadedTrips = res.data || [];
      setTrips(loadedTrips);
      if (loadedTrips.length > 0) {
        setSelectedTripId(loadedTrips[0].id);
      }
    } catch {
      setTrips([]);
    } finally {
      setLoadingTrips(false);
    }
  }, [origin, destination, date]);

  // Tự động tải danh sách chuyến xe khi thay đổi tuyến hoặc ngày
  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

  const selectedTrip = useMemo(() => {
    return trips.find((t) => t.id === selectedTripId) || null;
  }, [trips, selectedTripId]);

  // Tải bảng cước cho các nhà xe khác trong danh sách để hiển thị giá riêng của từng nhà xe
  useEffect(() => {
    let active = true;
    const seenCompanies = new Set<number>();
    if (selectedTrip) {
      seenCompanies.add(selectedTrip.busCompany.id);
    }

    for (const t of trips) {
      const compId = t.busCompany.id;
      if (seenCompanies.has(compId) || companyPricingMap[compId]) continue;
      seenCompanies.add(compId);
      shipmentsApi
        .getRoutePoints(t.id)
        .then(({ data }) => {
          if (!active) return;
          setCompanyPricingMap((prev) => ({
            ...prev,
            [compId]: {
              minFee: data.minFee ?? null,
              rates: data.rates ?? [],
            },
          }));
        })
        .catch(() => {
          // Bỏ qua lỗi khi tải giá tham khảo phụ
        });
    }

    return () => {
      active = false;
    };
  }, [trips, selectedTrip, companyPricingMap]);

  useEffect(() => {
    let active = true;
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
      .getRoutePoints(selectedTripId)
      .then(({ data }) => {
        if (!active) return;
        setRoutePoints(data);
        const compId = trips.find((t) => t.id === selectedTripId)?.busCompany.id;
        if (compId) {
          setCompanyPricingMap((prev) => ({
            ...prev,
            [compId]: {
              minFee: data.minFee ?? null,
              rates: data.rates ?? [],
            },
          }));
        }
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
              : 'Không thể tải điểm gửi và điểm nhận của chuyến xe.',
          );
        }
      })
      .finally(() => {
        if (active) setRoutePointsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedTripId, trips]);

  // Xử lý tạo mã vận đơn
  const handleCreateShipment = async () => {
    setErrorMessage(null);

    if (!isHydrated) {
      setErrorMessage('Đang xác minh phiên đăng nhập. Vui lòng thử lại sau giây lát.');
      return;
    }

    const missing: string[] = [];
    if (!selectedTripId) missing.push('Chưa chọn chuyến xe vận chuyển');
    if (!senderPointId) missing.push('Chưa chọn điểm gửi hàng');
    if (!receiverPointId) missing.push('Chưa chọn điểm nhận hàng');
    if (senderPointId && receiverPointId && senderPointId === receiverPointId) {
      missing.push('Điểm gửi và điểm nhận phải khác nhau');
    }
    if (!senderName.trim()) missing.push('Họ và tên người gửi');
    if (!senderPhone.trim()) missing.push('Số điện thoại người gửi');
    if (!receiverName.trim()) missing.push('Họ và tên người nhận');
    if (!receiverPhone.trim()) missing.push('Số điện thoại người nhận');

    cargoItems.forEach((item, index) => {
      const prefix = cargoItems.length > 1 ? `Kiện #${index + 1}: ` : '';
      if (!item.name.trim()) missing.push(`${prefix}Tên món hàng / kiện hàng`);
      if (!item.categoryId) missing.push(`${prefix}Danh mục loại hàng hóa`);

      const hasAnyDimension = Boolean(
        item.length.trim() || item.width.trim() || item.height.trim(),
      );
      const hasAllValidDimensions =
        Number(item.length) > 0 &&
        Number(item.width) > 0 &&
        Number(item.height) > 0;
      if (hasAnyDimension && !hasAllValidDimensions) {
        missing.push(
          `${prefix}Kích thước 3 chiều Dài, Rộng, Cao (phải nhập đủ cả 3 hoặc để trống)`,
        );
      }
    });

    if (
      missing.length > 0 ||
      !selectedTripId ||
      !senderPointId ||
      !receiverPointId
    ) {
      if (missing.length > 0) {
        setMissingFieldsModal(true);
        setErrorMessage(missing[0]);
      }
      return;
    }

    if (cargoCategoriesLoading || cargoCategoriesError) {
      setErrorMessage(
        cargoCategoriesError ||
          'Danh mục loại hàng chưa sẵn sàng. Vui lòng thử lại sau.',
      );
      return;
    }

    if (routePointsLoading || routePointsError) {
      setErrorMessage(
        routePointsError || 'Đang tải điểm gửi và điểm nhận. Vui lòng thử lại.',
      );
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const payload = {
        tripId: selectedTripId,
        senderPointId,
        receiverPointId,
        sender: {
          fullName: senderName.trim(),
          phoneNumber: senderPhone.trim(),
          email: senderEmail.trim() || undefined,
        },
        receiver: {
          fullName: receiverName.trim(),
          phoneNumber: receiverPhone.trim(),
        },
        items: cargoItems.map((item) => {
          const categoryName =
            cargoCategories.find((cat) => cat.categoryId === item.categoryId)?.name || '';
          return {
            name: item.name.trim(),
            category: categoryName,
            loaiHangHoaId: item.categoryId,
            quantity: Math.max(1, Number(item.quantity) || 1),
            weight: Math.max(0.5, Number(item.weight) || 1),
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

      const res = isAuthenticated
        ? await executeWithAuth((token) =>
            shipmentsApi.createShipment(payload, token),
          )
        : await shipmentsApi.createShipment(payload);
      const data = res.data;
      const totalFare = data?.pricing?.totalFee;
      if (
        !Number.isSafeInteger(data?.shipmentId) ||
        data.shipmentId <= 0 ||
        !Number.isSafeInteger(data?.paymentId) ||
        data.paymentId <= 0 ||
        !data.waybillCode?.trim() ||
        !data.orderCode?.trim() ||
        typeof totalFare !== 'number' ||
        !Number.isFinite(totalFare) ||
        totalFare < 0 ||
        !Number.isFinite(Date.parse(data.paymentExpiresAt))
      ) {
        throw new Error(
          'Đơn gửi đã được tạo nhưng chưa nhận đủ thông tin thanh toán. Vui lòng tra cứu bằng mã vận đơn hoặc liên hệ hỗ trợ.',
        );
      }

      const paymentDraft = createPaymentDraft({
        kind: 'shipment',
        shipmentId: data.shipmentId,
        paymentId: data.paymentId,
        orderId: data.orderId,
        waybillCode: data.waybillCode,
        orderCode: data.orderCode,
        totalFare,
        paymentExpiresAt: data.paymentExpiresAt,
        sender: data.sender,
        receiver: data.receiver,
        route: {
          origin: data.trip.route.origin,
          destination: data.trip.route.destination,
          departureTime: data.trip.departureTime,
        },
        pickupPoint: {
          name: data.pickupPoint.name,
          address: data.pickupPoint.address,
        },
        dropoffPoint: {
          name: data.dropoffPoint.name,
          address: data.dropoffPoint.address,
        },
      });

      if (!getPaymentDraft(paymentDraft.id)) {
        throw new Error(
          'Không thể lưu thông tin thanh toán trên trình duyệt. Vui lòng tra cứu mã vận đơn hoặc liên hệ hỗ trợ trước khi thử tạo lại đơn.',
        );
      }

      router.push(`/payment?draftId=${encodeURIComponent(paymentDraft.id)}`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Không thể tạo đơn gửi hàng. Vui lòng kiểm tra lại thông tin.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Tra cứu vận đơn
  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLookupError(null);
    setLookupResult(null);

    if (!lookupCode.trim()) {
      setLookupError('Vui lòng nhập mã vận đơn.');
      return;
    }
    if (!lookupPhone.trim()) {
      setLookupError('Vui lòng nhập số điện thoại người gửi hoặc người nhận.');
      return;
    }

    setIsLookingUp(true);
    try {
      const res = await shipmentsApi.lookupShipment({
        waybillCode: lookupCode.trim(),
        phoneNumber: lookupPhone.trim(),
      });
      setLookupResult(res.data);
    } catch (err: any) {
      setLookupError(err.message || 'Không tìm thấy thông tin vận đơn khớp với thông tin đã nhập.');
    } finally {
      setIsLookingUp(false);
    }
  };

  const copyToClipboard = (text: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const formatIsoDate = (isoStr: string) => {
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

  const formatIsoTime = (isoStr: string) => {
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
      <div className="bg-[#17223B] text-white pt-10 pb-16 px-4 sm:px-6 relative overflow-hidden">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-2">
              Gửi hàng theo nhà xe , <br className="hidden sm:inline" />
              <span className="text-[#FF7D42]">nhanh – gọn – an toàn</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl leading-relaxed">
              Giao nhận hàng trực tiếp tại bến xe và văn phòng nhà xe. Nhanh chóng, tiết kiệm và an toàn.
            </p>
          </div>

          {/* Switch Tab */}
          <div className="inline-flex p-1 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/10 self-start md:self-auto">
            <button
              onClick={() => {
                setActiveTab('create');
                setCreatedShipment(null);
              }}
              className={`px-5 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all ${
                activeTab === 'create'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              Tạo đơn gửi hàng
            </button>
            <button
              onClick={() => setActiveTab('lookup')}
              className={`px-5 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all ${
                activeTab === 'lookup'
                  ? 'bg-white text-[#17223B] shadow-sm'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              Tra cứu vận đơn
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 -mt-8 relative z-20">
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
                    Tạo mã vận đơn gửi hàng thành công!
                  </h2>
                  <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                    Đơn gửi hàng của bạn đã được tiếp nhận vào hệ thống. Bạn chỉ cần mang kiện hàng ra bến xe trước giờ xuất bến và đọc mã vận đơn bên dưới cho nhân viên nhà xe.
                  </p>

                  {/* Mã vận đơn nổi bật */}
                  <div className="bg-slate-50 border-2 border-emerald-500/30 rounded-2xl p-5 mb-6 text-center">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Mã vận đơn của bạn
                    </div>
                    <div className="text-2xl md:text-3xl font-black text-[#0060c4] tracking-wide flex items-center justify-center gap-3">
                      <span>{createdShipment.waybillCode}</span>
                      <button
                        onClick={() => copyToClipboard(createdShipment.waybillCode)}
                        className="p-2 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors"
                        title="Sao chép mã"
                      >
                        <Copy className="w-5 h-5" />
                      </button>
                    </div>
                    {copiedCode && (
                      <div className="text-xs text-emerald-600 font-bold mt-1">Đã sao chép vào bộ nhớ tạm!</div>
                    )}
                    <div className="text-xs text-slate-500 mt-2">
                      Mã đơn giao dịch: <strong className="text-slate-700">{createdShipment.orderCode}</strong>
                    </div>
                  </div>
                </div>

                {/* Chi tiết tiếp nhận */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-100 pt-6 max-w-2xl mx-auto text-sm">
                  <div className="bg-slate-50 p-4 rounded-xl">
                    <div className="font-bold text-slate-800 flex items-center gap-2 mb-2">
                      <MapPin className="w-4 h-4 text-rose-500" /> Điểm gửi (Nơi bạn mang hàng ra):
                    </div>
                    <div className="font-extrabold text-slate-900">{createdShipment.pickupPoint.name}</div>
                    <div className="text-xs text-slate-600 mt-1">{createdShipment.pickupPoint.address}</div>
                    <div className="text-xs text-blue-600 font-semibold mt-2">
                      Khởi hành lúc: {formatIsoTime(createdShipment.trip.departureTime)} - {formatIsoDate(createdShipment.trip.departureTime)}
                    </div>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl">
                    <div className="font-bold text-slate-800 flex items-center gap-2 mb-2">
                      <MapPin className="w-4 h-4 text-emerald-500" /> Điểm nhận (Nơi người nhận đến lấy):
                    </div>
                    <div className="font-extrabold text-slate-900">{createdShipment.dropoffPoint.name}</div>
                    <div className="text-xs text-slate-600 mt-1">{createdShipment.dropoffPoint.address}</div>
                    <div className="text-xs text-slate-600 font-semibold mt-2">
                      Người nhận: <strong>{createdShipment.receiver.fullName}</strong> ({createdShipment.receiver.phoneNumber})
                    </div>
                  </div>
                </div>

                {/* Hàng hóa & Cước */}
                <div className="max-w-2xl mx-auto mt-4 bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex justify-between items-center text-sm">
                  <div>
                    <span className="text-slate-600">Kiện hàng: </span>
                    <strong className="text-slate-900">
                      {createdShipment.items.map((i) => `${i.name} (${i.weight}kg)`).join(', ')}
                    </strong>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500">Tổng cước phí</div>
                    <div className="text-lg font-black text-rose-600">
                      {createdShipment.pricing.totalFee.toLocaleString('vi-VN')}đ
                    </div>
                  </div>
                </div>

                {/* Nút hành động */}
                <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 max-w-xl mx-auto">
                  <button
                    onClick={() => {
                      setCreatedShipment(null);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="w-full sm:w-auto px-6 py-3 border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="w-4 h-4" /> Tạo đơn gửi hàng khác
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('lookup');
                      setLookupCode(createdShipment.waybillCode);
                      setLookupPhone(createdShipment.sender.phoneNumber);
                    }}
                    className="w-full sm:w-auto px-6 py-3 bg-[#0060c4] hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    <Search className="w-4 h-4" /> Xem chi tiết vận đơn
                  </button>
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
                        Gửi hàng
                      </div>
                    </div>
                  </div>

                  {/* Vùng chọn tuyến & ngày gửi */}
                  <div className="flex flex-col pt-4">
                    <div className="flex flex-col md:flex-row gap-3">
                      {/* Nơi gửi */}
                      <div className="flex-1 space-y-1.5">
                        <label className="text-[11px] font-extrabold text-slate-500 uppercase flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-brand" />
                          Nơi gửi
                        </label>
                        <LocationCombobox
                          value={origin}
                          onChange={setOrigin}
                          options={POPULAR_LOCATIONS}
                          placeholder="Chọn nơi gửi"
                        />
                      </div>

                      {/* Nút đổi chiều tuyến */}
                      <div className="hidden md:flex items-end pb-1 lg:shrink-0">
                        <button
                          type="button"
                          onClick={handleSwapLocations}
                          className="w-11 h-11 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-brand flex items-center justify-center transition-colors cursor-pointer shrink-0"
                          title="Đổi chiều tuyến"
                        >
                          <ArrowRightLeft className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Nơi nhận */}
                      <div className="flex-1 space-y-1.5">
                        <label className="text-[11px] font-extrabold text-slate-500 uppercase flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-rose-500" />
                          Nơi nhận
                        </label>
                        <LocationCombobox
                          value={destination}
                          onChange={setDestination}
                          options={POPULAR_LOCATIONS}
                          placeholder="Chọn nơi nhận"
                        />
                      </div>

                      {/* Ngày gửi */}
                      <div className="flex-1 space-y-1.5">
                        <label className="text-[11px] font-extrabold text-slate-500 uppercase flex items-center gap-1.5">
                          <CalendarDays className="w-3.5 h-3.5 text-brand" />
                          Ngày gửi
                        </label>
                        <input
                          type="date"
                          min={todayStr}
                          value={date}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val && val < todayStr) {
                              setDate(todayStr);
                            } else {
                              setDate(val);
                            }
                          }}
                          onBlur={(e) => {
                            if (e.target.value && e.target.value < todayStr) {
                              setDate(todayStr);
                            }
                          }}
                          className="h-12 w-full border border-slate-300 rounded-lg px-3 text-sm font-bold text-slate-900 outline-none focus:border-brand bg-white"
                        />
                      </div>
                    </div>

                    {/* Hàng dưới: Hướng dẫn gửi hàng & Tìm nhà xe */}
                    <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => setShowGuideModal(true)}
                        className="text-sm font-bold text-amber-500 hover:text-amber-600 hover:underline cursor-pointer text-left"
                      >
                        Hướng dẫn gửi hàng
                      </button>
                      <div>
                        <button
                          type="button"
                          disabled={loadingTrips}
                          onClick={() => {
                            fetchTrips();
                            const step2El = document.getElementById('step-select-trip');
                            if (step2El) {
                              step2El.scrollIntoView({ behavior: 'smooth' });
                            }
                          }}
                          className="w-full sm:w-[170px] h-12 px-7 rounded-lg bg-accent hover:bg-accent-hover text-white font-black text-sm flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-75 transition-all"
                        >
                          {loadingTrips ? (
                            <>
                              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                              <span>Đang tìm...</span>
                            </>
                          ) : (
                            <>
                              <Search className="w-4 h-4 shrink-0" />
                              <span>Tìm nhà xe</span>
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
                    <div id="step-select-trip" className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-6 h-6 rounded-full bg-[#EF4444] text-white flex items-center justify-center text-xs font-bold">
                            1
                          </div>
                          <div>
                            <h2 className="text-base font-extrabold text-slate-900">
                              Chọn nhà xe nhận vận chuyển
                            </h2>
                            <p className="text-xs text-slate-400 mt-0.5">
                              Gửi hàng linh hoạt trong ngày theo tuyến đường đã chọn
                            </p>
                          </div>
                        </div>

                        <span className="px-3 py-1 bg-blue-50 text-blue-600 font-bold text-xs rounded-full">
                          {loadingTrips ? 'Đang tải...' : `${filteredTrips.length} lựa chọn`}
                        </span>
                      </div>

                      {/* BỐ CỤC 2 CỘT: CỘT TRÁI BỘ LỌC - CỘT PHẢI DANH SÁCH XE */}
                      <div className="flex flex-col md:flex-row gap-5 items-start">
                        {/* CỘT TRÁI: BỘ LỌC DẠNG DROPDOWN SỔ XUỐNG */}
                        <div className="w-full md:w-56 shrink-0 bg-slate-50/80 p-4 rounded-2xl border border-slate-200 space-y-4">
                          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                            <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-800 uppercase tracking-wide">
                              <Filter className="w-3.5 h-3.5 text-slate-500" />
                              <span>Bộ lọc tìm kiếm</span>
                            </div>
                            {(selectedCompanyFilter !== 'all' ||
                              selectedTimeFilter !== 'all') && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedCompanyFilter('all');
                                  setSelectedTimeFilter('all');
                                }}
                                className="text-[11px] text-[#0060c4] hover:underline font-semibold flex items-center gap-0.5"
                              >
                                <RotateCcw className="w-3 h-3" /> Đặt lại
                              </button>
                            )}
                          </div>

                          {/* 1. Dropdown Nhà xe */}
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1.5 flex items-center gap-1">
                              <Building2 className="w-3 h-3 text-slate-400" />
                              <span>Nhà xe vận chuyển</span>
                            </label>
                            <div className="relative">
                              <select
                                value={selectedCompanyFilter}
                                onChange={(e) => setSelectedCompanyFilter(e.target.value)}
                                className="w-full h-10 pl-3 pr-8 rounded-xl border border-slate-200 hover:border-slate-300 focus:outline-none focus:border-[#0060c4] font-medium text-slate-800 bg-white appearance-none cursor-pointer text-xs"
                              >
                                <option value="all">Tất cả nhà xe</option>
                                {availableCompanies.map((comp) => (
                                  <option key={comp.id} value={String(comp.id)}>
                                    {comp.name}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>
                          </div>

                          {/* 2. Dropdown Khung giờ xuất bến */}
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1.5 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span>Khung giờ xuất bến</span>
                            </label>
                            <div className="relative">
                              <select
                                value={selectedTimeFilter}
                                onChange={(e) => setSelectedTimeFilter(e.target.value)}
                                className="w-full h-10 pl-3 pr-8 rounded-xl border border-slate-200 hover:border-slate-300 focus:outline-none focus:border-[#0060c4] font-medium text-slate-800 bg-white appearance-none cursor-pointer text-xs"
                              >
                                <option value="all">Tất cả giờ xuất bến</option>
                                <option value="morning">Sáng (06:00 – 12:00)</option>
                                <option value="afternoon">Chiều (12:00 – 18:00)</option>
                                <option value="evening">Tối (18:00 – 22:00)</option>
                                <option value="night">Đêm (22:00 – 06:00)</option>
                              </select>
                              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>
                          </div>
                        </div>

                        {/* CỘT PHẢI: HIỂN THỊ THÔNG TIN CHUYẾN XE */}
                        <div className="flex-1 min-w-0 w-full">
                          {loadingTrips ? (
                            <div className="p-8 text-center text-slate-400 text-sm bg-slate-50 rounded-xl">
                              Đang tải danh sách nhà xe nhận hàng...
                            </div>
                          ) : filteredTrips.length === 0 ? (
                            <div className="p-6 text-center text-slate-500 text-sm bg-amber-50 rounded-xl border border-amber-200">
                              {trips.length > 0
                                ? 'Không có chuyến xe nào phù hợp với bộ lọc đã chọn.'
                                : 'Chưa có nhà xe nào nhận tuyến này vào ngày đã chọn. Vui lòng chọn ngày khác (ví dụ: ngày 20/10/2026).'}
                            </div>
                          ) : (
                            /* Khung cuộn cố định chiều cao kèm nút Xem thêm */
                            <div className="flex flex-col gap-2.5 w-full max-h-[400px] sm:max-h-[440px] overflow-y-auto pr-1 sm:pr-1.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-slate-100 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-slate-400">
                              {visibleTrips.map((trip) => {
                                  const isSelected = selectedTripId === trip.id;
                                  const depTime = formatIsoTime(trip.departureTime);

                                  return (
                                    <div
                                      key={trip.id}
                                      id={`trip-card-${trip.id}`}
                                      onClick={() => setSelectedTripId(trip.id)}
                                      className={`py-2 px-3 sm:px-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between gap-2 sm:gap-3 w-full shrink-0 ${
                                        isSelected
                                          ? 'border-orange-500 bg-white ring-2 ring-orange-100 shadow-xs'
                                          : 'border-slate-200 bg-white hover:border-slate-300'
                                      }`}
                                    >
                                      {/* Cột 1: Thông tin nhà xe - cố định độ rộng để căn thẳng hàng dọc */}
                                      <div className="w-28 sm:w-32 shrink-0 min-w-0">
                                        <div className="font-extrabold text-slate-900 text-xs sm:text-sm leading-tight truncate">
                                          {trip.busCompany.name}
                                        </div>
                                        <div className="flex items-center gap-1 text-[10px] sm:text-[11px] text-emerald-600 font-semibold mt-0.5 truncate">
                                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                                          <span className="truncate">Nhận tại bến</span>
                                        </div>
                                      </div>

                                      {/* Cột 2: Thời gian xuất bến & Địa điểm - căn thẳng cột dọc qua tất cả các card */}
                                      <div className="flex-1 min-w-0 px-1 sm:px-2">
                                        <div className="flex items-baseline gap-1">
                                          <span className="text-sm sm:text-base font-black text-slate-900 font-mono tracking-tight">
                                            {depTime}
                                          </span>
                                          <span className="text-[10px] text-slate-400">xuất bến</span>
                                        </div>
                                        <div className="flex items-center gap-1 text-[10px] sm:text-[11px] text-slate-500 mt-0.5 truncate">
                                          <span className="shrink-0">Trong ngày</span>
                                          <span className="text-slate-300 shrink-0">·</span>
                                          <span className="flex items-center gap-0.5 truncate">
                                            <MapPin className="w-2.5 h-2.5 text-rose-400 shrink-0" />
                                            <span className="truncate">Bến {origin}</span>
                                          </span>
                                        </div>
                                      </div>

                                      {/* Cột 3: Giá cước khởi điểm và ước tính theo bảng cước từng nhà xe */}
                                      <div className="text-right shrink-0">
                                        <div>
                                          <span className="text-[10px] text-slate-400 mr-1 font-medium">Từ</span>
                                          <span className="text-xs sm:text-sm font-black text-orange-600">
                                            {(companyPricingMap[trip.busCompany.id]?.minFee ?? 30_000).toLocaleString('vi-VN')}đ
                                          </span>
                                        </div>
                                        {companyPricingMap[trip.busCompany.id]?.rates?.length ? (
                                          <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
                                            {calculatedPricing.totalWeight}kg:{' '}
                                            {resolveFeeFromRates(
                                              companyPricingMap[trip.busCompany.id].rates,
                                              calculatedPricing.totalWeight,
                                              undefined,
                                              undefined,
                                              cargoCategoryId,
                                            ).toLocaleString('vi-VN')}
                                            đ
                                          </div>
                                        ) : null}
                                      </div>
                                    </div>
                                  );
                                })}

                              {/* Nút Xem thêm chuyến xe khi còn chuyến chưa hiển thị */}
                              {visibleTripCount < filteredTrips.length ? (
                                <div className="pt-2 pb-1 flex flex-col items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => setVisibleTripCount((prev) => prev + 8)}
                                    className="w-full py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-orange-50 hover:border-orange-300 hover:text-orange-600 font-extrabold text-xs text-slate-700 shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                  >
                                    <span>Xem thêm chuyến xe</span>
                                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                                  </button>
                                  <p className="text-[10px] text-slate-400">
                                    Đang hiển thị {visibleTrips.length} / {filteredTrips.length} chuyến
                                  </p>
                                </div>
                              ) : filteredTrips.length > 8 ? (
                                <div className="text-center pt-2 pb-1 text-[11px] text-slate-400 font-medium shrink-0">
                                  ✓ Đã hiển thị tất cả {filteredTrips.length} chuyến xe
                                </div>
                              ) : null}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* STEP 3: THÔNG TIN NGƯỜI GỬI & NGƯỜI NHẬN */}
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                      <div className="flex items-center gap-2.5 mb-1">
                        <div className="w-6 h-6 rounded-full bg-[#EF4444] text-white flex items-center justify-center text-xs font-bold">
                          2
                        </div>
                        <h2 className="text-base font-extrabold text-slate-900">
                          Thông tin người gửi & người nhận
                        </h2>
                      </div>
                      <p className="text-xs text-slate-400 mb-5 pl-8.5">
                        Người nhận sẽ ra bến nhận hàng bằng CCCD/SĐT
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
                        {/* Người gửi */}
                        <div className="space-y-3.5">
                          <div className="flex items-center gap-2.5 pb-1">
                            <div className="w-8 h-8 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center">
                              <User className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="font-extrabold text-slate-900 text-sm">Người gửi</div>
                              <div className="text-[11px] text-slate-400">Bạn là người gửi hàng</div>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                              Họ và tên <span className="text-rose-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={senderName}
                              onChange={(e) => setSenderName(e.target.value)}
                              placeholder="Ví dụ: Nguyễn Văn A"
                              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 focus:outline-none focus:border-orange-500 text-slate-800 bg-slate-50/50 text-sm"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                              Số điện thoại <span className="text-rose-500">*</span>
                            </label>
                            <input
                              type="tel"
                              value={senderPhone}
                              onChange={(e) => setSenderPhone(e.target.value)}
                              placeholder="09xxxxxxxx"
                              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 focus:outline-none focus:border-orange-500 text-slate-800 bg-slate-50/50 text-sm"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                              Email <span className="text-slate-400 font-normal lowercase">(không bắt buộc)</span>
                            </label>
                            <input
                              type="email"
                              value={senderEmail}
                              onChange={(e) => setSenderEmail(e.target.value)}
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
                              <div className="font-extrabold text-slate-900 text-sm">Người nhận</div>
                              <div className="text-[11px] text-slate-400">Ra bến nhận hàng</div>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                              Họ và tên người nhận <span className="text-rose-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={receiverName}
                              onChange={(e) => setReceiverName(e.target.value)}
                              placeholder="Ví dụ: Lê Thị B"
                              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500 text-slate-800 bg-slate-50/50 text-sm"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                              Số điện thoại người nhận <span className="text-rose-500">*</span>
                            </label>
                            <input
                              type="tel"
                              value={receiverPhone}
                              onChange={(e) => setReceiverPhone(e.target.value)}
                              placeholder="09xxxxxxxx"
                              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500 text-slate-800 bg-slate-50/50 text-sm"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="mt-6 border-t border-slate-100 pt-5">
                        <h3 className="text-sm font-extrabold text-slate-900">
                          Điểm gửi và điểm nhận hàng
                        </h3>
                        <p className="mt-1 text-xs text-slate-500">
                          Chọn điểm đang hoạt động trên tuyến của chuyến xe đã chọn.
                        </p>
                        {routePointsLoading ? (
                          <p role="status" className="mt-3 text-sm text-slate-500">
                            Đang tải danh sách điểm gửi và điểm nhận...
                          </p>
                        ) : routePointsError ? (
                          <p role="alert" className="mt-3 text-sm font-semibold text-rose-700">
                            {routePointsError}
                          </p>
                        ) : (
                          <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                            <label className="block">
                              <span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">
                                Điểm gửi <span className="text-rose-500">*</span>
                              </span>
                              <select
                                value={senderPointId ?? ''}
                                onChange={(event) => {
                                  const nextId = Number(event.target.value) || null;
                                  setSenderPointId(nextId);
                                  if (nextId === receiverPointId) {
                                    setReceiverPointId(null);
                                  }
                                }}
                                disabled={!routePoints?.senderPoints.length}
                                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 focus:border-orange-500 focus:outline-none disabled:bg-slate-50"
                              >
                                <option value="">Chọn điểm gửi</option>
                                {routePoints?.senderPoints.map((point) => (
                                  <option key={point.id} value={point.id}>
                                    {point.name} — {point.address}
                                  </option>
                                ))}
                              </select>
                              {!routePoints?.senderPoints.length && (
                                <span className="mt-1 block text-xs text-amber-700">
                                  Chuyến xe chưa có điểm gửi hàng đang hoạt động.
                                </span>
                              )}
                            </label>
                            <label className="block">
                              <span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">
                                Điểm nhận <span className="text-rose-500">*</span>
                              </span>
                              <select
                                value={receiverPointId ?? ''}
                                onChange={(event) =>
                                  setReceiverPointId(Number(event.target.value) || null)
                                }
                                disabled={!routePoints?.receiverPoints.length}
                                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 focus:border-orange-500 focus:outline-none disabled:bg-slate-50"
                              >
                                <option value="">Chọn điểm nhận</option>
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
                              {!routePoints?.receiverPoints.length && (
                                <span className="mt-1 block text-xs text-amber-700">
                                  Chuyến xe chưa có điểm nhận hàng đang hoạt động.
                                </span>
                              )}
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
                          Thông tin kiện hàng {cargoItems.length > 1 ? `(${cargoItems.length} kiện)` : ''}
                        </h2>
                      </div>
                      <p className="text-xs text-slate-400 mb-5 pl-8.5">
                        Khai báo chính xác giúp nhà xe bảo quản hàng và tính cước chuẩn xác
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
                                    onClick={() => handleRemoveCargoItem(item.id)}
                                    className="text-xs text-rose-500 hover:text-rose-700 font-bold flex items-center gap-1 px-2 py-1 rounded hover:bg-rose-50 cursor-pointer transition-colors"
                                    title="Xóa kiện này"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" /> Xóa kiện
                                  </button>
                                </div>
                              )}

                              {/* Tên hàng hóa */}
                              <label className="block">
                                <span className="text-xs font-bold text-slate-700">
                                  Tên hàng hóa {isMulti ? `(Kiện #${index + 1})` : ''} <span className="text-rose-500">*</span>
                                </span>
                                <input
                                  type="text"
                                  value={item.name}
                                  onChange={(e) =>
                                    handleUpdateCargoItem(item.id, 'name', e.target.value)
                                  }
                                  placeholder={
                                    index === 0
                                      ? 'Ví dụ: Thùng hoa quả, tài liệu, quần áo...'
                                      : `Ví dụ: Kiện hàng số ${index + 1}...`
                                  }
                                  className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-semibold outline-none focus:border-accent bg-white text-slate-800"
                                />
                              </label>

                              {/* Lưới: Danh mục (50%), Số lượng (25%), Khối lượng (25%) */}
                              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                {/* Danh mục loại hàng hóa */}
                                <label className="block md:col-span-6">
                                  <span className="text-xs font-bold text-slate-700">
                                    Danh mục hàng hóa <span className="text-rose-500">*</span>
                                  </span>
                                  {cargoCategoriesLoading ? (
                                    <p role="status" className="mt-2 text-xs text-slate-500">
                                      Đang tải danh mục loại hàng...
                                    </p>
                                  ) : cargoCategoriesError ? (
                                    <p role="alert" className="mt-2 text-xs font-semibold text-rose-700">
                                      {cargoCategoriesError}
                                    </p>
                                  ) : (
                                    <div className="relative mt-1">
                                      <select
                                        aria-label={index === 0 ? 'Loại hàng hóa' : `Loại hàng hóa kiện #${index + 1}`}
                                        value={item.categoryId ?? ''}
                                        onChange={(e) => {
                                          const val = e.target.value ? Number(e.target.value) : undefined;
                                          handleUpdateCargoItem(item.id, 'categoryId', val);
                                        }}
                                        className="h-10 w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 pr-9 text-sm font-semibold text-slate-800 outline-none focus:border-accent cursor-pointer"
                                      >
                                        <option value="">-- Chọn danh mục --</option>
                                        {cargoCategories.map((category) => (
                                          <option key={category.categoryId} value={category.categoryId}>
                                            {formatCategoryName(category.name)}
                                          </option>
                                        ))}
                                      </select>
                                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    </div>
                                  )}
                                </label>

                                {/* Số lượng */}
                                <label className="block md:col-span-3">
                                  <span className="text-xs font-bold text-slate-700">Số lượng kiện</span>
                                  <input
                                    type="number"
                                    min="1"
                                    className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-semibold outline-none focus:border-accent bg-white text-slate-800"
                                    value={item.quantity}
                                    onChange={(e) =>
                                      handleUpdateCargoItem(
                                        item.id,
                                        'quantity',
                                        Math.max(1, parseInt(e.target.value, 10) || 1),
                                      )
                                    }
                                  />
                                </label>

                                {/* Khối lượng ước tính (kg) */}
                                <label className="block md:col-span-3">
                                  <span className="text-xs font-bold text-slate-700">
                                    Khối lượng (kg)
                                  </span>
                                  <input
                                    type="number"
                                    min="0"
                                    className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-semibold outline-none focus:border-accent bg-white text-slate-800"
                                    value={item.weight || ''}
                                    onChange={(e) =>
                                      handleUpdateCargoItem(
                                        item.id,
                                        'weight',
                                        Math.max(0, parseFloat(e.target.value) || 0),
                                      )
                                    }
                                    placeholder="Ví dụ: 15"
                                  />
                                </label>
                              </div>

                              {/* Kích thước kiện hàng (cm) */}
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-bold text-slate-700">
                                    Kích thước (cm) <span className="font-normal text-slate-400">(Không bắt buộc – nhập nếu hàng cồng kềnh)</span>
                                  </span>
                                  {Number(item.length) > 0 && Number(item.width) > 0 && Number(item.height) > 0 ? (
                                    <span className="text-[11px] font-semibold text-[#0060c4]">
                                      Quy đổi: {Number(((Number(item.length) * Number(item.width) * Number(item.height)) / 5000).toFixed(2))} kg
                                    </span>
                                  ) : null}
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                  <input
                                    type="number"
                                    min="1"
                                    placeholder="Dài (cm)"
                                    className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-semibold outline-none focus:border-accent bg-white text-slate-800"
                                    value={item.length}
                                    onChange={(e) => handleUpdateCargoItem(item.id, 'length', e.target.value)}
                                  />
                                  <input
                                    type="number"
                                    min="1"
                                    placeholder="Rộng (cm)"
                                    className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-semibold outline-none focus:border-accent bg-white text-slate-800"
                                    value={item.width}
                                    onChange={(e) => handleUpdateCargoItem(item.id, 'width', e.target.value)}
                                  />
                                  <input
                                    type="number"
                                    min="1"
                                    placeholder="Cao (cm)"
                                    className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-semibold outline-none focus:border-accent bg-white text-slate-800"
                                    value={item.height}
                                    onChange={(e) => handleUpdateCargoItem(item.id, 'height', e.target.value)}
                                  />
                                </div>
                                {(item.length.trim() || item.width.trim() || item.height.trim()) &&
                                  !(Number(item.length) > 0 && Number(item.width) > 0 && Number(item.height) > 0) && (
                                    <p className="mt-1.5 text-[11px] text-amber-600 font-semibold">
                                      Vui lòng nhập đủ cả 3 chiều Dài, Rộng, Cao để tính khối lượng quy đổi (hoặc để trống cả 3 ô).
                                    </p>
                                  )}
                              </div>

                              {/* Dịch vụ bảo quản & Ghi chú riêng từng kiện */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <label className="block">
                                  <span className="text-xs font-bold text-slate-700">Dịch vụ bảo quản</span>
                                  <div className="relative mt-1">
                                    <select
                                      aria-label={index === 0 ? 'Dịch vụ bảo quản' : `Dịch vụ bảo quản kiện #${index + 1}`}
                                      className="h-10 w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 pr-9 text-sm font-semibold text-slate-800 outline-none focus:border-accent cursor-pointer"
                                      value={item.serviceType}
                                      onChange={(e) =>
                                        handleUpdateCargoItem(
                                          item.id,
                                          'serviceType',
                                          e.target.value as 'normal' | 'fragile' | 'valuable',
                                        )
                                      }
                                    >
                                      <option value="normal">Hàng thường</option>
                                      <option value="fragile">Dễ vỡ (+20.000đ phụ phí)</option>
                                      <option value="valuable">Giá trị cao (+50.000đ phụ phí)</option>
                                    </select>
                                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                  </div>
                                </label>

                                <label className="block">
                                  <span className="text-xs font-bold text-slate-700">
                                    Lưu ý riêng kiện này
                                  </span>
                                  <input
                                    type="text"
                                    aria-label={index === 0 ? 'Lưu ý kiện' : `Lưu ý kiện #${index + 1}`}
                                    className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-semibold outline-none focus:border-accent bg-white text-slate-800"
                                    value={item.note}
                                    onChange={(e) => handleUpdateCargoItem(item.id, 'note', e.target.value)}
                                    placeholder="Ví dụ: Để đứng, tránh va đập..."
                                  />
                                </label>
                              </div>
                            </div>
                          );
                        })}

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
                              Ghi chú vận chuyển & giao nhận <span className="font-normal text-slate-400">(Chung cho toàn đơn)</span>
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
                        <div className="bg-amber-50/70 rounded-xl p-4 text-xs text-amber-900 border border-amber-200/50 flex items-start gap-2.5">
                          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div className="leading-relaxed">
                            <strong>Quy định giao nhận:</strong> Người gửi tự mang kiện hàng ra bến xe trước giờ xe chạy 15–30 phút. Người nhận mang CCCD/SĐT ra bến xe đích để nhận hàng. Nhà xe không nhận vận chuyển hàng cấm, vũ khí, chất cháy nổ.
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
                          DỰ TÍNH CƯỚC PHÍ · VẬN ĐƠN
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-xl font-black">{origin}</div>
                            <div className="text-[11px] text-slate-400">Nơi gửi</div>
                          </div>

                          <div className="flex items-center px-4 flex-1 max-w-[120px] justify-center">
                            <div className="w-full border-t border-dashed border-slate-500"></div>
                          </div>

                          <div className="text-right">
                            <div className="text-xl font-black">{destination}</div>
                            <div className="text-[11px] text-slate-400">Nơi nhận</div>
                          </div>
                        </div>

                        {/* Mini selected trip card */}
                        {selectedTrip && (
                          <div className="mt-4 p-2.5 rounded-xl bg-white/10 border border-white/10 flex items-center gap-2.5">
                            <div className="w-6 h-6 rounded-md bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                              {selectedTrip.busCompany.name.charAt(0)}
                            </div>
                            <div className="text-xs">
                              <div className="font-extrabold">{selectedTrip.busCompany.name}</div>
                              <div className="text-[11px] text-slate-300">
                                Khởi hành {formatIsoTime(selectedTrip.departureTime)} · {date}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Card Body pricing details */}
                      <div className="p-5 space-y-3 text-sm">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-500">
                            Cước vận chuyển ({calculatedPricing.totalWeight} kg
                            {cargoItems.length > 1
                              ? ` • ${cargoItems.reduce((acc, i) => acc + (Number(i.quantity) || 1), 0)} kiện`
                              : ''}
                            )
                          </span>
                          <span className="font-bold text-slate-900">
                            {calculatedPricing.baseFee.toLocaleString('vi-VN')}đ
                          </span>
                        </div>

                        {hasFragile && calculatedPricing.fragileFee > 0 && (
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-500">Phí hàng dễ vỡ</span>
                            <span className="font-bold text-slate-900">
                              +{calculatedPricing.fragileFee.toLocaleString('vi-VN')}đ
                            </span>
                          </div>
                        )}

                        {hasValuable && calculatedPricing.valuableFee > 0 && (
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-500">Phí hàng giá trị cao</span>
                            <span className="font-bold text-slate-900">
                              +{calculatedPricing.valuableFee.toLocaleString('vi-VN')}đ
                            </span>
                          </div>
                        )}

                        <div className="pt-3 border-t border-slate-100 flex items-baseline justify-between">
                          <span className="text-sm font-extrabold text-slate-900">Tổng cước phí:</span>
                          <span className="text-xl font-black text-[#EF4444]">
                            {calculatedPricing.totalFee.toLocaleString('vi-VN')}đ
                          </span>
                        </div>
                        <p className="text-xs leading-relaxed text-slate-500">
                          Cước được tính theo bậc khối lượng quy chuẩn (từ 30.000đ) và xác thực lại khi tạo vận đơn.
                        </p>

                        {/* Progress */}
                        <div className="pt-3">
                          <div className="flex justify-between items-center text-xs mb-1">
                            <span className="text-slate-400">Hoàn thiện thông tin</span>
                            <span className="font-bold text-slate-600">
                              {[
                                selectedTripId,
                                senderName.trim(),
                                senderPhone.trim(),
                                receiverName.trim(),
                                cargoItems[0]?.name.trim(),
                              ].filter(Boolean).length}
                              /5
                            </span>
                          </div>

                          <button
                            onClick={handleCreateShipment}
                            disabled={isSubmitting}
                            className="w-full h-12 mt-3 bg-[#FF7D42] hover:bg-[#F06A2D] text-white font-extrabold rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed text-sm cursor-pointer"
                          >
                            <span>{isSubmitting ? 'Đang tạo...' : 'Tạo mã vận đơn'}</span>
                            <ArrowRight className="w-4 h-4" />
                          </button>

                          <p className="text-[11px] text-center text-slate-400 mt-2.5 leading-tight">
                            Sau khi tạo, mang kiện hàng ra bến xe gửi trước giờ xuất bến.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Bottom feature trust badges */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3.5 bg-white rounded-xl border border-slate-200">
                        <ShieldCheck className="w-5 h-5 text-orange-500 mb-1" />
                        <div className="font-extrabold text-slate-900 text-xs">An toàn</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Hỗ trợ bảo hiểm hàng giá trị cao
                        </div>
                      </div>

                      <div className="p-3.5 bg-white rounded-xl border border-slate-200">
                        <Clock className="w-5 h-5 text-orange-500 mb-1" />
                        <div className="font-extrabold text-slate-900 text-xs">Giao trong ngày</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Nhận hàng sau 24h – 48h
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
                <Search className="w-5 h-5 text-[#0060c4]" /> Tra cứu trạng thái đơn gửi hàng
              </h2>
              <p className="text-xs text-slate-500 mb-6">
                Nhập mã vận đơn (VD: FUTA-VD-...) và số điện thoại người gửi hoặc người nhận để xem chi tiết bến nhận và trạng thái đơn hàng.
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
                    Mã vận đơn <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={lookupCode}
                    onChange={(e) => setLookupCode(e.target.value.toUpperCase())}
                    placeholder="VD: FUTA-VD-09102026..."
                    className="w-full h-11 px-4 rounded-xl border border-slate-300 focus:outline-none focus:border-[#0060c4] font-semibold text-slate-800 uppercase"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1.5">
                    Số điện thoại người gửi hoặc người nhận <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={lookupPhone}
                    onChange={(e) => setLookupPhone(e.target.value)}
                    placeholder="09xxxxxxxx"
                    className="w-full h-11 px-4 rounded-xl border border-slate-300 focus:outline-none focus:border-[#0060c4] font-semibold text-slate-800"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLookingUp}
                  className="w-full h-11 bg-[#0060c4] text-white font-bold rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                >
                  <Search className="w-4 h-4" />
                  {isLookingUp ? 'Đang tra cứu...' : 'Tra cứu vận đơn'}
                </button>
              </form>
            </div>

            {/* KẾT QUẢ TRA CỨU */}
            {lookupResult && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-5 animate-in fade-in duration-300">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
                  <div>
                    <span className="text-xs font-bold text-slate-400 uppercase">Mã vận đơn</span>
                    <div className="text-xl font-black text-[#0060c4]">{lookupResult.waybillCode}</div>
                  </div>
                  <div>
                    <span
                      className={`px-3 py-1 text-xs font-black rounded-full ${
                        lookupResult.status === 'DA_GIAO'
                          ? 'bg-emerald-100 text-emerald-700'
                          : lookupResult.status === 'DANG_VAN_CHUYEN'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {lookupResult.status === 'MOI_TAO'
                        ? 'Chờ mang hàng ra bến'
                        : lookupResult.status === 'DA_TIEP_NHAN'
                          ? 'Đã tiếp nhận tại bến'
                          : lookupResult.status === 'DANG_VAN_CHUYEN'
                            ? 'Đang vận chuyển'
                            : lookupResult.status === 'DA_GIAO'
                              ? 'Đã giao thành công'
                              : lookupResult.status}
                    </span>
                  </div>
                </div>

                {/* Điểm giao & nhận */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <span className="font-bold text-slate-500 uppercase block mb-1">Điểm gửi</span>
                    <div className="font-extrabold text-slate-900">{lookupResult.pickupPoint.name}</div>
                    <div className="text-slate-600 mt-0.5">{lookupResult.pickupPoint.address}</div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl">
                    <span className="font-bold text-slate-500 uppercase block mb-1">Điểm nhận</span>
                    <div className="font-extrabold text-slate-900">{lookupResult.dropoffPoint.name}</div>
                    <div className="text-slate-600 mt-0.5">{lookupResult.dropoffPoint.address}</div>
                  </div>
                </div>

                {/* Chuyến xe */}
                <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 text-xs">
                  <div>
                    <span className="text-slate-500">Chuyến xe vận chuyển:</span>
                    <div className="font-bold text-slate-900">
                      {lookupResult.carrier.name} • {lookupResult.route.origin} → {lookupResult.route.destination}
                    </div>
                    <div className="text-slate-500 mt-0.5">
                      Khởi hành: {formatIsoTime(lookupResult.scheduledDepartureAt)} ngày {formatIsoDate(lookupResult.scheduledDepartureAt)}
                    </div>
                  </div>
                  {lookupResult.estimatedArrivalAt && (
                    <div className="mt-1 text-slate-500">
                      Dự kiến đến: {formatIsoTime(lookupResult.estimatedArrivalAt)} ngày {formatIsoDate(lookupResult.estimatedArrivalAt)}
                    </div>
                  )}
                </div>

                <div className="text-xs text-slate-600">
                  Số kiện hàng:{' '}
                  <strong className="text-slate-900">
                    {lookupResult.packageCount} kiện
                  </strong>
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

                {/* Timeline */}
                {lookupResult.timeline && lookupResult.timeline.length > 0 && (
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase block mb-2">Lịch sử xử lý:</span>
                    <div className="space-y-2 border-l-2 border-slate-200 ml-2 pl-3">
                      {lookupResult.timeline.map((log) => (
                        <div key={`${log.status}-${log.time}`} className="text-xs">
                          <span className="font-bold text-slate-800">
                            {log.status === 'MOI_TAO'
                              ? 'Tạo đơn gửi hàng'
                              : log.status === 'DA_TIEP_NHAN'
                                ? 'Tiếp nhận hàng tại quầy bến xe'
                                : log.status === 'DANG_VAN_CHUYEN'
                                  ? 'Xe đang lăn bánh chở hàng'
                                  : log.status === 'DA_GIAO'
                                    ? 'Đã trả hàng cho người nhận'
                                    : log.status}
                          </span>
                          <span className="text-slate-400 ml-2">({formatIsoTime(log.time)} {formatIsoDate(log.time)})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Modal Hướng dẫn gửi hàng */}
        {showGuideModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl relative">
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="absolute right-4 top-4 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
              <h3 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2">
                <PackageCheck className="w-5 h-5 text-brand" />
                Hướng dẫn gửi hàng liên tỉnh
              </h3>
              <div className="space-y-3.5 text-sm text-slate-600">
                <div className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-50 text-brand font-bold text-xs flex items-center justify-center shrink-0">1</span>
                  <div>
                    <strong className="text-slate-900 block">Chọn tuyến & nhà xe:</strong>
                    Chọn nơi gửi, nơi nhận và ngày gửi phù hợp. Chọn nhà xe vận chuyển trong danh sách.
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-50 text-brand font-bold text-xs flex items-center justify-center shrink-0">2</span>
                  <div>
                    <strong className="text-slate-900 block">Nhập thông tin người gửi & nhận:</strong>
                    Điền chính xác họ tên và số điện thoại để nhà xe liên hệ khi nhận/giao hàng.
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-50 text-brand font-bold text-xs flex items-center justify-center shrink-0">3</span>
                  <div>
                    <strong className="text-slate-900 block">Khai báo kiện hàng & dịch vụ:</strong>
                    Chọn loại hàng, trọng lượng và tùy chọn hàng dễ vỡ / giá trị cao nếu cần bảo hiểm.
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-50 text-brand font-bold text-xs flex items-center justify-center shrink-0">4</span>
                  <div>
                    <strong className="text-slate-900 block">Tạo vận đơn & thanh toán:</strong>
                    Kiểm tra dự tính cước phí và nhấn Tạo mã vận đơn để chuyển sang bước thanh toán.
                  </div>
                </div>
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowGuideModal(false)}
                  className="px-5 py-2.5 rounded-xl bg-brand text-white font-bold text-sm hover:bg-brand/90 transition-colors cursor-pointer"
                >
                  Đã hiểu
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Thông Báo Thiếu Thông Tin */}
        {missingFieldsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl relative">
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
                  Thông tin chưa hoàn tất
                </h3>
              </div>
              <p className="text-xs text-slate-600 mb-5 leading-relaxed">
                Vui lòng điền đầy đủ các thông tin bắt buộc trước khi tạo mã vận đơn.
              </p>
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
      </div>
    </div>
  );
}

export default function SendFreightPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Gửi hàng theo nhà xe - Đang tải...</div>}>
      <SendFreightContent />
    </Suspense>
  );
}
