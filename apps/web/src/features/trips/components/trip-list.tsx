'use client';

import { useState, useEffect } from 'react';
import { Filter, ChevronDown, MapPin, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Pagination } from '@/components/ui/pagination';
import { TripCard } from '@/features/trips/components/trip-card';
import type { Trip } from '@/types/customer';
import {
  tripsApi,
  busCompaniesApi,
  type ApiTrip,
} from '@/features/trips/services/trips.api';
import {
  buildTripBookingHref,
  buildTripListSearchParams,
  buildRoundTripBookingHrefAfterSelection,
  getTripSummaryCardStates,
} from '@/features/trips/services/trip-list-state';

type TripPage = {
  trips: Trip[];
  meta: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
};

const EMPTY_META = {
  page: 1,
  pageSize: 10,
  totalItems: 0,
  totalPages: 0,
};

function mapApiToTrip(item: ApiTrip): Trip {
  const depDate = new Date(item.departureTime);
  const arrDate = item.arrivalTime ? new Date(item.arrivalTime) : null;
  const duration = item.route.durationMinutes;
  const hrs = duration === null ? 0 : Math.floor(duration / 60);
  const mins = duration === null ? 0 : duration % 60;
  return {
    id: String(item.id),
    operator: item.busCompany.name,
    origin: item.route.origin,
    destination: item.route.destination,
    departureTime: `${String(depDate.getHours()).padStart(2, '0')}:${String(depDate.getMinutes()).padStart(2, '0')}`,
    arrivalTime: arrDate
      ? `${String(arrDate.getHours()).padStart(2, '0')}:${String(arrDate.getMinutes()).padStart(2, '0')}`
      : '—',
    duration:
      duration === null
        ? 'Chưa cập nhật'
        : mins > 0
          ? `${hrs} giờ ${mins} phút`
          : `${hrs} giờ`,
    vehicleType: item.vehicle.type,
    price: item.price ?? Number.NaN,
    availableSeats: item.availableSeats,
    totalSeats: item.vehicle.capacity,
    rating: item.busCompany.rating ?? Number.NaN,
    image: item.busCompany.logo || '/images/route1.jpg',
    amenities: item.vehicle.amenities || [],
    status:
      item.availableSeats === 0
        ? 'sold-out'
        : item.availableSeats <= 5
          ? 'nearly-full'
          : 'open',
  };
}

async function fetchTripsByRoute(
  origin: string,
  destination: string,
  date: string,
  page: number,
  sort: string,
  search: string,
  vehicleType: string,
  timeRange: string,
  operator: string,
): Promise<TripPage> {
  if (!origin && !destination) return { trips: [], meta: EMPTY_META };
  const response = await tripsApi.searchTrips(
    buildTripListSearchParams({
      origin,
      destination,
      date,
      page,
      sort,
      search,
      vehicleType,
      timeRange,
      operator,
    }),
  );
  return { trips: response.data.map(mapApiToTrip), meta: response.meta };
}

function formatDateLabel(dateStr: string): string {
  if (!dateStr) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  }
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }
  return dateStr;
}

