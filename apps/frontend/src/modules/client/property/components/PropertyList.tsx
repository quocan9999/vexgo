// frontend/src/modules/client/property/components/PropertyList.tsx
'use client';

import React, { useState, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  SlidersHorizontal,
  ArrowUpDown,
  X,
  Inbox,
  ChevronLeft,
  ChevronRight,
  MapPin,
} from 'lucide-react';
import type { PropertyDemand, PropertyFilterState } from '../models/property.model';
import { INITIAL_FILTER_STATE } from '../models/property.model';
import { PropertyFilterSidebar } from './PropertyFilterSidebar';
import { PropertyCard } from './PropertyCard';
import { QuoteModal } from './QuoteModal';
import { PropertySearchForm } from './PropertySearchForm';
import { Breadcrumb } from '@/common/components/ui/Breadcrumb';
import { buildRoundTripBookingHref } from '../utils/roundTripBooking';

interface PropertyListProps {
  initialPosts: PropertyDemand[];
  hideSearchForm?: boolean;
  searchCriteria?: {
    tripType?: 'one-way' | 'round-trip';
    departureDate?: string;
    returnDate?: string;
  };
}

const ITEMS_PER_PAGE = 9;

const getTimeSlotFromDeparture = (departure?: string) => {
  const hour = Number(departure?.match(/\d{1,2}/)?.[0]);
  if (Number.isNaN(hour)) return '';
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  if (hour < 23) return 'evening';
  return 'night';
};

const getArrivalTime = (departure?: string) => {
  if (!departure) return '10:00';
  const [hour, minute] = departure.split(':').map(Number);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return '10:00';
  const totalMinutes = hour * 60 + minute + 210;
  return `${(Math.floor(totalMinutes / 60) % 24).toString().padStart(2, '0')}:${(totalMinutes % 60).toString().padStart(2, '0')}`;
};

const formatTripDate = (date?: string | null) => {
  if (!date) return 'Ngày đi chưa chọn';
  const parsedDate = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsedDate.getTime())) return date;
  return new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parsedDate);
};

const formatTripTabDate = (date?: string | null, fallback = 'Chưa chọn ngày') => {
  if (!date) return fallback;
  const parsedDate = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsedDate.getTime())) return date;
  const weekday = new Intl.DateTimeFormat('vi-VN', { weekday: 'long' }).format(parsedDate);
  const dayMonth = `${parsedDate.getDate().toString().padStart(2, '0')}/${(parsedDate.getMonth() + 1).toString().padStart(2, '0')}`;
  return `${weekday}, ${dayMonth}`;
};

type TripLeg = 'outbound' | 'return';

const getTripStops = (post: PropertyDemand, reverseRoute: boolean) => {
  const locationParts = post.location.split(' - ');
  const originalPickup = locationParts[0] || post.province;
  const originalDropoff = locationParts.length > 1
    ? locationParts.slice(1).join(' - ')
    : post.district;
  return reverseRoute
    ? { pickup: originalDropoff, dropoff: originalPickup }
    : { pickup: originalPickup, dropoff: originalDropoff };
};

