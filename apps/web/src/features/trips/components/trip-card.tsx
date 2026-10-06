'use client';

import { MapPin } from 'lucide-react';
import type { Trip } from '@/types/customer';

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
  return (
    <div
      onClick={() => onSelect?.(trip)}
      className={`bg-white rounded-xl transition cursor-pointer select-none ${
        isSelected
          ? 'border-[3px] border-[#ea4a18] shadow-[0_0_0_4px_rgba(240,81,35,0.2)] shadow-lg'
          : 'border-2 border-slate-300 shadow-sm hover:border-[#f05123] hover:shadow-md'
      }`}
    >
      <div className="p-5">
        {/* Operator Name */}
        <div className="mb-4 flex items-center gap-2">
          <h3 className="text-lg font-black text-[#0060c4] uppercase tracking-wide drop-shadow-sm">
            Nhà xe {trip.operator}
          </h3>
        </div>

        {/* Row 1: Times + Route info + Price */}
        <div className="flex items-start justify-between gap-4">
          {/* Left: departure time + origin */}
          <div className="w-14 shrink-0">
            <span className="text-xl font-bold text-slate-800">
              {trip.departureTime}
            </span>
            <p className="text-[12px] font-bold text-slate-700 mt-0.5">
              {trip.origin}
            </p>
          </div>

          {/* Center: Timeline + Route info */}
          <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
            {/* Horizontal timeline: ○ ········ 📍 */}
            <div className="flex items-center gap-1.5 w-full">
              <div className="w-3 h-3 rounded-full border-[3px] border-[#00b14f] bg-white shrink-0"></div>
              <div className="flex-1 border-t-2 border-dotted border-slate-300"></div>
              <MapPin
                size={14}
                className="text-[#f05123] shrink-0"
                fill="#f05123"
              />
            </div>
            <div className="text-center">
              <p className="text-[12px] font-semibold text-slate-600 whitespace-nowrap">
                {trip.duration}
              </p>
              <p className="text-[10px] text-slate-400 italic">
                (Asian/Ho Chi Minh)
              </p>
            </div>
          </div>

          {/* Arrival time + destination */}
          <div className="w-14 shrink-0 text-center">
            <span className="text-xl font-bold text-slate-800">
              {trip.arrivalTime}
            </span>
            <p className="text-[12px] font-bold text-slate-700 mt-0.5">
              {trip.destination}
            </p>
          </div>

          {/* Right: vehicle + seats + price */}
          <div className="shrink-0 text-right ml-4">
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
      </div>

      {/* Bottom actions */}
      <div className="flex justify-end items-center px-5 py-3 border-t border-slate-200">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onChoose?.(trip);
          }}
          className="bg-[#f05123] hover:bg-[#d8441a] text-white px-6 py-2 rounded-lg text-[13px] font-bold transition-colors shadow-sm"
        >
          Chọn chuyến
        </button>
      </div>
    </div>
  );
}