function TripSlot({
  num,
  trip,
  label,
  origin,
  destination,
  active,
  onActivate,
}: {
  num: number;
  trip: Trip | null;
  label: string;
  origin: string;
  destination: string;
  active: boolean;
  onActivate: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onActivate}
      aria-pressed={active}
      className={`flex w-full gap-3 rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f05123] focus-visible:ring-offset-2 ${
        active
          ? 'border-[#f05123] bg-orange-50/80 shadow-sm ring-1 ring-[#f05123]/15'
          : 'border-slate-200 bg-slate-100 text-slate-500 hover:border-slate-300'
      }`}
    >
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white ${active ? 'bg-[#f05123]' : 'bg-slate-400'}`}
      >
        {num}
      </div>
      <div className="flex-1 min-w-0">
        {trip ? (
          <>
            <p
              className={`text-[11px] font-medium ${active ? 'text-slate-600' : 'text-slate-500'}`}
            >
              {label}
            </p>
            <p
              className={`truncate text-[12px] font-bold ${active ? 'text-slate-800' : 'text-slate-600'}`}
            >
              {trip.origin} - {trip.destination}
            </p>
            <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-slate-600">
              <span className="font-bold">{trip.departureTime}</span>
              <div className="w-1.5 h-1.5 rounded-full border border-[#00b14f]"></div>
              <div className="flex-1 border-t border-dotted border-slate-300"></div>
              <MapPin size={10} className="text-[#f05123]" fill="#f05123" />
              <span className="font-bold">{trip.arrivalTime}</span>
            </div>
          </>
        ) : (
          <>
            <p className="text-[11px] text-slate-400">
              {label ? `${label} (chưa chọn)` : 'Chưa chọn'}
            </p>
            <p className="text-[12px] font-medium text-slate-500">
              {origin || '—'} - {destination || '—'}
            </p>
            <div className="flex items-center gap-1 mt-1.5 text-[11px] text-slate-400">
              <span>--:--</span>
              <div className="flex-1 border-t border-dotted border-slate-200"></div>
              <span>--:--</span>
            </div>
          </>
        )}
      </div>
    </button>
  );
}

export function TripList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [outboundTrips, setOutboundTrips] = useState<Trip[]>([]);
  const [returnTrips, setReturnTrips] = useState<Trip[]>([]);
  const [outboundMeta, setOutboundMeta] = useState(EMPTY_META);
  const [returnMeta, setReturnMeta] = useState(EMPTY_META);
  const [outboundPageState, setOutboundPageState] = useState({
    searchKey: '',
    page: 1,
  });
  const [returnPageState, setReturnPageState] = useState({
    searchKey: '',
    page: 1,
  });
  const [loadingOutbound, setLoadingOutbound] = useState(true);
  const [loadingReturn, setLoadingReturn] = useState(false);
  const [errorOutbound, setErrorOutbound] = useState('');
  const [errorReturn, setErrorReturn] = useState('');
  const [query, setQuery] = useState('');
  const [vehicleType, setVehicleType] = useState('all');
  const [timeRange, setTimeRange] = useState('all');
  const [operator, setOperator] = useState('all');
  const [busCompanies, setBusCompanies] = useState<string[]>([]);
  const [sort, setSort] = useState('departure');

  useEffect(() => {
    let ignore = false;
    busCompaniesApi.getBusCompanies().then((companies) => {
      if (ignore) return;
      const valid = companies
        .filter((c) => !c.code.startsWith('RBAC') && !c.code.startsWith('T04'))
        .map((c) => c.name);
      setBusCompanies(valid);
    });
    return () => {
      ignore = true;
    };
  }, []);

  const allOperators = Array.from(
    new Set([
      ...busCompanies,
      ...outboundTrips.map((t) => t.operator),
      ...returnTrips.map((t) => t.operator),
    ]),
  ).filter(Boolean);

  const origin = searchParams.get('from') || searchParams.get('origin') || '';
  const destination =
    searchParams.get('to') || searchParams.get('destination') || '';
  const date =
    searchParams.get('departureDate') || searchParams.get('date') || '';
  const returnDate = searchParams.get('returnDate') || '';
  const tripType = searchParams.get('tripType') || '';
  // Round-trip nếu tripType=round-trip HOẶC có returnDate
  const isRoundTrip = tripType === 'round-trip' || !!returnDate;

  const outboundDateFormatted = formatDateLabel(date);
  const outboundLabel = outboundDateFormatted
    ? `Ngày đi: ${outboundDateFormatted}`
    : 'Ngày đi';

  const returnDateFormatted = formatDateLabel(returnDate);
  const returnLabel = returnDateFormatted
    ? `Ngày về: ${returnDateFormatted}`
    : 'Ngày về';

  // Route key: changes when from/to/date change → used to auto-reset selections
  const routeKey = `${origin}|${destination}|${date}|${returnDate || ''}|${tripType || 'one-way'}`;

  // Selected trips keyed by routeKey (auto-resets when search criteria change)
  const [selectedOutboundKeyed, setSelectedOutboundKeyed] = useState<{
    key: string;
    trip: Trip | null;
  }>({ key: routeKey, trip: null });
  const [selectedReturnKeyed, setSelectedReturnKeyed] = useState<{
    key: string;
    trip: Trip | null;
  }>({ key: routeKey, trip: null });

  // Active tab keyed by routeKey (auto-resets to 'outbound' when search criteria change)
  const [activeTabKeyed, setActiveTabKeyed] = useState<{
    key: string;
    tab: 'outbound' | 'return';
  }>({ key: routeKey, tab: 'outbound' });

  // Derive effective values — null/reset when routeKey has changed
  const selectedOutbound =
    selectedOutboundKeyed.key === routeKey ? selectedOutboundKeyed.trip : null;
  const selectedReturn =
    selectedReturnKeyed.key === routeKey ? selectedReturnKeyed.trip : null;
  const activeTab =
    activeTabKeyed.key === routeKey ? activeTabKeyed.tab : 'outbound';

  function setSelectedOutbound(trip: Trip | null) {
    setSelectedOutboundKeyed({ key: routeKey, trip });
  }
  function setSelectedReturn(trip: Trip | null) {
    setSelectedReturnKeyed({ key: routeKey, trip });
  }
  function setActiveTab(tab: 'outbound' | 'return') {
    setActiveTabKeyed({ key: routeKey, tab });
  }

  const outboundSearchKey = `${origin}\u0000${destination}\u0000${date}\u0000${query}\u0000${vehicleType}\u0000${timeRange}\u0000${operator}`;
  const returnSearchKey = `${destination}\u0000${origin}\u0000${returnDate}\u0000${query}\u0000${vehicleType}\u0000${timeRange}\u0000${operator}`;
  const outboundPage =
    outboundPageState.searchKey === outboundSearchKey
      ? outboundPageState.page
      : 1;
  const returnPage =
    returnPageState.searchKey === returnSearchKey ? returnPageState.page : 1;

  // Fetch outbound trips
  useEffect(() => {
    let ignore = false;
    const fetchOutboundTrips = async () => {
      setLoadingOutbound(true);
      setErrorOutbound('');
      try {
        const response = await fetchTripsByRoute(
          origin,
          destination,
          date,
          outboundPage,
          sort,
          query,
          vehicleType,
          timeRange,
          operator,
        );
        if (ignore) return;
        setOutboundTrips(response.trips);
        setOutboundMeta(response.meta);
      } catch (error) {
        if (ignore) return;
        setOutboundTrips([]);
        setOutboundMeta(EMPTY_META);
        setErrorOutbound(
          error instanceof Error ? error.message : 'Không thể tải chuyến xe',
        );
      } finally {
        if (!ignore) setLoadingOutbound(false);
      }
    };
    void fetchOutboundTrips();
    return () => {
      ignore = true;
    };
  }, [
    origin,
    destination,
    date,
    outboundPage,
    sort,
    query,
    vehicleType,
    timeRange,
    operator,
  ]);

  // Fetch return trips if round-trip
  useEffect(() => {
    if (!isRoundTrip) return;
    if (date && returnDate && date > returnDate) {
      setErrorReturn('Ngày đi không được lớn hơn ngày về');
      setReturnTrips([]);
      setReturnMeta(EMPTY_META);
      setLoadingReturn(false);
      return;
    }
    let ignore = false;
    const fetchReturnTrips = async () => {
      setLoadingReturn(true);
      setErrorReturn('');
      try {
        const response = await fetchTripsByRoute(
          destination,
          origin,
          returnDate,
          returnPage,
          sort,
          query,
          vehicleType,
          timeRange,
          operator,
        );
        if (ignore) return;
        setReturnTrips(response.trips);
        setReturnMeta(response.meta);
      } catch (error) {
        if (ignore) return;
        setReturnTrips([]);
        setReturnMeta(EMPTY_META);
        setErrorReturn(
          error instanceof Error ? error.message : 'Không thể tải chuyến xe',
        );
      } finally {
        if (!ignore) setLoadingReturn(false);
      }
    };
    void fetchReturnTrips();
    return () => {
      ignore = true;
    };
  }, [
    destination,
    origin,
    returnDate,
    isRoundTrip,
    returnPage,
    sort,
    query,
    vehicleType,
    timeRange,
    operator,
  ]);

  const effectiveActiveTab = isRoundTrip ? activeTab : 'outbound';
  const activeTrips =
    effectiveActiveTab === 'outbound' ? outboundTrips : returnTrips;
  const loading =
    effectiveActiveTab === 'outbound' ? loadingOutbound : loadingReturn;
  const error = effectiveActiveTab === 'outbound' ? errorOutbound : errorReturn;
  const activeMeta =
    effectiveActiveTab === 'outbound' ? outboundMeta : returnMeta;
  const currentPage =
    effectiveActiveTab === 'outbound' ? outboundPage : returnPage;

  const filteredTrips = activeTrips;

  const totalResults = activeMeta.totalItems;
  const summaryCardStates = getTripSummaryCardStates(effectiveActiveTab);

  function handleSelectOutbound(trip: Trip) {
    setSelectedOutbound(trip);
  }

  function handleSelectReturn(trip: Trip) {
    setSelectedReturn(trip);
  }

  const handleSelect =
    effectiveActiveTab === 'outbound'
      ? handleSelectOutbound
      : handleSelectReturn;
  const selectedForTab =
    effectiveActiveTab === 'outbound' ? selectedOutbound : selectedReturn;

  function handleChoose(trip: Trip) {
    if (!isRoundTrip) {
      router.push(
        buildTripBookingHref({
          currentSearch: searchParams.toString(),
          outboundId: trip.id,
        }),
      );
      return;
    }

    const bookingHref = buildRoundTripBookingHrefAfterSelection({
      currentSearch: searchParams.toString(),
      activeLeg: effectiveActiveTab,
      chosenTripId: trip.id,
      selectedOutboundId: selectedOutbound?.id ?? null,
      selectedReturnId: selectedReturn?.id ?? null,
    });

    if (effectiveActiveTab === 'outbound') setSelectedOutbound(trip);
    else setSelectedReturn(trip);

    if (bookingHref) router.push(bookingHref);
  }

  function handlePageChange(page: number) {
    if (effectiveActiveTab === 'outbound') {
      setOutboundPageState({ searchKey: outboundSearchKey, page });
    } else {
      setReturnPageState({ searchKey: returnSearchKey, page });
    }
  }

  return (
    <div className="bg-[#F5F5F5] min-h-screen pb-12 pt-6">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Top Header Row */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white rounded-xl p-4 shadow-sm mb-6 gap-4 border border-slate-100">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              Chọn chuyến xe phù hợp
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              So sánh giờ đi, loại xe, số ghế trống, giá vé và chính sách trước
              khi chọn chỗ.
            </p>
          </div>
          <div className="flex gap-2">
            <div className="bg-[#e8f6f3] text-[#00b14f] px-3 py-1.5 rounded-lg text-center border border-[#b2e8d3] min-w-[70px]">
              <p className="font-bold text-lg leading-tight">{totalResults}</p>
              <p className="text-[10px] uppercase font-bold">Kết quả</p>
            </div>
            <div className="bg-[#fff4e5] text-[#f05123] px-3 py-1.5 rounded-lg text-center border border-[#ffe0b2] min-w-[70px]">
              <p className="font-bold text-lg leading-tight">10p</p>
              <p className="text-[10px] uppercase font-bold">Giữ ghế</p>
            </div>
            <div className="border border-slate-200 text-slate-800 px-3 py-1.5 rounded-lg text-center bg-white min-w-[70px]">
              <p className="font-bold text-lg leading-tight">QR</p>
              <p className="text-[10px] uppercase font-bold">Vé điện tử</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
          {/* ===== LEFT SIDEBAR ===== */}
          <div className="space-y-4">
            {/* CHUYẾN ĐI CỦA BẠN */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden border-2 border-slate-200">
              <div className="px-4 py-3 border-b border-slate-200">
                <h2 className="font-bold text-slate-800 text-[13px] uppercase tracking-wide">
                  CHUYẾN ĐI CỦA BẠN
                </h2>
              </div>

              <div className="space-y-2 p-3">
                <div className="relative">
                  <TripSlot
                    num={1}
                    trip={selectedOutbound}
                    label={outboundLabel}
                    origin={origin}
                    destination={destination}
                    active={summaryCardStates.outbound === 'active'}
                    onActivate={() => setActiveTab('outbound')}
                  />
                  {selectedOutbound && (
                    <button
                      type="button"
                      onClick={() => setSelectedOutbound(null)}
                      className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-white/80 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                      aria-label="Bỏ chọn chuyến đi"
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                  )}
                </div>
                {isRoundTrip && (
                  <div className="relative">
                    <TripSlot
                      num={2}
                      trip={selectedReturn}
                      label={returnLabel}
                      origin={destination}
                      destination={origin}
                      active={summaryCardStates.return === 'active'}
                      onActivate={() => setActiveTab('return')}
                    />
                    {selectedReturn && (
                      <button
                        type="button"
                        onClick={() => setSelectedReturn(null)}
                        className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-white/80 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                        aria-label="Bỏ chọn chuyến về"
                      >
                        <X size={14} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* LỌC CHUYẾN */}
            <div className="bg-white rounded-xl shadow-sm p-5 border border-slate-200">
              <div className="flex justify-between items-center mb-5 pb-4 border-b border-slate-100">
                <h2 className="font-bold text-slate-800 flex items-center gap-2 text-[13px] uppercase">
                  <Filter size={16} className="text-blue-600" />
                  LỌC CHUYẾN
                </h2>
                <button
                  onClick={() => {
                    setQuery('');
                    setVehicleType('all');
                    setTimeRange('all');
                    setOperator('all');
                  }}
                  className="text-[11px] font-medium text-slate-500 hover:text-[#f05123] transition-colors"
                >
                  ↺ Đặt lại
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-2">
                    Từ khóa tìm kiếm
                  </label>
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Điểm đi, điểm đến, loại xe..."
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 outline-none focus:border-[#f05123]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-2">
                    Loại xe / dịch vụ
                  </label>
                  <div className="relative">
                    <select
                      value={vehicleType}
                      onChange={(e) => setVehicleType(e.target.value)}
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 outline-none focus:border-[#f05123] appearance-none bg-white"
                    >
                      <option value="all">Tất cả loại xe</option>
                      <option value="Limousine">Limousine</option>
                      <option value="Giường">Giường nằm</option>
                      <option value="Ghế">Ghế ngồi</option>
                    </select>
                    <ChevronDown
                      size={16}
                      className="absolute right-3 top-3 text-slate-400 pointer-events-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-2">
                    Khung giờ khởi hành
                  </label>
                  <div className="relative">
                    <select
                      value={timeRange}
                      onChange={(e) => setTimeRange(e.target.value)}
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 outline-none focus:border-[#f05123] appearance-none bg-white"
                    >
                      <option value="all">Tất cả khung giờ</option>
                      <option value="early-morning">
                        Sáng sớm (00:00 - 06:00)
                      </option>
                      <option value="morning">Buổi sáng (06:00 - 12:00)</option>
                      <option value="afternoon">
                        Buổi chiều (12:00 - 18:00)
                      </option>
                      <option value="evening">Buổi tối (18:00 - 24:00)</option>
                    </select>
                    <ChevronDown
                      size={16}
                      className="absolute right-3 top-3 text-slate-400 pointer-events-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-2">
                    Nhà xe
                  </label>
                  <div className="relative">
                    <select
                      value={operator}
                      onChange={(e) => setOperator(e.target.value)}
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 outline-none focus:border-[#f05123] appearance-none bg-white"
                    >
                      <option value="all">Tất cả nhà xe</option>
                      {allOperators.map((op) => (
                        <option key={op} value={op}>
                          Nhà xe {op}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={16}
                      className="absolute right-3 top-3 text-slate-400 pointer-events-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ===== RIGHT CONTENT ===== */}
          <div className="flex flex-col gap-4">
            {/* Tabs (round-trip only) */}
            {isRoundTrip && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="grid grid-cols-2">
                  <button
                    onClick={() => setActiveTab('outbound')}
                    className={`py-3.5 text-[13px] font-bold text-center transition-colors ${
                      activeTab === 'outbound'
                        ? 'text-[#f05123] border-b-4 border-[#f05123]'
                        : 'text-slate-500 border-b border-slate-100 hover:text-slate-700'
                    }`}
                  >
                    CHUYẾN ĐI – NGÀY ĐI
                  </button>
                  <button
                    onClick={() => setActiveTab('return')}
                    className={`py-3.5 text-[13px] font-bold text-center transition-colors ${
                      activeTab === 'return'
                        ? 'text-[#f05123] border-b-4 border-[#f05123]'
                        : 'text-slate-500 border-b border-slate-100 hover:text-slate-700'
                    }`}
                  >
                    CHUYẾN VỀ – NGÀY VỀ
                  </button>
                </div>
              </div>
            )}

            {/* Toolbar */}
            <div className="flex justify-between items-center bg-white p-3 px-4 rounded-xl shadow-sm border border-slate-100">
              <p className="text-[13px] font-medium text-slate-600">
                Tìm thấy{' '}
                <span className="font-bold text-blue-600">{totalResults}</span>{' '}
                chuyến xe phù hợp
              </p>
              <div className="flex items-center gap-2">
                <span className="text-[13px] text-slate-500">⇅ Sắp xếp:</span>
                <select
                  value={sort}
                  onChange={(e) => {
                    setSort(e.target.value);
                    setOutboundPageState({
                      searchKey: outboundSearchKey,
                      page: 1,
                    });
                    setReturnPageState({ searchKey: returnSearchKey, page: 1 });
                  }}
                  className="text-[13px] font-medium text-slate-700 border border-slate-200 rounded-md px-3 py-1.5 outline-none bg-white"
                >
                  <option value="departure">Mới cập nhật</option>
                  <option value="price">Giá thấp đến cao</option>
                </select>
              </div>
            </div>

            {/* Trip Cards */}
            <div className="flex flex-col gap-4">
              {loading ? (
                <div className="bg-white rounded-xl p-12 flex flex-col items-center justify-center text-slate-500 border border-slate-100 shadow-sm">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#f05123] mb-4"></div>
                  <p className="font-semibold text-sm">
                    Đang tải dữ liệu chuyến xe...
                  </p>
                </div>
              ) : error ? (
                <div className="bg-white rounded-xl p-12 text-center text-red-600 border border-red-100 shadow-sm">
                  <p className="font-semibold text-sm">{error}</p>
                  <p className="text-xs mt-1 text-slate-500">
                    Vui lòng thử lại sau.
                  </p>
                </div>
              ) : filteredTrips.length > 0 ? (
                filteredTrips.map((trip) => (
                  <TripCard
                    key={trip.id}
                    trip={trip}
                    isSelected={selectedForTab?.id === trip.id}
                    onSelect={handleSelect}
                    onChoose={handleChoose}
                  />
                ))
              ) : (
                <div className="bg-white rounded-xl p-12 text-center text-slate-500 border border-slate-100 shadow-sm">
                  <div className="text-4xl mb-4">🚌</div>
                  <p className="font-semibold text-sm">
                    Không tìm thấy chuyến xe nào phù hợp.
                  </p>
                  <p className="text-xs mt-1">
                    Vui lòng thay đổi bộ lọc hoặc chọn ngày khác.
                  </p>
                </div>
              )}
            </div>

            {/* Pagination */}
            {activeMeta.totalPages > 1 && (
              <div className="flex justify-center mt-4">
                <Pagination
                  currentPage={currentPage}
                  totalPages={activeMeta.totalPages}
                  onPageChange={handlePageChange}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
