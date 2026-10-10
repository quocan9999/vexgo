/* eslint-disable */
'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
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
  Building2,
  QrCode,
  RotateCcw,
  Minus,
  Plus,
  ArrowLeftRight,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { tripsApi, type ApiTrip } from '@/features/trips/services/trips.api';
import {
  shipmentsApi,
  type ShipmentResponseData,
} from '@/features/shipments/services/shipments.api';
import { PAYMENT_DRAFT_STORAGE_PREFIX } from '@/features/booking/services/payment-draft';

const POPULAR_LOCATIONS = ['TP.HCM', 'Đà Lạt', 'Vũng Tàu', 'Nha Trang'];

const CARGO_CATEGORIES = [
  'Bưu phẩm',
  'Thực phẩm',
  'Điện tử',
  'Quần áo',
  'Hàng gia dụng',
  'Hàng dễ vỡ',
  'Giá trị cao',
];

function SendFreightContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Tab: 'create' | 'lookup'
  const [activeTab, setActiveTab] = useState<'create' | 'lookup'>('create');

  // Tuyến & Chuyến
  const [origin, setOrigin] = useState<string>('Đà Lạt');
  const [destination, setDestination] = useState<string>('TP.HCM');
  const [date, setDate] = useState<string>('2026-10-20');
  const [trips, setTrips] = useState<ApiTrip[]>([]);
  const [loadingTrips, setLoadingTrips] = useState<boolean>(false);
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>('all');
  const [selectedTimeFilter, setSelectedTimeFilter] = useState<string>('all'); // 'all' | 'morning' | 'afternoon' | 'evening' | 'night'
  const [selectedPriceSort, setSelectedPriceSort] = useState<string>('default'); // 'default' | 'asc' | 'desc'

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

  // Danh sách chuyến xe sau khi áp dụng bộ lọc nhà xe, khung giờ và sắp xếp giá
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

    // 3. Sắp xếp theo giá cước (dựa trên price của chuyến nếu có hoặc mặc định)
    if (selectedPriceSort === 'asc') {
      result.sort((a, b) => (Number(a.price) || 50000) - (Number(b.price) || 50000));
    } else if (selectedPriceSort === 'desc') {
      result.sort((a, b) => (Number(b.price) || 50000) - (Number(a.price) || 50000));
    }

    return result;
  }, [trips, selectedCompanyFilter, selectedTimeFilter, selectedPriceSort]);

  // Người gửi
  const [senderName, setSenderName] = useState<string>('');
  const [senderPhone, setSenderPhone] = useState<string>('');
  const [senderEmail, setSenderEmail] = useState<string>('');

  // Người nhận
  const [receiverName, setReceiverName] = useState<string>('');
  const [receiverPhone, setReceiverPhone] = useState<string>('');

  // Kiện hàng
  const [cargoCategories, setCargoCategories] = useState<
    Array<{ categoryId: number; name: string; description: string }>
  >([]);
  const [cargoName, setCargoName] = useState<string>('');
  const [cargoCategory, setCargoCategory] = useState<string>('Bưu phẩm');
  const [quantity, setQuantity] = useState<number>(1);
  const [weight, setWeight] = useState<number>(5);
  const [length, setLength] = useState<string>('');
  const [width, setWidth] = useState<string>('');
  const [height, setHeight] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [isFragile, setIsFragile] = useState<boolean>(false);
  const [isValuable, setIsValuable] = useState<boolean>(false);

  // Tải danh mục loại hàng hóa từ API
  useEffect(() => {
    let isMounted = true;
    shipmentsApi
      .getCargoCategories()
      .then((res) => {
        if (isMounted && res.data && res.data.length > 0) {
          setCargoCategories(res.data);
          if (!cargoCategory) {
            setCargoCategory(res.data[0].name);
          }
        }
      })
      .catch(() => {
        // Fallback giữ nguyên CARGO_CATEGORIES mặc định nếu có lỗi
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Trạng thái xử lý tạo đơn
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdShipment, setCreatedShipment] = useState<ShipmentResponseData | null>(null);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Tra cứu vận đơn
  const [lookupCode, setLookupCode] = useState<string>('');
  const [lookupPhone, setLookupPhone] = useState<string>('');
  const [isLookingUp, setIsLookingUp] = useState<boolean>(false);
  const [lookupResult, setLookupResult] = useState<ShipmentResponseData | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Khởi tạo params từ URL nếu có
  useEffect(() => {
    if (searchParams) {
      if (searchParams.get('from')) setOrigin(searchParams.get('from') as string);
      if (searchParams.get('to')) setDestination(searchParams.get('to') as string);
      if (searchParams.get('date')) setDate(searchParams.get('date') as string);
      if (searchParams.get('tab') === 'lookup') setActiveTab('lookup');
      if (searchParams.get('code')) setLookupCode(searchParams.get('code') as string);
      if (searchParams.get('phone')) setLookupPhone(searchParams.get('phone') as string);
    }
  }, [searchParams]);

  // Tự động tải danh sách chuyến xe khi thay đổi tuyến hoặc ngày
  useEffect(() => {
    let isCancelled = false;
    async function fetchTrips() {
      setLoadingTrips(true);
      setSelectedTripId(null);
      try {
        const res = await tripsApi.searchTrips({
          from: origin,
          to: destination,
          departureDate: date,
        });
        if (!isCancelled) {
          const loadedTrips = res.data || [];
          setTrips(loadedTrips);
          if (loadedTrips.length > 0) {
            setSelectedTripId(loadedTrips[0].id);
          }
        }
      } catch (err) {
        if (!isCancelled) {
          setTrips([]);
        }
      } finally {
        if (!isCancelled) {
          setLoadingTrips(false);
        }
      }
    }

    if (origin && destination) {
      fetchTrips();
    }
    return () => {
      isCancelled = true;
    };
  }, [origin, destination, date]);

  // Tính cước phí dự kiến
  const calculatedPricing = useMemo(() => {
    let base = 50000;
    const safeWeight = Math.max(1, Number(weight) || 1);
    const safeQty = Math.max(1, Number(quantity) || 1);
    const totalWeight = safeWeight * safeQty;

    if (totalWeight > 5) {
      base += Math.ceil(totalWeight - 5) * 10000;
    }

    let service = 0;
    if (isFragile || cargoCategory === 'Hàng dễ vỡ') service += 20000;
    if (isValuable || cargoCategory === 'Giá trị cao') service += 50000;

    return {
      baseFee: base,
      serviceFee: service,
      totalFee: base + service,
      totalWeight,
    };
  }, [weight, quantity, isFragile, isValuable, cargoCategory]);

  const selectedTrip = useMemo(() => {
    return trips.find((t) => t.id === selectedTripId) || null;
  }, [trips, selectedTripId]);

  // Xử lý tạo mã vận đơn
  const handleCreateShipment = async () => {
    setErrorMessage(null);

    if (!selectedTripId) {
      setErrorMessage('Vui lòng chọn một chuyến xe vận chuyển hàng.');
      return;
    }

    if (!senderName.trim()) {
      setErrorMessage('Vui lòng nhập họ và tên người gửi.');
      return;
    }

    if (!senderPhone.trim()) {
      setErrorMessage('Vui lòng nhập số điện thoại người gửi.');
      return;
    }

    if (!receiverName.trim()) {
      setErrorMessage('Vui lòng nhập họ và tên người nhận.');
      return;
    }

    if (!receiverPhone.trim()) {
      setErrorMessage('Vui lòng nhập số điện thoại người nhận.');
      return;
    }

    if (!cargoName.trim()) {
      setErrorMessage('Vui lòng nhập tên món hàng/kiện hàng.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        tripId: selectedTripId,
        sender: {
          fullName: senderName.trim(),
          phoneNumber: senderPhone.trim(),
          email: senderEmail.trim() || undefined,
        },
        receiver: {
          fullName: receiverName.trim(),
          phoneNumber: receiverPhone.trim(),
        },
        items: [
          {
            name: cargoName.trim(),
            category: cargoCategory,
            quantity: Math.max(1, Number(quantity) || 1),
            weight: Math.max(0.5, Number(weight) || 1),
            length: length ? Number(length) : undefined,
            width: width ? Number(width) : undefined,
            height: height ? Number(height) : undefined,
            note: note.trim() || undefined,
          },
        ],
        isFragile: isFragile || cargoCategory === 'Hàng dễ vỡ',
        isValuable: isValuable || cargoCategory === 'Giá trị cao',
        note: note.trim() || undefined,
      };

      const res = await shipmentsApi.createShipment(payload);
      const data = res.data;
      setCreatedShipment(data);

      // Lưu draft để tiện chuyển sang thanh toán trực tuyến VietQR nếu muốn
      try {
        const draftId = `draft-${Date.now()}`;
        const paymentDraft = {
          bookingId: data.shipmentId,
          orderId: data.orderId,
          bookingCode: data.waybillCode,
          orderCode: data.orderCode,
          totalFare: data.pricing.totalFee,
          seatNumbers: [],
          ticketCount: 1,
          pickup: data.pickupPoint.name,
          dropoff: data.dropoffPoint.name,
          route: `${data.trip.route.origin} → ${data.trip.route.destination}`,
          busCompanyName: data.trip.busCompany.name,
          departureTime: data.trip.departureTime,
          passenger: {
            fullName: data.sender.fullName,
            phoneNumber: data.sender.phoneNumber,
            email: data.sender.email || '',
          },
        };
        sessionStorage.setItem(
          `${PAYMENT_DRAFT_STORAGE_PREFIX}${draftId}`,
          JSON.stringify(paymentDraft),
        );
      } catch {
        // bỏ qua nếu storage lỗi
      }

      window.scrollTo({ top: 0, behavior: 'smooth' });
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
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                  <div className="flex items-center gap-2.5 mb-5">
                    <div className="w-6 h-6 rounded-full bg-[#EF4444] text-white flex items-center justify-center text-xs font-bold">
                      1
                    </div>
                    <h2 className="text-base font-extrabold text-slate-900">
                      Chọn tuyến & ngày gửi
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                    <div className="md:col-span-5">
                      <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">
                        Điểm đi (Nơi gửi)
                      </label>
                      <div className="relative">
                        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 border-rose-500"></div>
                        <select
                          value={origin}
                          onChange={(e) => setOrigin(e.target.value)}
                          className="w-full h-12 pl-9 pr-8 rounded-xl border border-slate-200 hover:border-slate-300 focus:outline-none focus:border-[#EF4444] font-bold text-slate-800 bg-white appearance-none cursor-pointer text-sm"
                        >
                          {POPULAR_LOCATIONS.map((loc) => (
                            <option key={`from-${loc}`} value={loc}>
                              {loc}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="md:col-span-1 flex justify-center pb-1">
                      <button
                        type="button"
                        onClick={handleSwapLocations}
                        className="w-10 h-10 rounded-full border border-slate-200 hover:bg-slate-50 flex items-center justify-center text-amber-600 transition-colors shadow-2xs"
                        title="Đổi chiều tuyến"
                      >
                        <ArrowLeftRight className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="md:col-span-3">
                      <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">
                        Điểm đến (Nơi nhận)
                      </label>
                      <div className="relative">
                        <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500" />
                        <select
                          value={destination}
                          onChange={(e) => setDestination(e.target.value)}
                          className="w-full h-12 pl-9 pr-8 rounded-xl border border-slate-200 hover:border-slate-300 focus:outline-none focus:border-[#EF4444] font-bold text-slate-800 bg-white appearance-none cursor-pointer text-sm"
                        >
                          {POPULAR_LOCATIONS.map((loc) => (
                            <option key={`to-${loc}`} value={loc} disabled={loc === origin}>
                              {loc}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="md:col-span-3">
                      <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">
                        Ngày gửi
                      </label>
                      <div className="relative">
                        <input
                          type="date"
                          value={date}
                          onChange={(e) => setDate(e.target.value)}
                          className="w-full h-12 px-3.5 rounded-xl border border-slate-200 hover:border-slate-300 focus:outline-none focus:border-[#EF4444] font-bold text-slate-800 bg-white text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2 CỘT CHÍNH: FORM NHẬP LIỆU & SIDEBAR DỰ TÍNH CƯỚC */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  <div className="lg:col-span-8 space-y-6">
                    {/* STEP 2: CHỌN NHÀ XE VẬN CHUYỂN */}
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
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
                        {/* CỘT TRÁI: BỘ LỌC (NHÀ XE, GIỜ CHẠY, GIÁ TIỀN) */}
                        <div className="w-full md:w-64 shrink-0 bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80 space-y-4">
                          {/* 1. Lọc Nhà xe */}
                          {availableCompanies.length > 1 && (
                            <div>
                              <div className="text-[11px] font-extrabold text-slate-500 uppercase mb-2 flex items-center justify-between">
                                <span>Nhà xe</span>
                                <span className="text-[10px] text-slate-400 font-normal">
                                  {availableCompanies.length} hãng
                                </span>
                              </div>
                              <div className="flex flex-col gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setSelectedCompanyFilter('all')}
                                  className={`w-full px-3 py-1.5 rounded-xl text-xs font-bold transition-all text-left flex items-center justify-between border ${
                                    selectedCompanyFilter === 'all'
                                      ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                  }`}
                                >
                                  <span>Tất cả</span>
                                  <span
                                    className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                                      selectedCompanyFilter === 'all'
                                        ? 'bg-white/20 text-white'
                                        : 'bg-slate-100 text-slate-500'
                                    }`}
                                  >
                                    {trips.length}
                                  </span>
                                </button>
                                {availableCompanies.map((comp) => {
                                  const count = trips.filter((t) => t.busCompany?.id === comp.id).length;
                                  const isSelected = selectedCompanyFilter === String(comp.id);
                                  return (
                                    <button
                                      type="button"
                                      key={comp.id}
                                      onClick={() => setSelectedCompanyFilter(String(comp.id))}
                                      className={`w-full px-3 py-1.5 rounded-xl text-xs font-bold transition-all text-left flex items-center justify-between border ${
                                        isSelected
                                          ? 'bg-[#0060c4] text-white border-[#0060c4] shadow-2xs'
                                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                      }`}
                                    >
                                      <span className="truncate">{comp.name}</span>
                                      <span
                                        className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                                          isSelected
                                            ? 'bg-white/20 text-white'
                                            : 'bg-slate-100 text-slate-500'
                                        }`}
                                      >
                                        {count}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* 2. Lọc Khung giờ xuất bến */}
                          <div className={availableCompanies.length > 1 ? 'pt-3 border-t border-slate-200/60' : ''}>
                            <div className="text-[11px] font-extrabold text-slate-500 uppercase mb-2">
                              Giờ chạy
                            </div>
                            <div className="flex flex-col gap-1.5">
                              {[
                                { id: 'all', label: 'Tất cả giờ' },
                                { id: 'morning', label: 'Sáng (06:00 – 12:00)' },
                                { id: 'afternoon', label: 'Chiều (12:00 – 18:00)' },
                                { id: 'evening', label: 'Tối (18:00 – 22:00)' },
                                { id: 'night', label: 'Đêm (22:00 – 06:00)' },
                              ].map((slot) => {
                                const isSelected = selectedTimeFilter === slot.id;
                                return (
                                  <button
                                    type="button"
                                    key={slot.id}
                                    onClick={() => setSelectedTimeFilter(slot.id)}
                                    className={`w-full px-3 py-1.5 rounded-xl text-xs font-bold transition-all text-left border ${
                                      isSelected
                                        ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                    }`}
                                  >
                                    {slot.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* 3. Lọc & Sắp xếp Giá tiền */}
                          <div className="pt-3 border-t border-slate-200/60">
                            <div className="text-[11px] font-extrabold text-slate-500 uppercase mb-2">
                              Giá cước
                            </div>
                            <div className="flex flex-col gap-1.5">
                              {[
                                { id: 'default', label: 'Mặc định' },
                                { id: 'asc', label: 'Giá thấp → cao' },
                                { id: 'desc', label: 'Giá cao → thấp' },
                              ].map((sortOption) => {
                                const isSelected = selectedPriceSort === sortOption.id;
                                return (
                                  <button
                                    type="button"
                                    key={sortOption.id}
                                    onClick={() => setSelectedPriceSort(sortOption.id)}
                                    className={`w-full px-3 py-1.5 rounded-xl text-xs font-bold transition-all text-left border ${
                                      isSelected
                                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                    }`}
                                  >
                                    {sortOption.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        {/* CỘT PHẢI: HIỂN THỊ THÔNG TIN CHUYẾN XE */}
                        <div className="flex-1 w-full">
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
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                              {filteredTrips.map((trip) => {
                                const isSelected = selectedTripId === trip.id;
                                const depTime = formatIsoTime(trip.departureTime);

                                // Avatar initials and color
                                const nameUpper = trip.busCompany.name.toUpperCase();
                                const initial = nameUpper.charAt(0) || 'V';
                                const badgeBg =
                                  initial === 'P'
                                    ? 'bg-orange-600'
                                    : initial === 'H'
                                      ? 'bg-emerald-600'
                                      : initial === 'T'
                                        ? 'bg-blue-600'
                                        : 'bg-purple-600';

                                return (
                                  <div
                                    key={trip.id}
                                    onClick={() => setSelectedTripId(trip.id)}
                                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all relative flex flex-col justify-between ${
                                      isSelected
                                        ? 'border-[#3B82F6] bg-white ring-2 ring-blue-100 shadow-sm'
                                        : 'border-slate-200 bg-white hover:border-slate-300'
                                    }`}
                                  >
                                    <div>
                                      <div className="flex items-start justify-between gap-2 mb-3">
                                        <div className="flex items-center gap-2">
                                          <div
                                            className={`w-7 h-7 rounded-lg ${badgeBg} text-white flex items-center justify-center font-black text-xs shrink-0`}
                                          >
                                            {initial}
                                          </div>
                                          <div>
                                            <div className="font-extrabold text-slate-900 text-sm leading-tight">
                                              {trip.busCompany.name}
                                            </div>
                                            <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-semibold mt-0.5">
                                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                              Nhận hàng tại bến
                                            </div>
                                          </div>
                                        </div>

                                        <div className="shrink-0 mt-0.5">
                                          <div
                                            className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all ${
                                              isSelected
                                                ? 'bg-orange-500 border-orange-500 text-white'
                                                : 'border-slate-300 bg-white'
                                            }`}
                                          >
                                            {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                          </div>
                                        </div>
                                      </div>

                                      <div className="mb-3">
                                        <div className="flex items-baseline gap-1.5">
                                          <span className="text-2xl font-black text-slate-900 font-mono tracking-tight">
                                            {depTime}
                                          </span>
                                          <span className="text-xs text-slate-400 font-normal">xuất bến</span>
                                        </div>
                                        <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5">
                                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                                          <span>Trong ngày (24h – 48h)</span>
                                        </div>
                                        <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                                          <MapPin className="w-3.5 h-3.5 text-rose-400" />
                                          <span>Bến {origin}</span>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                                      <span className="text-slate-400">Từ</span>
                                      <span className="font-black text-orange-600">50.000đ</span>
                                    </div>
                                  </div>
                                );
                              })}
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
                    </div>

                    {/* STEP 4: THÔNG TIN KIỆN HÀNG */}
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                      <div className="flex items-center gap-2.5 mb-1">
                        <div className="w-6 h-6 rounded-full bg-[#EF4444] text-white flex items-center justify-center text-xs font-bold">
                          3
                        </div>
                        <h2 className="text-base font-extrabold text-slate-900">
                          Thông tin kiện hàng
                        </h2>
                      </div>
                      <p className="text-xs text-slate-400 mb-5 pl-8.5">
                        Khai báo chính xác để tính cước phí đúng
                      </p>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">
                            Tên hàng hóa <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={cargoName}
                            onChange={(e) => setCargoName(e.target.value)}
                            placeholder="Ví dụ: Thùng hoa quả, tài liệu, quần áo..."
                            className="w-full h-11 px-3.5 rounded-xl border border-slate-200 focus:outline-none focus:border-orange-500 font-medium text-slate-800 bg-slate-50/50 text-sm"
                          />
                        </div>

                        {/* Loại hàng hóa Pill Tags */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 uppercase mb-2">
                            Loại hàng hóa
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {[
                              { label: 'Bưu phẩm', emoji: '📦' },
                              { label: 'Thực phẩm', emoji: '🍎' },
                              { label: 'Quần áo', emoji: '👕' },
                              { label: 'Điện tử', emoji: '💻' },
                              { label: 'Khác', emoji: '📦' },
                            ].map((tag) => {
                              const isSelected = cargoCategory.toLowerCase() === tag.label.toLowerCase();
                              return (
                                <button
                                  type="button"
                                  key={tag.label}
                                  onClick={() => setCargoCategory(tag.label)}
                                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 border ${
                                    isSelected
                                      ? 'bg-slate-900 text-white border-slate-900'
                                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'
                                  }`}
                                >
                                  <span>{tag.emoji}</span>
                                  <span>{tag.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Số kiện & Khối lượng */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">
                              Số kiện
                            </label>
                            <div className="flex items-center h-12 bg-slate-50 border border-slate-200 rounded-xl px-2">
                              <button
                                type="button"
                                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                                className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors"
                              >
                                <Minus className="w-4 h-4" />
                              </button>
                              <span className="flex-1 text-center font-bold text-slate-900 text-sm">
                                {quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => setQuantity((q) => q + 1)}
                                className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">
                              Khối lượng mỗi kiện (kg)
                            </label>
                            <div className="flex items-center h-12 bg-slate-50 border border-slate-200 rounded-xl px-2">
                              <button
                                type="button"
                                onClick={() => setWeight((w) => Math.max(1, w - 1))}
                                className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors"
                              >
                                <Minus className="w-4 h-4" />
                              </button>
                              <span className="flex-1 text-center font-bold text-slate-900 text-sm">
                                {weight}
                              </span>
                              <button
                                type="button"
                                onClick={() => setWeight((w) => w + 1)}
                                className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>

                            {/* Preset kg pills */}
                            <div className="flex gap-1.5 mt-2">
                              {[1, 5, 10, 20].map((presetKg) => (
                                <button
                                  type="button"
                                  key={presetKg}
                                  onClick={() => setWeight(presetKg)}
                                  className={`px-2.5 py-0.5 rounded text-[11px] font-semibold border ${
                                    weight === presetKg
                                      ? 'bg-slate-900 text-white border-slate-900'
                                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                  }`}
                                >
                                  {presetKg}kg
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Kích thước (tùy chọn) */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">
                            Kích thước <span className="font-normal lowercase text-slate-400">(tùy chọn)</span>
                          </label>
                          <div className="grid grid-cols-3 gap-3">
                            <div className="relative">
                              <input
                                type="number"
                                min="1"
                                value={length}
                                onChange={(e) => setLength(e.target.value)}
                                placeholder="Dài"
                                className="w-full h-11 px-3.5 pr-8 rounded-xl border border-slate-200 focus:outline-none focus:border-slate-400 text-slate-800 bg-slate-50/50 text-sm"
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                                cm
                              </span>
                            </div>

                            <div className="relative">
                              <input
                                type="number"
                                min="1"
                                value={width}
                                onChange={(e) => setWidth(e.target.value)}
                                placeholder="Rộng"
                                className="w-full h-11 px-3.5 pr-8 rounded-xl border border-slate-200 focus:outline-none focus:border-slate-400 text-slate-800 bg-slate-50/50 text-sm"
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                                cm
                              </span>
                            </div>

                            <div className="relative">
                              <input
                                type="number"
                                min="1"
                                value={height}
                                onChange={(e) => setHeight(e.target.value)}
                                placeholder="Cao"
                                className="w-full h-11 px-3.5 pr-8 rounded-xl border border-slate-200 focus:outline-none focus:border-slate-400 text-slate-800 bg-slate-50/50 text-sm"
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                                cm
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Ghi chú hàng hóa */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">
                            Ghi chú hàng hóa
                          </label>
                          <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Ví dụ: hàng trái cây tươi cần gửi sớm, đóng thùng xốp..."
                            className="w-full p-3 rounded-xl border border-slate-200 focus:outline-none focus:border-slate-400 text-sm text-slate-800 bg-slate-50/50 resize-none h-20"
                          />
                        </div>

                        {/* Dịch vụ cộng thêm Toggle Switches */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 uppercase mb-2">
                            Dịch vụ cộng thêm
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div
                              onClick={() => setIsFragile(!isFragile)}
                              className="p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-white flex items-center justify-between cursor-pointer"
                            >
                              <div className="flex items-center gap-2.5">
                                <span className="text-base">🍷</span>
                                <div>
                                  <div className="font-extrabold text-slate-900 text-xs">Hàng dễ vỡ</div>
                                  <div className="text-[11px] font-bold text-orange-600">+20.000đ</div>
                                </div>
                              </div>
                              {/* Toggle switch */}
                              <div
                                className={`w-10 h-5 rounded-full transition-colors relative ${
                                  isFragile ? 'bg-orange-500' : 'bg-slate-200'
                                }`}
                              >
                                <div
                                  className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-0.5 ${
                                    isFragile ? 'left-5.5' : 'left-0.5'
                                  }`}
                                />
                              </div>
                            </div>

                            <div
                              onClick={() => setIsValuable(!isValuable)}
                              className="p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-white flex items-center justify-between cursor-pointer"
                            >
                              <div className="flex items-center gap-2.5">
                                <ShieldCheck className="w-4 h-4 text-slate-700" />
                                <div>
                                  <div className="font-extrabold text-slate-900 text-xs">
                                    Hàng giá trị cao / Bảo hiểm
                                  </div>
                                  <div className="text-[11px] font-bold text-orange-600">+50.000đ</div>
                                </div>
                              </div>
                              {/* Toggle switch */}
                              <div
                                className={`w-10 h-5 rounded-full transition-colors relative ${
                                  isValuable ? 'bg-orange-500' : 'bg-slate-200'
                                }`}
                              >
                                <div
                                  className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-0.5 ${
                                    isValuable ? 'left-5.5' : 'left-0.5'
                                  }`}
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Quy định giao nhận */}
                        <div className="bg-amber-50/70 rounded-xl p-4 text-xs text-amber-900 border border-amber-200/50 flex items-start gap-2.5 mt-2">
                          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div className="leading-relaxed">
                            <strong>Quy định giao nhận:</strong> Người gửi tự mang kiện hàng ra bến xe trước giờ xe chạy 15–30 phút. Người nhận mang CCCD/SĐT ra bến xe đích để nhận hàng. Nhà xe không nhận vận chuyển hàng cấm, vũ khí, chất cháy nổ.
                          </div>
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

                          <div className="flex items-center gap-1.5 px-3">
                            <div className="w-8 border-t border-dashed border-slate-500"></div>
                            <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs">
                              🚌
                            </div>
                            <div className="w-8 border-t border-dashed border-slate-500"></div>
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
                          <span className="text-slate-500">Cước cơ bản (5kg đầu)</span>
                          <span className="font-bold text-slate-900">50.000đ</span>
                        </div>

                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-500">Phụ phí vượt cân</span>
                          <span className="font-bold text-slate-900">
                            {calculatedPricing.totalWeight > 5
                              ? `${((calculatedPricing.totalWeight - 5) * 10000).toLocaleString('vi-VN')}đ`
                              : '0đ'}
                          </span>
                        </div>

                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-500">Hàng dễ vỡ</span>
                          <span className="font-bold text-slate-900">
                            {isFragile || cargoCategory === 'Hàng dễ vỡ' ? '20.000đ' : '0đ'}
                          </span>
                        </div>

                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-500">Bảo hiểm</span>
                          <span className="font-bold text-slate-900">
                            {isValuable || cargoCategory === 'Giá trị cao' ? '50.000đ' : '0đ'}
                          </span>
                        </div>

                        <div className="pt-3 border-t border-slate-100 flex items-baseline justify-between">
                          <span className="text-sm font-extrabold text-slate-900">Tổng cước phí:</span>
                          <span className="text-2xl font-black text-[#EF4444]">
                            {calculatedPricing.totalFee.toLocaleString('vi-VN')}đ
                          </span>
                        </div>

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
                                cargoName.trim(),
                              ].filter(Boolean).length}
                              /5
                            </span>
                          </div>

                          <button
                            onClick={handleCreateShipment}
                            disabled={isSubmitting || !selectedTripId}
                            className="w-full h-12 mt-3 bg-[#FF7D42] hover:bg-[#F06A2D] text-white font-extrabold rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 text-sm cursor-pointer"
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
                    <div className="mt-2 text-slate-500">
                      Người gửi: <strong>{lookupResult.sender.fullName}</strong> ({lookupResult.sender.phoneNumber})
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl">
                    <span className="font-bold text-slate-500 uppercase block mb-1">Điểm nhận</span>
                    <div className="font-extrabold text-slate-900">{lookupResult.dropoffPoint.name}</div>
                    <div className="text-slate-600 mt-0.5">{lookupResult.dropoffPoint.address}</div>
                    <div className="mt-2 text-slate-500">
                      Người nhận: <strong>{lookupResult.receiver.fullName}</strong> ({lookupResult.receiver.phoneNumber})
                    </div>
                  </div>
                </div>

                {/* Chuyến xe */}
                <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 text-xs flex justify-between items-center">
                  <div>
                    <span className="text-slate-500">Chuyến xe vận chuyển:</span>
                    <div className="font-bold text-slate-900">
                      {lookupResult.trip.busCompany.name} • {lookupResult.trip.route.origin} → {lookupResult.trip.route.destination}
                    </div>
                    <div className="text-slate-500 mt-0.5">
                      Khởi hành: {formatIsoTime(lookupResult.trip.departureTime)} ngày {formatIsoDate(lookupResult.trip.departureTime)}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500">Tổng cước phí:</span>
                    <div className="font-black text-rose-600 text-base">
                      {lookupResult.pricing.totalFee.toLocaleString('vi-VN')}đ
                    </div>
                  </div>
                </div>

                {/* Danh sách hàng */}
                <div>
                  <span className="text-xs font-bold text-slate-500 uppercase block mb-2">Kiện hàng đã gửi:</span>
                  <div className="space-y-2">
                    {lookupResult.items.map((item) => (
                      <div key={item.id} className="p-2.5 bg-slate-50 rounded-lg text-xs flex justify-between items-center">
                        <div>
                          <strong className="text-slate-800">{item.name}</strong>
                          <span className="text-slate-500 ml-2">({item.category})</span>
                        </div>
                        <div className="font-semibold text-slate-700">
                          {item.quantity} kiện • {item.weight} kg
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Timeline */}
                {lookupResult.timeline && lookupResult.timeline.length > 0 && (
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase block mb-2">Lịch sử xử lý:</span>
                    <div className="space-y-2 border-l-2 border-slate-200 ml-2 pl-3">
                      {lookupResult.timeline.map((log) => (
                        <div key={log.id} className="text-xs">
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
                          {log.note && <div className="text-slate-500 text-[11px]">{log.note}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
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