const TripSummaryLeg = ({
  post,
  dateLabel,
  index,
  isActive,
  reverseRoute,
}: {
  post: PropertyDemand;
  dateLabel: string;
  index: number;
  isActive: boolean;
  reverseRoute: boolean;
}) => {
  const departureTime = post.direction || '08:00';
  const arrivalTime = getArrivalTime(post.direction);
  const { pickup, dropoff } = getTripStops(post, reverseRoute);

  return (
    <div className={`py-5 pr-5 pl-4 border-l-[4px] ${isActive ? 'border-[#F05929]' : 'border-slate-200'} bg-white`}>
      <div className="flex items-center gap-3.5">
        <div className={`w-[38px] h-[38px] rounded-[10px] flex items-center justify-center font-medium text-[18px] shrink-0 ${isActive ? 'bg-[#F05929] text-white' : 'bg-slate-300 text-white'}`}>
          {index}
        </div>
        <div className="min-w-0">
          <p className="text-[15px] text-[#111111] font-semibold">{dateLabel}</p>
          <p className="text-[14px] text-[#637280] font-normal mt-0.5 break-words line-clamp-2">{pickup} - {dropoff}</p>
        </div>
      </div>
      <div className="flex items-center justify-between mt-5">
        <span className="text-[18px] font-bold text-slate-900 w-12">{departureTime}</span>
        
        <div className="flex items-center flex-1 mx-3">
          <div className="w-[16px] h-[16px] rounded-full border-[4px] border-[#00674f] bg-white z-10 shrink-0" />
          <div className="flex-1 border-t-[2.5px] border-dotted border-slate-300 mx-1 flex items-center justify-center relative">
            <span className="bg-white px-2 text-[16px] font-medium text-[#637280] absolute">03:30 h</span>
          </div>
          <svg className="w-[20px] h-[20px] text-[#F05929] shrink-0 z-10" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
        </div>
        <span className="text-[18px] font-bold text-slate-900 w-12 text-right">{arrivalTime}</span>
      </div>
    </div>
  );
};

const TripSummaryCard = ({
  outboundPost,
  returnPost,
  outboundDateLabel,
  returnDateLabel,
  activeLeg,
}: {
  outboundPost: PropertyDemand | null;
  returnPost: PropertyDemand | null;
  outboundDateLabel: string;
  returnDateLabel: string;
  activeLeg: TripLeg;
}) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="py-4 px-5 border-b border-slate-200">
        <h3 className="text-[17px] font-bold text-[#111111] uppercase tracking-wide">Chuyến đi của bạn</h3>
      </div>
      {outboundPost && (
        <TripSummaryLeg
          post={outboundPost}
          dateLabel={outboundDateLabel}
          index={1}
          isActive={activeLeg === 'outbound'}
          reverseRoute={false}
        />
      )}
      {returnPost && (
        <div className="border-t border-slate-200">
          <TripSummaryLeg
            post={returnPost}
            dateLabel={returnDateLabel}
            index={2}
            isActive={activeLeg === 'return'}
            reverseRoute={true}
          />
        </div>
      )}
    </div>
  );
};

