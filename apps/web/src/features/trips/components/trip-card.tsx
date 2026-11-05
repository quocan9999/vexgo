'use client';

import React, { useState } from 'react';
import { Clock, MapPin, Star } from 'lucide-react';
import { TripScheduleModal } from './trip-schedule-modal';
import type { Trip } from '@/types/customer';
import { AlternativeTripsModal } from './alternative-trips';
import { TripReviewsModal } from './trip-reviews-modal';

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
  const [showSchedule, setShowSchedule] = useState(false);
  const [showReviews, setShowReviews] = useState(false);
  const operatorName = trip.operator.replace(/^Nhà xe\s+/i, '');

  return (
    <>
      <div
        onClick={() => onSelect?.(trip)}
        className={`bg-white rounded-xl transition cursor-pointer select-none ${
          isSelected
            ? 'border-[3px] border-[#ea4a18] shadow-[0_0_0_4px_rgba(240,81,35,0.2)] shadow-lg'
            : 'border-2 border-slate-300 shadow-sm hover:border-[#f05123] hover:shadow-md'
        }`}
      >
        <div className="p-4 sm:p-5">
          {/* Operator Name, Rating & Price (on mobile) */}
          <div className="mb-3 sm:mb-4 flex items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0">
              <span className="text-[11px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Nhà xe
              </span>
              <h3 className="text-base sm:text-lg font-black text-[#0060c4] uppercase tracking-wide truncate">
                {operatorName}
              </h3>

              {typeof trip.rating === 'number' && Number.isFinite(trip.rating) && trip.rating > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowReviews(true);
                  }}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] sm:text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 shadow-2xs cursor-pointer transition-colors shrink-0"
                  title="Xem đánh giá từ khách hàng"
                >
                  <Star size={12} className="fill-amber-400 text-amber-400" />
                  <span>{trip.rating.toFixed(1)}/5</span>
                </button>
              )}
            </div>

            {/* Price on mobile (prominent at top right) */}
            <div className="sm:hidden text-right shrink-0">
              <span className="text-lg font-black text-[#f05123]">
                {Number.isFinite(trip.price)
                  ? `${new Intl.NumberFormat('vi-VN').format(trip.price)}đ`
                  : 'Liên hệ'}
              </span>
            </div>

            {/* Desktop right: Schedule button */}
            <div className="hidden sm:flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSchedule(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold text-slate-700 hover:text-[#f05123] hover:bg-orange-50 border border-slate-200 hover:border-orange-200 transition-colors cursor-pointer"
              >
                <Clock size={13} className="text-[#f05123]" />
                Lịch trình
              </button>
            </div>
          </div>

          {/* Row 1: Times + Route info + (Price on desktop) */}
          <div className="flex items-start justify-between gap-3 sm:gap-4">
            {/* Left: departure time + origin/pickupPoint */}
            <div className="min-w-[64px] sm:min-w-16 max-w-[110px] sm:max-w-28 shrink-0">
              <span className="text-lg sm:text-xl font-bold text-slate-800">
                {trip.departureTime}
              </span>
              <p className="text-[11px] sm:text-[12px] font-bold text-slate-700 mt-0.5 leading-snug line-clamp-2" title={trip.pickupPoint || trip.origin}>
                {trip.pickupPoint || trip.origin}
              </p>
            </div>

            {/* Center: Timeline + Route info */}
            <div className="flex flex-col items-center gap-1 flex-1 min-w-0 px-1">
              {/* Horizontal timeline: ○ ········ 📍 */}
              <div className="flex items-center gap-1.5 w-full">
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full border-[2.5px] sm:border-[3px] border-[#00b14f] bg-white shrink-0"></div>
                <div className="flex-1 border-t-2 border-dotted border-slate-300"></div>
                <MapPin
                  size={14}
                  className="text-[#f05123] shrink-0"
                  fill="#f05123"
                />
              </div>
              <div className="text-center">
                <p className="text-[11px] sm:text-[12px] font-semibold text-slate-600 whitespace-nowrap">
                  {trip.duration}
                </p>
              </div>
            </div>

            {/* Arrival time + destination/dropoffPoint */}
            <div className="min-w-[64px] sm:min-w-16 max-w-[110px] sm:max-w-28 shrink-0 text-right sm:text-center">
              <span className="text-lg sm:text-xl font-bold text-slate-800">
                {trip.arrivalTime}
              </span>
              <p className="text-[11px] sm:text-[12px] font-bold text-slate-700 mt-0.5 leading-snug line-clamp-2" title={trip.dropoffPoint || trip.destination}>
                {trip.dropoffPoint || trip.destination}
              </p>
            </div>

            {/* Right on desktop only: vehicle + seats + price */}
            <div className="hidden sm:block shrink-0 text-right ml-4">
              <div className="flex items-center justify-end gap-2 text-[12px] text-slate-500 mb-1">
                <span className="font-medium uppercase">{trip.vehicleType}</span>
                <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
                <span className="font-bold text-[#00b14f]">
                  {trip.availableSeats} ghế trống
                </span>
              </div>
              <div className="text-xl font-bold text-[#f05123]">
                {Number.isFinite(trip.price)
                  ? `${new Intl.NumberFormat('vi-VN').format(trip.price)}đ`
                  : 'Liên hệ'}
              </div>
            </div>
          </div>

          {/* Vehicle & Seats info on mobile (under timeline) */}
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex sm:hidden items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-1.5 truncate">
              <span className="font-semibold text-slate-700 uppercase truncate text-[11px]">{trip.vehicleType}</span>
              <span className="text-slate-300">•</span>
              <span className="font-bold text-[#00b14f] text-[11px] whitespace-nowrap">
                {trip.availableSeats} ghế trống
              </span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowSchedule(true);
              }}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-[#f05123] hover:underline cursor-pointer shrink-0 ml-2"
            >
              <Clock size={12} />
              Lịch trình
            </button>
          </div>
        </div>

        {/* Bottom actions */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 p-3.5 sm:px-5 sm:py-3 border-t border-slate-200 bg-slate-50/50">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowReviews(true);
              }}
              className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 hover:border-amber-300 transition-all duration-200 cursor-pointer shadow-2xs hover:shadow-xs active:scale-95"
            >
              <Star size={13} className="fill-amber-400 text-amber-400" />
              <span>Xem đánh giá</span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowAlternatives(true);
              }}
              className="inline-flex items-center px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold text-[#0060c4] bg-white hover:bg-[#0060c4] hover:text-white border border-blue-200 hover:border-[#0060c4] transition-all duration-200 hover:shadow-xs active:scale-95 cursor-pointer"
              title="Xem gợi ý các chuyến xe thay thế"
            >
              Gợi ý chuyến thay thế
            </button>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChoose?.(trip);
            }}
            className="w-full sm:w-auto bg-[#f05123] hover:bg-[#d8441a] text-white px-5 sm:px-6 py-2 rounded-lg text-xs sm:text-[13px] font-bold transition-colors shadow-xs cursor-pointer text-center"
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

      <TripScheduleModal
        isOpen={showSchedule}
        onClose={() => setShowSchedule(false)}
        trip={trip}
      />

      <TripReviewsModal
        isOpen={showReviews}
        onClose={() => setShowReviews(false)}
        busCompanyId={trip.busCompanyId}
        tripId={Number(trip.id)}
        operatorName={operatorName}
        rating={trip.rating}
        reviewsCount={trip.reviewsCount}
        route={`${trip.origin} → ${trip.destination}`}
      />
    </>
  );
}
