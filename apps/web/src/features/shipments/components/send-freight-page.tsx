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
  const [origin, setOrigin] = useState<string>('TP.HCM');
  const [destination, setDestination] = useState<string>('Đà Lạt');
  const [date, setDate] = useState<string>('2026-10-20');
  const [trips, setTrips] = useState<ApiTrip[]>([]);
  const [loadingTrips, setLoadingTrips] = useState<boolean>(false);
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);

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
    <div className="min-h-screen bg-[#F8FAF9] py-8 font-sans">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        {/* Tiêu đề & Chọn tab */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900">
              Gửi hàng theo nhà xe
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Giao nhận hàng trực tiếp tại bến xe và văn phòng nhà xe. Nhanh chóng, tiết kiệm và an toàn.
            </p>
          </div>

          {/* Switch Tab */}
          <div className="inline-flex p-1 bg-slate-200/80 rounded-xl">
            <button
              onClick={() => {
                setActiveTab('create');
                setCreatedShipment(null);
              }}
              className={`px-4 py-2 text-xs md:text-sm font-bold rounded-lg transition-all ${
                activeTab === 'create'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tạo đơn gửi hàng
            </button>
            <button
              onClick={() => setActiveTab('lookup')}
              className={`px-4 py-2 text-xs md:text-sm font-bold rounded-lg transition-all ${
                activeTab === 'lookup'
                  ? 'bg-white text-[#0060c4] shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tra cứu vận đơn
            </button>
          </div>
        </div>

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
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  {errorMessage && (
                    <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-2xl flex items-start gap-3 text-sm">
                      <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-500" />
                      <div>{errorMessage}</div>
                    </div>
                  )}

                  {/* 1. Tuyến vận chuyển & Chọn chuyến xe */}
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                    <h2 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
                      <div className="bg-rose-100 p-1.5 rounded-full">
                        <MapPin className="w-5 h-5 text-rose-500" />
                      </div>
                      1. Chọn tuyến & Chuyến xe gửi hàng
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div>
                        <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1.5">
                          Điểm đi (Nơi gửi)
                        </label>
                        <select
                          value={origin}
                          onChange={(e) => setOrigin(e.target.value)}
                          className="w-full h-11 px-3 rounded-xl border border-slate-300 focus:outline-none focus:border-brand font-semibold text-slate-800 bg-white"
                        >
                          {POPULAR_LOCATIONS.map((loc) => (
                            <option key={`from-${loc}`} value={loc}>
                              {loc}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1.5">
                          Điểm đến (Nơi nhận)
                        </label>
                        <select
                          value={destination}
                          onChange={(e) => setDestination(e.target.value)}
                          className="w-full h-11 px-3 rounded-xl border border-slate-300 focus:outline-none focus:border-brand font-semibold text-slate-800 bg-white"
                        >
                          {POPULAR_LOCATIONS.map((loc) => (
                            <option key={`to-${loc}`} value={loc} disabled={loc === origin}>
                              {loc}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1.5">
                          Ngày gửi
                        </label>
                        <input
                          type="date"
                          value={date}
                          onChange={(e) => setDate(e.target.value)}
                          className="w-full h-11 px-3 rounded-xl border border-slate-300 focus:outline-none focus:border-brand font-semibold text-slate-800 bg-white"
                        />
                      </div>
                    </div>

                    {/* Danh sách nhà xe & tuyến vận chuyển khả dụng */}
                    <div className="mt-6">
                      <div className="flex justify-between items-center mb-3">
                        <div>
                          <span className="text-sm font-bold text-slate-800">
                            Chọn nhà xe nhận vận chuyển:
                          </span>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Gửi hàng linh hoạt trong ngày theo tuyến đường đã chọn
                          </p>
                        </div>
                        <span className="px-2.5 py-0.5 bg-blue-50 text-[#0060c4] font-bold text-xs rounded-full">
                          {loadingTrips ? 'Đang tìm...' : `${trips.length} lựa chọn`}
                        </span>
                      </div>

                      {loadingTrips ? (
                        <div className="p-8 text-center text-slate-500 text-sm bg-slate-50 rounded-xl">
                          Đang tải danh sách nhà xe nhận hàng...
                        </div>
                      ) : trips.length === 0 ? (
                        <div className="p-6 text-center text-slate-500 text-sm bg-amber-50 rounded-xl border border-amber-200">
                          Chưa có nhà xe nào nhận tuyến này vào ngày đã chọn. Vui lòng chọn ngày khác (ví dụ: ngày 20/10/2026).
                        </div>
                      ) : (
                        <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
                          {trips.map((trip) => {
                            const isSelected = selectedTripId === trip.id;

                            return (
                              <div
                                key={trip.id}
                                onClick={() => setSelectedTripId(trip.id)}
                                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                                  isSelected
                                    ? 'border-[#0060c4] bg-blue-50/40 shadow-sm'
                                    : 'border-slate-200 bg-white hover:border-blue-200'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex items-center gap-3">
                                    <input
                                      type="radio"
                                      name="tripSelect"
                                      checked={isSelected}
                                      onChange={() => setSelectedTripId(trip.id)}
                                      className="w-4 h-4 accent-[#0060c4]"
                                    />
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <Building2 className="w-4 h-4 text-[#0060c4]" />
                                        <span className="font-extrabold text-slate-900 text-base">
                                          {trip.busCompany.name}
                                        </span>
                                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                                          Nhận hàng tại bến
                                        </span>
                                      </div>
                                      <div className="text-xs text-slate-600 mt-1.5 flex flex-wrap items-center gap-2.5">
                                        <div className="flex items-center gap-1 font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                                          <Clock className="w-3.5 h-3.5 text-blue-600" />
                                          <span>Giao hàng: <strong>Trong ngày (24h - 48h)</strong></span>
                                        </div>
                                        <span className="text-slate-400">•</span>
                                        <span className="text-slate-600">
                                          Tuyến: <strong>{origin} → {destination}</strong>
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="text-right">
                                    <div className="text-xs font-extrabold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">
                                      Văn phòng / Bến {origin}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 2. Thông tin người gửi */}
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                    <h2 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
                      <div className="bg-blue-100 p-1.5 rounded-full">
                        <User className="w-5 h-5 text-blue-600" />
                      </div>
                      2. Thông tin người gửi
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1.5">
                          Họ và tên <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={senderName}
                          onChange={(e) => setSenderName(e.target.value)}
                          placeholder="Ví dụ: Nguyễn Văn A"
                          className="w-full h-11 px-4 rounded-xl border border-slate-300 focus:outline-none focus:border-brand font-semibold text-slate-800 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1.5">
                          Số điện thoại <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="tel"
                          value={senderPhone}
                          onChange={(e) => setSenderPhone(e.target.value)}
                          placeholder="09xxxxxxxx"
                          className="w-full h-11 px-4 rounded-xl border border-slate-300 focus:outline-none focus:border-brand font-semibold text-slate-800 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1.5">
                          Email (không bắt buộc)
                        </label>
                        <input
                          type="email"
                          value={senderEmail}
                          onChange={(e) => setSenderEmail(e.target.value)}
                          placeholder="email@example.com"
                          className="w-full h-11 px-4 rounded-xl border border-slate-300 focus:outline-none focus:border-brand font-semibold text-slate-800 bg-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 3. Thông tin người nhận */}
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                    <h2 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
                      <div className="bg-slate-100 p-1.5 rounded-full">
                        <Users className="w-5 h-5 text-slate-600" />
                      </div>
                      3. Thông tin người nhận (Ra bến nhận hàng)
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1.5">
                          Họ và tên người nhận <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={receiverName}
                          onChange={(e) => setReceiverName(e.target.value)}
                          placeholder="Ví dụ: Lê Thị B"
                          className="w-full h-11 px-4 rounded-xl border border-slate-300 focus:outline-none focus:border-brand font-semibold text-slate-800 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1.5">
                          Số điện thoại người nhận <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="tel"
                          value={receiverPhone}
                          onChange={(e) => setReceiverPhone(e.target.value)}
                          placeholder="09xxxxxxxx"
                          className="w-full h-11 px-4 rounded-xl border border-slate-300 focus:outline-none focus:border-brand font-semibold text-slate-800 bg-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 4. Thông tin kiện hàng */}
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                    <h2 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
                      <div className="bg-amber-100 p-1.5 rounded-full">
                        <Package className="w-5 h-5 text-amber-600" />
                      </div>
                      4. Thông tin kiện hàng
                    </h2>

                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1.5">
                            Tên hàng hóa <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={cargoName}
                            onChange={(e) => setCargoName(e.target.value)}
                            placeholder="Ví dụ: Thùng hoa quả, tài liệu, quần áo..."
                            className="w-full h-11 px-4 rounded-xl border border-slate-300 focus:outline-none focus:border-brand font-semibold text-slate-800 bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1.5">
                            Loại hàng hóa
                          </label>
                          <select
                            value={cargoCategory}
                            onChange={(e) => setCargoCategory(e.target.value)}
                            className="w-full h-11 px-3 rounded-xl border border-slate-300 focus:outline-none focus:border-brand font-semibold text-slate-800 bg-white"
                          >
                            {cargoCategories.length > 0
                              ? cargoCategories.map((cat) => (
                                  <option key={cat.categoryId} value={cat.name}>
                                    {cat.name}
                                  </option>
                                ))
                              : CARGO_CATEGORIES.map((cat) => (
                                  <option key={cat} value={cat}>
                                    {cat}
                                  </option>
                                ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div className="col-span-1 md:col-span-2">
                          <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1.5">
                            Số kiện
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={quantity}
                            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-full h-11 px-4 rounded-xl border border-slate-300 focus:outline-none focus:border-brand font-semibold text-slate-800 bg-white"
                          />
                        </div>
                        <div className="col-span-1 md:col-span-3">
                          <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1.5">
                            Khối lượng mỗi kiện (kg)
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={weight}
                            onChange={(e) => setWeight(Math.max(1, parseFloat(e.target.value) || 1))}
                            className="w-full h-11 px-4 rounded-xl border border-slate-300 focus:outline-none focus:border-brand font-semibold text-slate-800 bg-white"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1.5">
                            Dài (cm) <span className="text-slate-400 font-normal lowercase">(tùy chọn)</span>
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={length}
                            onChange={(e) => setLength(e.target.value)}
                            placeholder="cm"
                            className="w-full h-11 px-4 rounded-xl border border-slate-300 focus:outline-none focus:border-brand font-semibold text-slate-800 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1.5">
                            Rộng (cm) <span className="text-slate-400 font-normal lowercase">(tùy chọn)</span>
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={width}
                            onChange={(e) => setWidth(e.target.value)}
                            placeholder="cm"
                            className="w-full h-11 px-4 rounded-xl border border-slate-300 focus:outline-none focus:border-brand font-semibold text-slate-800 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1.5">
                            Cao (cm) <span className="text-slate-400 font-normal lowercase">(tùy chọn)</span>
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={height}
                            onChange={(e) => setHeight(e.target.value)}
                            placeholder="cm"
                            className="w-full h-11 px-4 rounded-xl border border-slate-300 focus:outline-none focus:border-brand font-semibold text-slate-800 bg-white"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1.5">
                          Ghi chú hàng hóa
                        </label>
                        <textarea
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="Ví dụ: hàng trái cây tươi cần gửi sớm, đóng thùng xốp..."
                          className="w-full p-3 rounded-xl border border-slate-300 focus:outline-none focus:border-brand text-sm resize-none h-20"
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-6 pt-2">
                        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer font-medium">
                          <input
                            type="checkbox"
                            checked={isFragile}
                            onChange={(e) => setIsFragile(e.target.checked)}
                            className="w-4 h-4 rounded border-slate-300 text-[#0060c4] accent-[#0060c4]"
                          />
                          Hàng dễ vỡ (+20.000đ)
                        </label>
                        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer font-medium">
                          <input
                            type="checkbox"
                            checked={isValuable}
                            onChange={(e) => setIsValuable(e.target.checked)}
                            className="w-4 h-4 rounded border-slate-300 text-[#0060c4] accent-[#0060c4]"
                          />
                          Hàng giá trị cao / Bảo hiểm (+50.000đ)
                        </label>
                      </div>

                      <div className="bg-amber-50 rounded-xl p-4 text-xs text-amber-800 border border-amber-200/60 flex items-start gap-2.5">
                        <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <strong>Quy định giao nhận:</strong> Người gửi tự mang kiện hàng ra bến xe trước giờ xe chạy 15-30 phút. Người nhận mang CCCD/SĐT ra bến xe đích để nhận hàng. Nhà xe không nhận vận chuyển hàng cấm, vũ khí, chất cháy nổ.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* CỘT PHẢI: DỰ TÍNH CƯỚC & NÚT HÀNH ĐỘNG */}
                <div className="w-full lg:w-[360px] shrink-0">
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sticky top-24">
                    <h2 className="text-lg font-bold text-slate-900 mb-5 flex items-center gap-2">
                      <Calculator className="w-5 h-5 text-[#0060c4]" /> Dự tính cước phí
                    </h2>

                    <div className="space-y-3 mb-6 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-medium">Cước cơ bản (5kg đầu):</span>
                        <span className="font-bold text-slate-900">50.000đ</span>
                      </div>

                      {calculatedPricing.totalWeight > 5 && (
                        <div className="flex justify-between">
                          <span className="text-slate-500 font-medium">
                            Phụ cước vượt mức ({calculatedPricing.totalWeight - 5}kg):
                          </span>
                          <span className="font-bold text-slate-900">
                            {((calculatedPricing.totalWeight - 5) * 10000).toLocaleString('vi-VN')}đ
                          </span>
                        </div>
                      )}

                      {(isFragile || cargoCategory === 'Hàng dễ vỡ') && (
                        <div className="flex justify-between">
                          <span className="text-slate-500 font-medium">Phụ phí dễ vỡ:</span>
                          <span className="font-bold text-slate-900">20.000đ</span>
                        </div>
                      )}

                      {(isValuable || cargoCategory === 'Giá trị cao') && (
                        <div className="flex justify-between">
                          <span className="text-slate-500 font-medium">Bảo hiểm giá trị:</span>
                          <span className="font-bold text-slate-900">50.000đ</span>
                        </div>
                      )}

                      <div className="pt-4 border-t border-slate-200 flex justify-between items-center">
                        <span className="text-base font-black text-slate-800">Tổng cước phí:</span>
                        <span className="text-2xl font-black text-[#f05123]">
                          {calculatedPricing.totalFee.toLocaleString('vi-VN')}đ
                        </span>
                      </div>
                    </div>

                    {selectedTrip && (
                      <div className="mb-5 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
                        <div>
                          Nhà xe:{' '}
                          <strong className="text-slate-800">{selectedTrip.busCompany.name}</strong>
                        </div>
                        <div>
                          Khởi hành:{' '}
                          <strong className="text-slate-800">
                            {formatIsoTime(selectedTrip.departureTime)} ({date})
                          </strong>
                        </div>
                        <div>
                          Tuyến:{' '}
                          <strong className="text-slate-800">
                            {origin} → {destination}
                          </strong>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={handleCreateShipment}
                      disabled={isSubmitting || !selectedTripId}
                      className="w-full h-12 bg-[#f05123] text-white font-black text-base rounded-xl hover:bg-[#d94419] disabled:opacity-50 transition-colors flex items-center justify-center gap-2 shadow-sm"
                    >
                      {isSubmitting ? 'Đang tạo vận đơn...' : 'Tạo mã vận đơn'}
                      <ArrowRight className="w-5 h-5" />
                    </button>

                    <p className="text-xs text-center text-slate-500 mt-4 leading-relaxed">
                      Sau khi tạo, mang kiện hàng ra bến xe gửi trước giờ xuất bến.
                    </p>
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
