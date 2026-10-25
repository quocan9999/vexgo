'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Loader2,
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
  const [alternatives, setAlternatives] = useState<AlternativeTripItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
            Gợi ý chuyến thay thế từ nhà xe khác
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

  return (
    <section className={`rounded-2xl border border-blue-100 bg-gradient-to-b from-blue-50/50 to-white p-5 shadow-sm ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-blue-100/80">
        <div>
          <h3 className="font-black text-slate-900 text-base">
            Gợi ý chuyến thay thế từ nhà xe khác
          </h3>
          <p className="text-xs text-slate-500 font-medium">
            Cùng tuyến, cùng giờ khởi hành và giá vé tiết kiệm hơn hoặc tương đương
          </p>
        </div>
        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-100/80 text-[#0060c4]">
          {alternatives.length} lựa chọn
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {alternatives.map((item) => {
          const savings =
            currentPrice && item.price < currentPrice
              ? currentPrice - item.price
              : 0;

          return (
            <div
              key={item.tripId}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs hover:shadow-md hover:border-[#0060c4] transition-all flex flex-col justify-between"
            >
              <div>
                {/* Operator info + Rating */}
                <div className="flex items-start justify-between gap-2 mb-2.5">
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-sm">
                      {item.busCompanyName}
                    </h4>
                    <span className="text-[11px] font-semibold text-slate-500">
                      {item.vehicleTypeName}
                    </span>
                  </div>

                  {typeof item.rating === 'number' && item.rating > 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                      {item.rating.toFixed(1)}/5
                    </span>
                  )}
                </div>

                {/* Departure & Arrival times */}
                <div className="flex items-center justify-between bg-slate-50 rounded-lg p-2.5 mb-2.5 text-xs">
                  <div>
                    <span className="font-black text-slate-900 text-sm">
                      {item.departureTime}
                    </span>
                    <p className="text-slate-500 text-[11px] font-medium">
                      {item.fromCityName}
                    </p>
                  </div>

                  <div className="flex flex-col items-center px-2">
                    <span className="text-[10px] font-bold text-slate-400">
                      {item.duration || 'Lộ trình'}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 my-0.5" />
                  </div>

                  <div className="text-right">
                    <span className="font-black text-slate-900 text-sm">
                      {item.arrivalTime}
                    </span>
                    <p className="text-slate-500 text-[11px] font-medium">
                      {item.toCityName}
                    </p>
                  </div>
                </div>

                {/* Badges / Reasons */}
                <div className="flex flex-wrap items-center gap-1.5 mb-3">
                  {savings > 0 && (
                    <span className="inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Tiết kiệm {formatCurrency(savings)}
                    </span>
                  )}
                  {item.recommendationReason.includes('Cùng giờ') && (
                    <span className="inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200">
                      Cùng giờ khởi hành
                    </span>
                  )}
                  <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                    Còn {item.availableSeats} chỗ trống
                  </span>
                </div>
              </div>

              {/* Bottom: Price + Button */}
              <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 mt-auto">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Giá vé
                  </span>
                  <span className="text-base font-black text-[#f05123]">
                    {formatCurrency(item.price)}
                  </span>
                </div>

                {onSelectAlternative ? (
                  <button
                    type="button"
                    onClick={() => onSelectAlternative(item)}
                    className="px-3.5 py-1.5 rounded-lg bg-[#0060c4] hover:bg-blue-700 active:scale-95 text-white font-bold text-xs transition-all shadow-xs cursor-pointer"
                  >
                    Chọn chuyến này
                  </button>
                ) : (
                  <Link
                    href={`/trips/${item.tripId}`}
                    className="px-3.5 py-1.5 rounded-lg bg-[#0060c4] hover:bg-blue-700 active:scale-95 text-white font-bold text-xs transition-all shadow-xs cursor-pointer"
                  >
                    Chọn chuyến này
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
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