const PropertyListContent: React.FC<PropertyListProps> = ({ initialPosts, hideSearchForm, searchCriteria }) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlNeedType = searchParams?.get('needType');
  const urlCategory = searchParams?.get('category') || searchParams?.get('type');
  const urlKeyword = searchParams?.get('keyword');
  const urlDirection = searchParams?.get('direction');
  const urlTripType = searchCriteria?.tripType || searchParams?.get('tripType');
  const isRoundTrip = urlTripType === 'round-trip';
  const departureDate = searchCriteria?.departureDate || searchParams?.get('price');
  const returnDate = searchCriteria?.returnDate || searchParams?.get('returnDate');

  const [filters, setFilters] = useState<PropertyFilterState>(() => ({
    ...INITIAL_FILTER_STATE,
    needType: (urlNeedType === 'BUY' || urlNeedType === 'RENT') ? urlNeedType : 'ALL',
    propertyType: urlCategory || '',
    keyword: urlKeyword || '',
    direction: urlDirection || '',
  }));

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [mobileFilterOpen, setMobileFilterOpen] = useState<boolean>(false);
  const [quotePost, setQuotePost] = useState<PropertyDemand | null>(null);
  const [activeTripLeg, setActiveTripLeg] = useState<TripLeg>('outbound');
  const [selectedOutboundPost, setSelectedOutboundPost] = useState<PropertyDemand | null>(null);
  const [selectedReturnPost, setSelectedReturnPost] = useState<PropertyDemand | null>(null);

  // Filter and sort logic
  const filteredPosts = useMemo(() => {
    return initialPosts.filter((post) => {
      // 1. NeedType filter (Only show BUY on trips page)
      if (post.needType !== 'BUY') {
        return false;
      }

      // 2. Keyword search
      if (filters.keyword.trim()) {
        const query = filters.keyword.toLowerCase();
        const matchTitle = post.title.toLowerCase().includes(query);
        const matchLocation = post.location.toLowerCase().includes(query);
        const matchDesc = post.description?.toLowerCase().includes(query);
        const matchType = post.propertyType.toLowerCase().includes(query);
        if (!matchTitle && !matchLocation && !matchDesc && !matchType) return false;
      }

      // 3. Property type
      if (filters.propertyType && !post.propertyType.toLowerCase().includes(filters.propertyType.toLowerCase())) {
        return false;
      }

      // 4. Province
      if (filters.province && !post.province.toLowerCase().includes(filters.province.toLowerCase()) && !post.location.toLowerCase().includes(filters.province.toLowerCase())) {
        return false;
      }

      // 5. Price Range Filter
      if (filters.direction && getTimeSlotFromDeparture(post.direction) !== filters.direction) {
        return false;
      }

      // 6. Price Range Filter
      if (filters.priceRange) {
        const [minStr, maxStr] = filters.priceRange.split('-');
        const min = Number(minStr) || 0;
        const max = Number(maxStr) || 999999;
        if (post.minPriceNum !== undefined && post.maxPriceNum !== undefined) {
          if (post.maxPriceNum < min || post.minPriceNum > max) return false;
        }
      }

      // 7. Area Range Filter
      if (filters.areaRange) {
        const [minStr, maxStr] = filters.areaRange.split('-');
        const min = Number(minStr) || 0;
        const max = Number(maxStr) || 999999;
        if (post.minAreaNum !== undefined) {
          if (post.minAreaNum < min || post.minAreaNum > max) return false;
        }
      }

      return true;
    }).sort((a, b) => {
      if (filters.sortBy === 'PRICE_ASC') {
        return (a.minPriceNum || 0) - (b.minPriceNum || 0);
      }
      if (filters.sortBy === 'PRICE_DESC') {
        return (b.maxPriceNum || 0) - (a.maxPriceNum || 0);
      }
      if (filters.sortBy === 'AREA_DESC') {
        return (b.minAreaNum || 0) - (a.minAreaNum || 0);
      }
      // Default: NEWEST
      return Number(b.id) - Number(a.id);
    });
  }, [initialPosts, filters]);

  // Active filters list for chips
  const activeChips = useMemo(() => {
    const chips: { label: string; key: keyof PropertyFilterState }[] = [];
    if (filters.needType !== 'ALL') {
      chips.push({
        label: 'Chọn chuyến',
        key: 'needType',
      });
    }
    if (filters.keyword) {
      chips.push({ label: `Từ khóa: "${filters.keyword}"`, key: 'keyword' });
    }
    if (filters.propertyType) {
      chips.push({ label: `Loại: ${filters.propertyType}`, key: 'propertyType' });
    }
    if (filters.province) {
      chips.push({ label: `Tỉnh/Thành: ${filters.province}`, key: 'province' });
    }
    if (filters.priceRange) {
      chips.push({ label: `Khoảng giá`, key: 'priceRange' });
    }
    if (filters.direction) {
      const labels: Record<string, string> = {
        morning: 'Sáng',
        afternoon: 'Chiều',
        evening: 'Tối',
        night: 'Đêm',
      };
      chips.push({ label: `Khung giờ: ${labels[filters.direction] || filters.direction}`, key: 'direction' });
    }
    if (filters.areaRange) {
      chips.push({ label: `Ghế trống / khối lượng`, key: 'areaRange' });
    }
    return chips;
  }, [filters]);

  const removeFilterChip = (key: keyof PropertyFilterState) => {
    setFilters((prev) => ({
      ...prev,
      [key]: INITIAL_FILTER_STATE[key],
    }));
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setFilters(INITIAL_FILTER_STATE);
    setCurrentPage(1);
    setSelectedOutboundPost(null);
    setSelectedReturnPost(null);
    setActiveTripLeg('outbound');
  };

  const handleSelectTrip = (post: PropertyDemand) => {
    if (isRoundTrip && activeTripLeg === 'return') {
      setSelectedReturnPost(post);
      return;
    }
    setSelectedOutboundPost(post);
  };

  const handleChooseTrip = (post: PropertyDemand) => {
    if (isRoundTrip) {
      if (activeTripLeg === 'outbound') {
        setSelectedOutboundPost(post);
        setActiveTripLeg('return');
        setCurrentPage(1);
        return;
      }
      setSelectedReturnPost(post);
      if (selectedOutboundPost) {
        const bookingParams = new URLSearchParams(searchParams?.toString() || '');
        if (departureDate) bookingParams.set('price', departureDate);
        if (returnDate) bookingParams.set('returnDate', returnDate);
        bookingParams.set('needType', 'BUY');
        router.push(buildRoundTripBookingHref({
          currentSearch: bookingParams.toString(),
          outboundId: selectedOutboundPost.id,
          returnId: post.id,
        }));
      }
      return;
    }

    const detailParams = new URLSearchParams(searchParams?.toString() || '');
    if (!detailParams.has('needType')) {
      detailParams.set('needType', 'BUY');
    }
    const queryString = detailParams.toString();
    router.push(`/posts/${post.id}${queryString ? `?${queryString}` : ''}`);
  };

  // Pagination calculation
  const totalPages = Math.ceil(filteredPosts.length / ITEMS_PER_PAGE) || 1;
  const paginatedPosts = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredPosts.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredPosts, currentPage]);
  const outboundDateLabel = formatTripDate(departureDate);
  const returnDateLabel = formatTripDate(returnDate);
  const activeSelectedPost = activeTripLeg === 'return'
    ? selectedReturnPost
    : selectedOutboundPost;

  return (
    <div className="w-full max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-5 font-sans space-y-4 bg-[#F8FAF9]">
      {!hideSearchForm && (
        <>
          <Breadcrumb items={[{ label: 'Danh sách chuyến xe' }]} />
          <PropertySearchForm />
        </>
      )}

      <div className="bg-white rounded-lg border border-slate-200 p-4 md:p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-950">
              Chọn chuyến xe phù hợp
            </h1>
            <p className="mt-1 text-sm text-slate-500 font-medium">
              So sánh giờ đi, loại xe, số ghế trống, giá vé và chính sách trước khi chọn chỗ.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2">
              <p className="text-base font-black text-brand">{filteredPosts.length}</p>
              <p className="text-[10px] font-bold text-emerald-800">kết quả</p>
            </div>
            <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2">
              <p className="text-base font-black text-amber-700">10p</p>
              <p className="text-[10px] font-bold text-amber-800">giữ ghế</p>
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
              <p className="text-base font-black text-slate-800">QR</p>
              <p className="text-[10px] font-bold text-slate-500">vé điện tử</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Sidebar Filter + Results */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(340px,30%)_minmax(0,1fr)] gap-6 xl:gap-8 items-start relative">
        {/* Desktop Sticky Sidebar (1 Col) */}
        <div className="hidden lg:block sticky top-20 self-start max-h-[calc(100vh-6rem)] overflow-y-auto pr-1 z-10 space-y-5">
          {(selectedOutboundPost || selectedReturnPost) && (
            <TripSummaryCard
              outboundPost={selectedOutboundPost}
              returnPost={selectedReturnPost}
              outboundDateLabel={outboundDateLabel}
              returnDateLabel={returnDateLabel}
              activeLeg={activeTripLeg}
            />
          )}
          <PropertyFilterSidebar
            filters={filters}
            onFilterChange={(newFilters) => {
              setFilters(newFilters);
              setCurrentPage(1);
            }}
            onReset={handleResetFilters}
            totalCount={filteredPosts.length}
          />
        </div>

        {/* Mobile Filter Toggle Button */}
        <div className="lg:hidden flex items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
            <SlidersHorizontal className="w-4 h-4 text-brand" />
            <span>Bộ lọc tìm kiếm ({activeChips.length})</span>
          </div>
          <button
            type="button"
            onClick={() => setMobileFilterOpen(!mobileFilterOpen)}
            className="px-3 py-1.5 rounded-xl bg-brand text-white text-xs font-bold flex items-center gap-1 shadow-sm cursor-pointer"
          >
            <span>{mobileFilterOpen ? 'Đóng bộ lọc' : 'Mở bộ lọc'}</span>
          </button>
        </div>

        {/* Mobile Filter Expandable Panel */}
        {mobileFilterOpen && (
          <div className="lg:hidden col-span-1">
            <PropertyFilterSidebar
              filters={filters}
              onFilterChange={(newFilters) => {
                setFilters(newFilters);
                setCurrentPage(1);
              }}
              onReset={handleResetFilters}
              totalCount={filteredPosts.length}
            />
          </div>
        )}

        {(selectedOutboundPost || selectedReturnPost) && (
          <div className="lg:hidden">
            <TripSummaryCard
              outboundPost={selectedOutboundPost}
              returnPost={selectedReturnPost}
              outboundDateLabel={outboundDateLabel}
              returnDateLabel={returnDateLabel}
              activeLeg={activeTripLeg}
            />
          </div>
        )}

        {/* Post Results List (3 Cols of Grid - Each Row has 3 Cards on XL) */}
        <div className="min-w-0 space-y-5">
          {isRoundTrip && (
            <div className="flex bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm" role="tablist" aria-label="Chọn chiều chuyến đi">
              <button
                type="button"
                role="tab"
                aria-selected={activeTripLeg === 'outbound'}
                onClick={() => {
                  setActiveTripLeg('outbound');
                  setCurrentPage(1);
                }}
                className={`flex-1 min-h-14 px-3 text-center text-[13px] uppercase transition-colors cursor-pointer border-b-[3px] ${
                  activeTripLeg === 'outbound'
                    ? 'border-accent text-accent font-black'
                    : 'border-transparent text-slate-800 font-bold hover:text-accent hover:bg-orange-50/40'
                }`}
              >
                Chuyến đi - {formatTripTabDate(departureDate, 'Ngày đi')}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTripLeg === 'return'}
                onClick={() => {
                  setActiveTripLeg('return');
                  setCurrentPage(1);
                }}
                className={`flex-1 min-h-14 px-3 text-center text-[13px] uppercase transition-colors cursor-pointer border-b-[3px] ${
                  activeTripLeg === 'return'
                    ? 'border-accent text-accent font-black'
                    : 'border-transparent text-slate-800 font-bold hover:text-accent hover:bg-orange-50/40'
                }`}
              >
                Chuyến về - {formatTripTabDate(returnDate, 'Ngày về')}
              </button>
            </div>
          )}

          {/* Top Bar: Total Count + Sort Dropdown */}
          <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">
                Tìm thấy <strong className="text-brand font-black text-sm">{filteredPosts.length}</strong> chuyến xe phù hợp
              </span>
            </div>

            {/* Sort selection */}
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <span className="text-xs text-slate-500 font-semibold flex items-center gap-1">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                <span>Sắp xếp:</span>
              </span>
              <select
                value={filters.sortBy}
                onChange={(e) => {
                  setFilters({ ...filters, sortBy: e.target.value as PropertyFilterState['sortBy'] });
                  setCurrentPage(1);
                }}
                className="px-3 py-1.5 text-xs font-bold text-slate-800 bg-slate-50 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand cursor-pointer"
              >
                <option value="NEWEST">Mới cập nhật</option>
                <option value="PRICE_ASC">Giá tăng dần</option>
                <option value="PRICE_DESC">Giá giảm dần</option>
                <option value="AREA_DESC">Nhiều ghế nhất</option>
              </select>
            </div>
          </div>

          {/* Active Filter Chips */}
          {activeChips.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 bg-emerald-50/50 p-3 rounded-lg border border-emerald-100">
              <span className="text-[11px] font-bold text-brand uppercase tracking-wider">
                Đang lọc:
              </span>
              {activeChips.map((chip) => (
                <span
                  key={chip.key}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-slate-200 text-xs font-semibold text-slate-700 shadow-2xs"
                >
                  <span>{chip.label}</span>
                  <button
                    type="button"
                    onClick={() => removeFilterChip(chip.key)}
                    className="text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-xs font-bold text-rose-600 hover:underline ml-auto cursor-pointer"
              >
                Xóa tất cả
              </button>
            </div>
          )}

          {/* Trip rows */}
          {paginatedPosts.length > 0 ? (
            <div className="grid grid-cols-1 gap-3">
              {paginatedPosts.map((post) => (
                <PropertyCard
                  key={post.id}
                  post={post}
                  isActive={activeSelectedPost?.id === post.id}
                  reverseRoute={isRoundTrip && activeTripLeg === 'return'}
                  onSelect={handleSelectTrip}
                  onChoose={handleChooseTrip}
                  onOpenQuote={(p) => setQuotePost(p)}
                />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-4 shadow-sm">
              <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <Inbox className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-extrabold text-slate-900">
                  Không tìm thấy chuyến xe phù hợp
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Rất tiếc, hiện tại không có chuyến xe nào phù hợp với bộ lọc tìm kiếm của bạn. Hãy thử nới lỏng hoặc đặt lại bộ lọc.
                </p>
              </div>
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-4 py-2 rounded-xl bg-brand text-white text-xs font-bold inline-flex items-center gap-2 shadow-sm hover:bg-brand-hover transition-colors cursor-pointer"
              >
                <span>Đặt lại tất cả bộ lọc</span>
              </button>
            </div>
          )}

          {/* Compact Pagination styled EXACTLY like user reference image */}
          <div className="flex items-center justify-center gap-2 pt-6 pb-2">
            {/* Previous Arrow */}
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="Trang trước"
            >
              <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
            </button>

            {/* Page Numbers */}
            <div className="flex items-center gap-1.5">
              {(() => {
                const getPageNumbers = (current: number, total: number) => {
                  if (total <= 7) {
                    return Array.from({ length: total }, (_, i) => i + 1);
                  }
                  const pages: (number | string)[] = [];
                  if (current <= 4) {
                    pages.push(1, 2, 3, 4, 5, '...', total);
                  } else if (current >= total - 3) {
                    pages.push(1, '...', total - 4, total - 3, total - 2, total - 1, total);
                  } else {
                    pages.push(1, '...', current - 1, current, current + 1, '...', total);
                  }
                  return pages;
                };

                return getPageNumbers(currentPage, totalPages).map((item, idx) => {
                  if (typeof item === 'string') {
                    return (
                      <span key={`dots-${idx}`} className="w-5 h-7 flex items-center justify-center text-slate-400 text-xs font-bold tracking-widest select-none">
                        ...
                      </span>
                    );
                  }
                  const isCurrent = currentPage === item;
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setCurrentPage(item)}
                      className={`w-7 h-7 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center justify-center ${
                        isCurrent
                          ? 'bg-brand text-white font-bold shadow-2xs'
                          : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/70'
                      }`}
                    >
                      {item}
                    </button>
                  );
                });
              })()}
            </div>

            {/* Next Arrow in soft gray square */}
            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="w-7 h-7 rounded-md bg-slate-100 hover:bg-slate-200/80 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors cursor-pointer ml-0.5"
              title="Trang sau"
            >
              <ChevronRight className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </div>
      </div>

      {/* Quote Modal Popup */}
      <QuoteModal
        post={quotePost}
        isOpen={!!quotePost}
        onClose={() => setQuotePost(null)}
      />
    </div>
  );
};

export const PropertyList: React.FC<PropertyListProps> = (props) => {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-500">Đang tải danh sách tin...</div>}>
      <PropertyListContent {...props} />
    </Suspense>
  );
};

export default PropertyList;
