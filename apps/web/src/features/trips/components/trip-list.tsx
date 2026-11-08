'use client';

import { useState, useEffect } from 'react';
import { Filter, ChevronDown, MapPin, X, Bus, Loader2, RotateCcw, AlertCircle } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
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
  fromSubAreas?: Array<{ diaDiemId: number; tenDiaDiem: string; tripCount: number }>;
  toSubAreas?: Array<{ diaDiemId: number; tenDiaDiem: string; tripCount: number }>;
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
    busCompanyId: item.busCompany.id,
    reviewsCount: item.busCompany.reviewsCount ?? undefined,
    departureDate: item.departureTime,
    image: item.busCompany.logo || '/images/route1.jpg',
    amenities: item.vehicle.amenities || [],
    status:
      item.availableSeats === 0
        ? 'sold-out'
        : item.availableSeats <= 5
          ? 'nearly-full'
          : 'open',
    pickupPoints: item.pickupPoints,
    dropoffPoints: item.dropoffPoints,
    stops: item.stops,
    pickupPoint: item.pickupPoint,
    pickupAddress: item.pickupAddress ?? undefined,
    dropoffPoint: item.dropoffPoint,
    dropoffAddress: item.dropoffAddress ?? undefined,
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
  options?: {
    fromLocationId?: number;
    toLocationId?: number;
    fromStationId?: number;
    toStationId?: number;
    fromAreaId?: number;
    toAreaId?: number;
  },
): Promise<TripPage> {
  if (!origin && !destination && !options?.fromLocationId && !options?.toLocationId) {
    return { trips: [], meta: EMPTY_META };
  }
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
      fromLocationId: options?.fromLocationId,
      toLocationId: options?.toLocationId,
      fromStationId: options?.fromStationId,
      toStationId: options?.toStationId,
      fromAreaId: options?.fromAreaId,
      toAreaId: options?.toAreaId,
    }),
  );
  return {
    trips: response.data.map(mapApiToTrip),
    meta: response.meta,
    fromSubAreas: response.fromSubAreas,
    toSubAreas: response.toSubAreas,
  };
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
  notSelectedText = 'Chưa chọn',
}: {
  num: number;
  trip: Trip | null;
  label: string;
  origin: string;
  destination: string;
  active: boolean;
  onActivate: () => void;
  notSelectedText?: string;
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
              {label ? `${label} (${notSelectedText})` : notSelectedText}
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
  const t = useTranslations('trips');
  const tCommon = useTranslations('common');
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
  const [loadingMoreOutbound, setLoadingMoreOutbound] = useState(false);
  const [loadingMoreReturn, setLoadingMoreReturn] = useState(false);
  const [errorOutbound, setErrorOutbound] = useState('');
  const [errorReturn, setErrorReturn] = useState('');
  const [query, setQuery] = useState('');
  const [vehicleType, setVehicleType] = useState('all');
  const [timeRange, setTimeRange] = useState('all');
  const [operator, setOperator] = useState('all');
  const [busCompanies, setBusCompanies] = useState<string[]>([]);
  const [sort, setSort] = useState('departure');
  const [retryCount, setRetryCount] = useState(0);
  const handleRetry = () => {
    setRetryCount((prev) => prev + 1);
  };

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

  const fromLocationId = searchParams.get('fromLocationId')
    ? Number(searchParams.get('fromLocationId'))
    : undefined;
  const toLocationId = searchParams.get('toLocationId')
    ? Number(searchParams.get('toLocationId'))
    : undefined;
  const fromStationId = searchParams.get('fromStationId')
    ? Number(searchParams.get('fromStationId'))
    : undefined;
  const toStationId = searchParams.get('toStationId')
    ? Number(searchParams.get('toStationId'))
    : undefined;

  const [fromAreaId, setFromAreaId] = useState<number | undefined>(
    searchParams.get('fromAreaId') ? Number(searchParams.get('fromAreaId')) : undefined,
  );
  const [toAreaId, setToAreaId] = useState<number | undefined>(
    searchParams.get('toAreaId') ? Number(searchParams.get('toAreaId')) : undefined,
  );

  const [subAreas, setSubAreas] = useState<{
    from?: Array<{ diaDiemId: number; tenDiaDiem: string; tripCount: number }>;
    to?: Array<{ diaDiemId: number; tenDiaDiem: string; tripCount: number }>;
  }>({});

  const [pickupPointFilter, setPickupPointFilter] = useState('all');
  const [dropoffPointFilter, setDropoffPointFilter] = useState('all');
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
  const routeKey = `${origin}|${destination}|${date}|${returnDate || ''}|${tripType || 'one-way'}|${fromAreaId || ''}|${toAreaId || ''}`;

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

  const outboundSearchKey = `${origin}\u0000${destination}\u0000${date}\u0000${query}\u0000${vehicleType}\u0000${timeRange}\u0000${operator}\u0000${fromAreaId || ''}\u0000${toAreaId || ''}`;
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
          1,
          sort,
          query,
          vehicleType,
          timeRange,
          operator,
          {
            fromLocationId,
            toLocationId,
            fromStationId,
            toStationId,
            fromAreaId,
            toAreaId,
          },
        );
        if (ignore) return;
        setOutboundTrips(response.trips);
        setOutboundMeta(response.meta);
        if (response.fromSubAreas || response.toSubAreas) {
          setSubAreas({
            from: response.fromSubAreas,
            to: response.toSubAreas,
          });
        }
        setOutboundPageState({ searchKey: outboundSearchKey, page: 1 });
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
    sort,
    query,
    vehicleType,
    timeRange,
    operator,
    retryCount,
    fromLocationId,
    toLocationId,
    fromStationId,
    toStationId,
    fromAreaId,
    toAreaId,
  ]);

  // Fetch return trips if round-trip
  useEffect(() => {
    if (!isRoundTrip) return;
    if (date && returnDate && date > returnDate) {
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
          1,
          sort,
          query,
          vehicleType,
          timeRange,
          operator,
        );
        if (ignore) return;
        setReturnTrips(response.trips);
        setReturnMeta(response.meta);
        setReturnPageState({ searchKey: returnSearchKey, page: 1 });
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
    date,
    destination,
    origin,
    returnDate,
    isRoundTrip,
    sort,
    query,
    vehicleType,
    timeRange,
    operator,
    retryCount,
  ]);

  const effectiveActiveTab = isRoundTrip ? activeTab : 'outbound';
  const isDateOrderInvalid =
    isRoundTrip && Boolean(date && returnDate && date > returnDate);
  const activeTrips =
    effectiveActiveTab === 'outbound'
      ? outboundTrips
      : isDateOrderInvalid
        ? []
        : returnTrips;
  const loading =
    effectiveActiveTab === 'outbound'
      ? loadingOutbound
      : isDateOrderInvalid
        ? false
        : loadingReturn;
  const error =
    effectiveActiveTab === 'outbound'
      ? errorOutbound
      : isDateOrderInvalid
        ? 'Ngày đi không được lớn hơn ngày về'
        : errorReturn;
  const activeMeta =
    effectiveActiveTab === 'outbound' ? outboundMeta : returnMeta;
  const currentPage =
    effectiveActiveTab === 'outbound' ? outboundPage : returnPage;

  const allPickupPoints = Array.from(
    new Set(
      activeTrips.flatMap((t) => [
        t.pickupPoint,
        ...(t.pickupPoints || []).map((p) => p.name),
      ]).filter(Boolean) as string[],
    ),
  );

  const allDropoffPoints = Array.from(
    new Set(
      activeTrips.flatMap((t) => [
        t.dropoffPoint,
        ...(t.dropoffPoints || []).map((p) => p.name),
      ]).filter(Boolean) as string[],
    ),
  );

  const filteredTrips = activeTrips.filter((t) => {
    if (pickupPointFilter !== 'all') {
      const match =
        t.pickupPoint === pickupPointFilter ||
        (t.pickupPoints || []).some((p) => p.name === pickupPointFilter);
      if (!match) return false;
    }
    if (dropoffPointFilter !== 'all') {
      const match =
        t.dropoffPoint === dropoffPointFilter ||
        (t.dropoffPoints || []).some((p) => p.name === dropoffPointFilter);
      if (!match) return false;
    }
    return true;
  });

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

  const loadingMore =
    effectiveActiveTab === 'outbound'
      ? loadingMoreOutbound
      : loadingMoreReturn;
  const hasMore =
    activeTrips.length < activeMeta.totalItems &&
    currentPage < activeMeta.totalPages;

  async function handleLoadMore() {
    if (effectiveActiveTab === 'outbound') {
      if (loadingMoreOutbound || outboundPage >= outboundMeta.totalPages) return;
      const nextPage = outboundPage + 1;
      setLoadingMoreOutbound(true);
      try {
        const response = await fetchTripsByRoute(
          origin,
          destination,
          date,
          nextPage,
          sort,
          query,
          vehicleType,
          timeRange,
          operator,
        );
        setOutboundTrips((prev) => [...prev, ...response.trips]);
        setOutboundMeta(response.meta);
        setOutboundPageState({ searchKey: outboundSearchKey, page: nextPage });
      } catch {
        // preserve current trips on error
      } finally {
        setLoadingMoreOutbound(false);
      }
    } else {
      if (loadingMoreReturn || returnPage >= returnMeta.totalPages) return;
      const nextPage = returnPage + 1;
      setLoadingMoreReturn(true);
      try {
        const response = await fetchTripsByRoute(
          destination,
          origin,
          returnDate,
          nextPage,
          sort,
          query,
          vehicleType,
          timeRange,
          operator,
        );
        setReturnTrips((prev) => [...prev, ...response.trips]);
        setReturnMeta(response.meta);
        setReturnPageState({ searchKey: returnSearchKey, page: nextPage });
      } catch {
        // preserve current trips on error
      } finally {
        setLoadingMoreReturn(false);
      }
    }
  }

  return (
    <div className="bg-[#F8FAFC] min-h-screen pb-12 pt-6">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Top Header Row */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white rounded-2xl p-5 shadow-sm mb-6 gap-4 border border-slate-200/80">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              {t('pageTitle')}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {t('pageSubtitle')}
            </p>
          </div>
          <div className="flex gap-2">
            <div className="bg-[#e8f6f3] text-[#00b14f] px-3.5 py-1.5 rounded-xl text-center border border-[#b2e8d3] min-w-[70px]">
              <p className="font-extrabold text-lg leading-tight">{totalResults}</p>
              <p className="text-[10px] uppercase font-bold">{t('resultsBadge')}</p>
            </div>
            <div className="bg-[#fff4e5] text-[#FF5722] px-3.5 py-1.5 rounded-xl text-center border border-[#ffe0b2] min-w-[70px]">
              <p className="font-extrabold text-lg leading-tight">{t('seatHoldTime')}</p>
              <p className="text-[10px] uppercase font-bold">{t('seatHoldBadge')}</p>
            </div>
            <div className="border border-slate-200 text-slate-800 px-3.5 py-1.5 rounded-xl text-center bg-white min-w-[70px] shadow-2xs">
              <p className="font-extrabold text-lg leading-tight">{t('eTicketIcon')}</p>
              <p className="text-[10px] uppercase font-bold">{t('eTicketBadge')}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
          {/* ===== LEFT SIDEBAR ===== */}
          <div className="space-y-4">
            {/* CHUYẾN ĐI CỦA BẠN */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-200/90">
              <div className="px-4 py-3 border-b border-slate-200">
                <h2 className="font-bold text-slate-800 text-[13px] uppercase tracking-wide">
                  {t('yourTrip')}
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
                    notSelectedText={t('notSelected')}
                  />
                  {selectedOutbound && (
                    <button
                      type="button"
                      onClick={() => setSelectedOutbound(null)}
                      className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-white/80 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                      aria-label={t('deselectOutbound')}
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
                      notSelectedText={t('notSelected')}
                    />
                    {selectedReturn && (
                      <button
                        type="button"
                        onClick={() => setSelectedReturn(null)}
                        className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-white/80 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                        aria-label={t('deselectReturn')}
                      >
                        <X size={14} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* LỌC CHUYẾN */}
            <div className="bg-white rounded-2xl shadow-sm p-5 border border-slate-200/90">
              <div className="flex justify-between items-center mb-5 pb-4 border-b border-slate-100">
                <h2 className="font-black text-slate-900 flex items-center gap-2 text-[13px] uppercase tracking-wide">
                  <Filter size={16} className="text-[#2563EB]" />
                  {t('filterTitle')}
                </h2>
                <button
                  onClick={() => {
                    setQuery('');
                    setVehicleType('all');
                    setTimeRange('all');
                    setOperator('all');
                    setPickupPointFilter('all');
                    setDropoffPointFilter('all');
                    setFromAreaId(undefined);
                    setToAreaId(undefined);
                  }}
                  className="text-[11px] font-bold text-slate-500 hover:text-[#FF5722] transition-colors cursor-pointer"
                >
                  ↺ {t('resetFilters')}
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-2">
                    {t('vehicleType')}
                  </label>
                  <div className="relative">
                    <select
                      value={vehicleType}
                      onChange={(e) => setVehicleType(e.target.value)}
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 outline-none focus:border-[#f05123] appearance-none bg-white"
                    >
                      <option value="all">{t('allVehicleTypes')}</option>
                      <option value="Limousine">{t('seatTypeLimousine')}</option>
                      <option value="Giường">{t('seatTypeSleeper')}</option>
                      <option value="Ghế">{t('seatTypeSeater')}</option>
                    </select>
                    <ChevronDown
                      size={16}
                      className="absolute right-3 top-3 text-slate-400 pointer-events-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-2">
                    {t('departureTime')}
                  </label>
                  <div className="relative">
                    <select
                      value={timeRange}
                      onChange={(e) => setTimeRange(e.target.value)}
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 outline-none focus:border-[#f05123] appearance-none bg-white"
                    >
                      <option value="all">{t('departureTime')}: {tCommon('all')}</option>
                      <option value="early-morning">
                        {t('timeEarlyMorning')}
                      </option>
                      <option value="morning">{t('timeMorning')}</option>
                      <option value="afternoon">
                        {t('timeAfternoon')}
                      </option>
                      <option value="evening">{t('timeEvening')}</option>
                    </select>
                    <ChevronDown
                      size={16}
                      className="absolute right-3 top-3 text-slate-400 pointer-events-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-2">
                    {t('operator')}
                  </label>
                  <div className="relative">
                    <select
                      value={operator}
                      onChange={(e) => setOperator(e.target.value)}
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 outline-none focus:border-[#f05123] appearance-none bg-white"
                    >
                      <option value="all">{t('allOperators')}</option>
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

                {allPickupPoints.length > 0 && (
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-2">
                      {t('pickupPoint')} ({allPickupPoints.length})
                    </label>
                    <div className="relative">
                      <select
                        value={pickupPointFilter}
                        onChange={(e) => setPickupPointFilter(e.target.value)}
                        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 outline-none focus:border-[#f05123] appearance-none bg-white"
                      >
                        <option value="all">{t('allPickupPoints')}</option>
                        {allPickupPoints.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        size={16}
                        className="absolute right-3 top-3 text-slate-400 pointer-events-none"
                      />
                    </div>
                  </div>
                )}

                {allDropoffPoints.length > 0 && (
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-2">
                      {t('dropoffPoint')} ({allDropoffPoints.length})
                    </label>
                    <div className="relative">
                      <select
                        value={dropoffPointFilter}
                        onChange={(e) => setDropoffPointFilter(e.target.value)}
                        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 outline-none focus:border-[#f05123] appearance-none bg-white"
                      >
                        <option value="all">{t('allDropoffPoints')}</option>
                        {allDropoffPoints.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        size={16}
                        className="absolute right-3 top-3 text-slate-400 pointer-events-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ===== RIGHT CONTENT ===== */}
          <div className="flex flex-col gap-4">
            {/* Sub-areas chips filter */}
            {((subAreas.from && subAreas.from.length > 0) ||
              (subAreas.to && subAreas.to.length > 0)) && (
              <div className="bg-white rounded-xl p-4 shadow-xs border border-slate-200 space-y-3">
                {subAreas.from && subAreas.from.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-[#00b14f]" />
                      {t('pickupPoint')} ({origin || '—'}):
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => setFromAreaId(undefined)}
                        className={`px-3 py-1 rounded-full text-xs font-bold transition-colors cursor-pointer ${
                          !fromAreaId
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {tCommon('all')}
                      </button>
                      {subAreas.from.map((area) => (
                        <button
                          key={area.diaDiemId}
                          type="button"
                          onClick={() =>
                            setFromAreaId(
                              fromAreaId === area.diaDiemId
                                ? undefined
                                : area.diaDiemId,
                            )
                          }
                          className={`px-3 py-1 rounded-full text-xs font-bold transition-colors cursor-pointer ${
                            fromAreaId === area.diaDiemId
                              ? 'bg-[#00b14f] text-white shadow-2xs'
                              : 'bg-green-50 text-green-800 border border-green-200 hover:bg-green-100'
                          }`}
                        >
                          {area.tenDiaDiem} ({area.tripCount})
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {subAreas.to && subAreas.to.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-[#f05123]" />
                      {t('dropoffPoint')} ({destination || '—'}):
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => setToAreaId(undefined)}
                        className={`px-3 py-1 rounded-full text-xs font-bold transition-colors cursor-pointer ${
                          !toAreaId
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {tCommon('all')}
                      </button>
                      {subAreas.to.map((area) => (
                        <button
                          key={area.diaDiemId}
                          type="button"
                          onClick={() =>
                            setToAreaId(
                              toAreaId === area.diaDiemId
                                ? undefined
                                : area.diaDiemId,
                            )
                          }
                          className={`px-3 py-1 rounded-full text-xs font-bold transition-colors cursor-pointer ${
                            toAreaId === area.diaDiemId
                              ? 'bg-[#f05123] text-white shadow-2xs'
                              : 'bg-red-50 text-red-800 border border-red-200 hover:bg-red-100'
                          }`}
                        >
                          {area.tenDiaDiem} ({area.tripCount})
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

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
                    {t('outboundTrip').toUpperCase()}
                  </button>
                  <button
                    onClick={() => setActiveTab('return')}
                    className={`py-3.5 text-[13px] font-bold text-center transition-colors ${
                      activeTab === 'return'
                        ? 'text-[#f05123] border-b-4 border-[#f05123]'
                        : 'text-slate-500 border-b border-slate-100 hover:text-slate-700'
                    }`}
                  >
                    {t('returnTrip').toUpperCase()}
                  </button>
                </div>
              </div>
            )}

            {/* Toolbar */}
            <div className="flex justify-between items-center bg-white p-3 px-4 rounded-xl shadow-sm border border-slate-100">
              <p className="text-[13px] font-medium text-slate-600">
                <span className="font-bold text-blue-600">{totalResults}</span>{' '}
                {t('resultsBadge').toLowerCase()}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-[13px] text-slate-500">⇅ {t('sortBy')}:</span>
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
                  <option value="departure">{t('sortDepartureAsc')}</option>
                  <option value="price">{t('sortPriceAsc')}</option>
                </select>
              </div>
            </div>

            {/* Trip Cards */}
            <div className="flex flex-col gap-4">
              {loading ? (
                <div className="bg-white rounded-xl p-12 flex flex-col items-center justify-center text-slate-500 border border-slate-100 shadow-sm">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#f05123] mb-4"></div>
                  <p className="font-semibold text-sm">
                    {t('loadingTrips')}
                  </p>
                </div>
              ) : error ? (
                <div className="bg-white rounded-2xl p-8 sm:p-12 text-center border border-rose-100 shadow-sm flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-3">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <p className="font-bold text-sm text-slate-900 mb-1">
                    {t('loadError')}
                  </p>
                  <button
                    type="button"
                    onClick={handleRetry}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#f05123] text-white text-xs font-bold shadow-xs hover:bg-[#d94419] active:scale-95 transition-all cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{t('retry')}</span>
                  </button>
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
                <div className="bg-white rounded-2xl py-14 px-8 text-center border border-slate-200/80 shadow-2xs">
                  <h3 className="font-bold text-slate-900 text-base mb-1.5">
                    {t('noTripsFound')}
                  </h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    {t('noTripsHint')}
                  </p>
                </div>
              )}
            </div>

            {/* Nút Xem thêm chuyến xe (thay thế phân trang 1, 2, 3, 4, 5) */}
            {activeTrips.length > 0 && (
              <div className="flex flex-col items-center justify-center mt-6 gap-2">
                {hasMore ? (
                  <button
                    type="button"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="group px-8 py-3 rounded-xl border border-slate-200 bg-white hover:bg-orange-50 hover:border-orange-300 hover:text-orange-600 font-extrabold text-sm text-slate-800 shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
                        <span>{t('loadingMore')}</span>
                      </>
                    ) : (
                      <>
                        <span>{t('loadMore')}</span>
                        <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-orange-500 transition-colors" />
                      </>
                    )}
                  </button>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
