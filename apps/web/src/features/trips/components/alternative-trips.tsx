'use client';

import React, { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Clock,
  Loader2,
  MapPin,
  Star,
  X,
} from 'lucide-react';
import {
  tripsApi,
  type AlternativeTripItem,
} from '@/features/trips/services/trips.api';
import { formatCurrency } from '@/lib/format';

interface AlternativeTripsProps {
  tripId: number;
  currentPrice?: number;
  className?: string;
  onSelectAlternative?: (trip: AlternativeTripItem) => void;
}

export const AlternativeTripsSection: React.FC<AlternativeTripsProps> = ({
  tripId,
  currentPrice,
  className = '',
  onSelectAlternative,
}) => {
  const t = useTranslations('trips');
  const locale = useLocale();
  const [alternatives, setAlternatives] = useState<AlternativeTripItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) setIsLoading(true);
    });

    tripsApi
      .getTripAlternatives(tripId, {
        otherOperatorsOnly: true,
        maxPrice: currentPrice,
        limit: 5,
      })
      .then((data) => {
        if (!active) return;
        setAlternatives(data);
      })
      .catch(() => {
        if (!active) return;
        setAlternatives([]);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [tripId, currentPrice]);

  if (isLoading) {
    return (
      <div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
        <div className="mb-4">
          <h3 className="font-black text-slate-900 text-base">
            {t('alternativeModalTitle')}
          </h3>
        </div>
        <div className="flex items-center justify-center py-8 text-slate-400 gap-2 text-sm font-semibold">
          <Loader2 className="w-5 h-5 animate-spin text-[#0060c4]" />
          <span>Đang tìm kiếm các chuyến xe phù hợp...</span>
        </div>
      </div>
    );
  }

  if (alternatives.length === 0) {
    return null;
  }

  const visibleAlternatives = isExpanded ? alternatives : alternatives.slice(0, 2);
  const remainingCount = alternatives.length - 2;

  return (
    <section className={`rounded-2xl border border-blue-100 bg-gradient-to-b from-blue-50/50 to-white p-5 shadow-sm ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-blue-100/80">
        <div>
          <h3 className="font-black text-slate-900 text-base">
            {t('alternativeModalTitle')}
          </h3>
          <p className="text-xs text-slate-500 font-medium">
            Cùng tuyến, cùng giờ khởi hành và giá vé tiết kiệm hơn hoặc tương đương
          </p>
        </div>
        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-100/80 text-[#0060c4]">
          {alternatives.length} lựa chọn
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {visibleAlternatives.map((item) => {
          const savings =
            currentPrice && item.price < currentPrice
              ? currentPrice - item.price
              : 0;
          const operatorName = item.busCompanyName.replace(/^Nhà xe\s+/i, '');

          return (
            <div
              key={item.tripId}
              className="rounded-xl border-2 border-slate-200 bg-white shadow-sm hover:border-[#f05123] hover:shadow-md transition-all flex flex-col justify-between overflow-hidden"
            >
              <div className="p-4 sm:p-5">
                {/* Operator info + Rating */}
                <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Nhà xe
                    </span>
                    <h4 className="text-sm sm:text-base font-black text-[#0060c4] uppercase tracking-wide">
                      {operatorName}
                    </h4>

                    {typeof item.rating === 'number' && item.rating > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs ml-1 shrink-0">
                        <Star size={12} className="fill-amber-400 text-amber-400" />
                        <span>{item.rating.toFixed(1)}/5</span>
                      </span>
                    )}
                  </div>

                  <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/80">
                    {item.vehicleTypeName}
                  </span>
                </div>

                {/* Departure & Arrival with horizontal timeline */}
                <div className="flex items-start justify-between gap-3 my-3">
                  {/* Left: departure */}
                  <div className="min-w-14 max-w-24 shrink-0">
                    <span className="text-lg sm:text-xl font-bold text-slate-800">
                      {item.departureTime}
                    </span>
                    <p className="text-[11px] font-bold text-slate-700 mt-0.5 leading-snug line-clamp-2" title={item.pickupPoint || item.fromCityName}>
                      {item.pickupPoint || item.fromCityName}
                    </p>
                  </div>

                  {/* Center: Timeline */}
                  <div className="flex flex-col items-center gap-1 flex-1 min-w-0 pt-1">
                    <div className="flex items-center gap-1.5 w-full">
                      <div className="w-2.5 h-2.5 rounded-full border-[2.5px] border-[#00b14f] bg-white shrink-0"></div>
                      <div className="flex-1 border-t-2 border-dotted border-slate-300"></div>
                      <MapPin
                        size={13}
                        className="text-[#f05123] shrink-0"
                        fill="#f05123"
                      />
                    </div>
                    <div className="text-center">
                      <p className="text-[11px] font-semibold text-slate-600 whitespace-nowrap">
                        {item.duration || 'Lộ trình'}
                      </p>
                    </div>
                  </div>

                  {/* Right: arrival */}
                  <div className="min-w-14 max-w-24 shrink-0 text-right">
                    <span className="text-lg sm:text-xl font-bold text-slate-800">
                      {item.arrivalTime}
                    </span>
                    <p className="text-[11px] font-bold text-slate-700 mt-0.5 leading-snug line-clamp-2" title={item.dropoffPoint || item.toCityName}>
                      {item.dropoffPoint || item.toCityName}
                    </p>
                  </div>
                </div>

                {/* Badges / Reasons & seats */}
                <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100">
                  {savings > 0 && (
                    <span className="inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {t('saving', { amount: formatCurrency(savings) })}
                    </span>
                  )}
                  {item.recommendationReason.includes('Cùng giờ') && (
                    <span className="inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200">
                      {t('sameDepartureTime')}
                    </span>
                  )}
                  <span className="text-[11px] font-bold text-[#00b14f] bg-emerald-50/60 px-2 py-0.5 rounded border border-emerald-200/60">
                    {t('seatsLeft', { count: item.availableSeats })}
                  </span>
                </div>
              </div>

              {/* Bottom: Price + Button */}
              <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-t border-slate-200 bg-slate-50/50 mt-auto">
                <div className="shrink-0">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    {t('fareLabel')}
                  </span>
                  <span className="text-lg sm:text-xl font-black text-[#f05123] whitespace-nowrap">
                    {formatCurrency(item.price)}
                  </span>
                </div>

                {onSelectAlternative ? (
                  <button
                    type="button"
                    onClick={() => onSelectAlternative(item)}
                    className="bg-[#f05123] hover:bg-[#d8441a] text-white px-4 sm:px-5 py-2 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 whitespace-nowrap shrink-0"
                  >
                    {t('chooseThisTrip')}
                  </button>
                ) : (
                  <Link
                    href={`/trips/${item.tripId}`}
                    className="bg-[#f05123] hover:bg-[#d8441a] text-white px-4 sm:px-5 py-2 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 whitespace-nowrap shrink-0"
                  >
                    {t('chooseThisTrip')}
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {alternatives.length > 2 && (
        <div className="mt-4 pt-3 text-center border-t border-blue-100/60">
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-white hover:bg-blue-50/80 border border-blue-200/80 text-xs font-bold text-[#0060c4] hover:text-blue-800 shadow-2xs hover:shadow-xs transition-all cursor-pointer active:scale-98"
          >
            {isExpanded ? (
              <>
                <span>Thu gọn danh sách</span>
                <ChevronUp className="w-4 h-4" />
              </>
            ) : (
              <>
                <span>Xem thêm {remainingCount} chuyến thay thế khác</span>
                <ChevronDown className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      )}
    </section>
  );
};

export interface AlternativeTripsModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripId: number;
  currentPrice?: number;
  tripName?: string;
}

export const AlternativeTripsModal: React.FC<AlternativeTripsModalProps> = ({
  isOpen,
  onClose,
  tripId,
  currentPrice,
  tripName,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white rounded-2xl w-full max-w-2xl max-h-[88vh] overflow-hidden shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div>
            <h3 className="font-black text-slate-900 text-base">
              Chuyến xe thay thế từ nhà xe khác
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto">
          {tripName && (
            <p className="text-xs font-semibold text-slate-500 mb-4">
              Đang so sánh chuyến: <strong className="text-slate-800">{tripName}</strong>
            </p>
          )}

          <AlternativeTripsSection
            tripId={tripId}
            currentPrice={currentPrice}
            className="border-0 shadow-none p-0 bg-transparent"
          />
        </div>
      </div>
    </div>
  );
};
