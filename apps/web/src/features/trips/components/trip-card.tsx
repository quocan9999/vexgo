'use client';

import React, { useState } from 'react';
import { MapPin, Star } from 'lucide-react';
import type { Trip } from '@/types/customer';
import { AlternativeTripsModal } from './alternative-trips';

interface TripCardProps {
  trip: Trip;
  isSelected?: boolean;
  onSelect?: (trip: Trip) => void;
  onChoose?: (trip: Trip) => void;
}

export function TripCard({
  trip,
  isSelected = false,
  onSelect,
  onChoose,
}: TripCardProps) {
  const [showAlternatives, setShowAlternatives] = useState(false);
  const operatorName = trip.operator.replace(/^Nhà xe\s+/i, '');

  return (
    <>
      <div
        onClick={() => onSelect?.(trip)}
        className={`bg-white rounded-2xl transition-all duration-200 cursor-pointer select-none overflow-hidden ${
          isSelected
            ? 'border-2 border-[#FF5722] shadow-[0_0_0_3px_rgba(255,87,34,0.18)] shadow-lg'
            : 'border border-slate-200/90 shadow-sm hover:border-[#FF5722]/80 hover:shadow-md'
        }`}
      >
        <div className="p-5 sm:p-6">
          {/* Operator Name & Rating */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Nhà xe
              </span>
              <h3 className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-wide">
                {operatorName}
              </h3>

              {typeof trip.rating === 'number' &&
                Number.isFinite(trip.rating) &&
                trip.rating > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs ml-1">
                    <Star size={13} className="fill-amber-400 text-amber-400" />
                    <span>{trip.rating.toFixed(1)}/5</span>
                  </span>
                )}
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowAlternatives(true);
              }}
              className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold text-[#2563EB] hover:bg-blue-50 border border-blue-200 transition-colors cursor-pointer"
            >
              Gợi ý chuyến thay thế
            </button>
          </div>

          {/* Row 1: Times + Route info + Price */}
          <div className="flex items-start justify-between gap-4">
            {/* Left: departure time + origin */}
            <div className="w-16 shrink-0">
              <span className="text-xl sm:text-2xl font-black text-slate-900">
                {trip.departureTime}
              </span>
              <p className="text-xs font-bold text-slate-600 mt-0.5 truncate">
                {trip.origin}
              </p>
            </div>

            {/* Center: Timeline + Route info */}
            <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
              {/* Horizontal timeline: ○ ········ 📍 */}
              <div className="flex items-center gap-1.5 w-full">
                <div className="w-3 h-3 rounded-full border-[3px] border-emerald-500 bg-white shrink-0" />
                <div className="flex-1 border-t-2 border-dotted border-slate-300" />
                <MapPin
                  size={15}
                  className="text-[#FF5722] shrink-0"
                  fill="#FF5722"
                />
              </div>
              <div className="text-center">
                <p className="text-xs font-semibold text-slate-600 whitespace-nowrap">
                  {trip.duration}
                </p>
                <p className="text-[10px] text-slate-400 italic">
                  (Asia/Ho Chi Minh)
                </p>
              </div>
            </div>

            {/* Arrival time + destination */}
            <div className="w-16 shrink-0 text-center">
              <span className="text-xl sm:text-2xl font-black text-slate-900">
                {trip.arrivalTime}
              </span>
              <p className="text-xs font-bold text-slate-600 mt-0.5 truncate">
                {trip.destination}
              </p>
            </div>

            {/* Right: vehicle + seats + price */}
            <div className="shrink-0 text-right ml-4">
              <div className="flex items-center justify-end gap-2 text-xs text-slate-500 mb-1">
                <span className="font-semibold uppercase text-slate-600">{trip.vehicleType}</span>
                <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                <span className="font-extrabold text-emerald-600">
                  {trip.availableSeats} ghế trống
                </span>
              </div>
              <div className="text-xl sm:text-2xl font-black text-[#FF5722]">
                {Number.isFinite(trip.price)
                  ? `${new Intl.NumberFormat('vi-VN').format(trip.price)}đ`
                  : 'Liên hệ'}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom actions */}
        <div className="flex justify-end items-center px-5 sm:px-6 py-3.5 border-t border-slate-100 bg-slate-50/70">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChoose?.(trip);
            }}
            className="bg-gradient-to-r from-[#FF5722] to-[#FF7043] hover:from-[#E64A19] hover:to-[#FF5722] text-white px-7 py-2.5 rounded-xl text-sm font-extrabold transition-all shadow-sm shadow-[#FF5722]/20 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
          >
            Chọn chuyến
          </button>
        </div>
      </div>

      <AlternativeTripsModal
        isOpen={showAlternatives}
        onClose={() => setShowAlternatives(false)}
        tripId={Number(trip.id)}
        currentPrice={Number.isFinite(trip.price) ? trip.price : undefined}
        tripName={`Nhà xe ${trip.operator} (${trip.origin} → ${trip.destination})`}
      />
    </>
  );
}
