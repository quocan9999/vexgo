/* eslint-disable */
// frontend/src/modules/client/property/components/PropertyCard.tsx
'use client';

import React from 'react';
import { Armchair } from 'lucide-react';
import type { Post } from '../types/post';
import { SeatMap } from '@/features/booking/components/seat-map';

interface PropertyCardProps {
  post: Post;
  onOpenQuote?: (post: Post) => void;
  onSelect?: (post: Post) => void;
  onChoose?: (post: Post) => void;
  isActive?: boolean;
  reverseRoute?: boolean;
}

export const PostCard: React.FC<PropertyCardProps> = ({
  post,
  onOpenQuote,
  onSelect,
  onChoose,
  isActive,
  reverseRoute = false,
}) => {
  const [activeTab, setActiveTab] = React.useState<string | null>(null);
  const isBuy = post.needType === 'BUY';

  const locationParts = post.location.split(' - ');
  const originalPickup = locationParts[0];
  const originalDropoff = locationParts.length > 1 ? locationParts.slice(1).join(' - ') : 'Chưa xác định';
  const pickup = reverseRoute ? originalDropoff : originalPickup;
  const dropoff = reverseRoute ? originalPickup : originalDropoff;
  
  const getArrivalTime = (timeStr?: string) => {
    if (!timeStr) return '10:00';
    const [h, m] = timeStr.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return '10:00';
    const newH = (h + 2) % 24;
    return `${newH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };
  
  const arrivalTime = getArrivalTime(post.direction);
  const departureTime = post.direction || '08:00';

  const handleCardClick = () => {
    if (isBuy) {
      onSelect?.(post);
      return;
    }

    onOpenQuote?.(post);
  };

  return (
    <div
      onClick={handleCardClick}
      className={`group/card overflow-hidden rounded-xl border bg-white transition-all duration-150 cursor-pointer p-4 md:p-5 ${isActive ? 'border-[#F05929] ring-1 ring-[#F05929] shadow-sm' : 'border-slate-200 hover:border-[#F05929]/50 hover:shadow-md'}`}
      aria-pressed={isActive}
    >
      {/* Grid Layout for Timeline, Locations, Tags, Price */}
      <div className="w-full">
        <div className="grid grid-cols-[minmax(60px,auto)_1fr_minmax(60px,auto)_auto] gap-x-2 sm:gap-x-4 gap-y-1 items-center w-full">
          
          {/* Grid Row 1: Times & Tags */}
          <div className="text-[18px] sm:text-[20px] font-semibold text-[#111111] text-left">{departureTime}</div>
          
          <div className="flex items-center w-full px-1 sm:px-2 min-w-[50px]">
            <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full border-[3px] sm:border-[3.5px] border-[#00674f] bg-white z-10 shrink-0" />
            <div className="flex-1 border-t-2 border-dotted border-slate-300 mx-1 flex flex-col items-center relative">
              <span className="bg-white px-2 text-[11px] sm:text-[13px] font-medium text-slate-500 absolute -top-4 whitespace-nowrap">03:30 h - 170Km</span>
              <span className="bg-white px-2 text-[9px] sm:text-[11px] text-slate-400 absolute top-1 whitespace-nowrap">(Asian/Ho Chi Minh)</span>
            </div>
            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-[#F05929] shrink-0 z-10" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
            </svg>
          </div>

          <div className="text-[18px] sm:text-[20px] font-semibold text-[#111111] text-right">{arrivalTime}</div>
          
          <div className="flex items-center justify-end gap-1.5 text-[13px] sm:text-[15px] pl-2 sm:pl-4">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0 hidden lg:block"></div>
            <span className="text-slate-500 truncate hidden lg:block max-w-[120px]">{post.propertyType}</span>
            <div className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0 hidden sm:block"></div>
            <span className="text-[#00674f] font-semibold whitespace-nowrap">{post.area}</span>
          </div>

          {/* Grid Row 2: Locations & Price */}
          <div className="text-[13px] sm:text-[14px] font-medium text-slate-800 text-left line-clamp-1 pr-1">{pickup}</div>
          <div></div> {/* Empty space under timeline */}
          <div className="text-[13px] sm:text-[14px] font-medium text-slate-800 text-right line-clamp-1 pl-1">{dropoff}</div>
          <div className="text-[18px] sm:text-[20px] font-bold text-[#F05929] text-right pl-2 sm:pl-4 whitespace-nowrap">{post.price.split(' - ')[0]}đ</div>
        </div>
      </div>

      {/* Row 3: Notice text */}
      <div className="mt-4 text-[13px]">
        <span className="text-[#F05929] font-medium">Lưu ý: </span>
        <span className="text-[#F05929]">Quý Khách đang chọn xe đi lộ trình cao tốc Mỹ Thuận Trung Lương - Bot 23 , không nhận đón ...</span>
        <button className="text-[#F05929] underline ml-1 hover:text-[#d94a1d]">xem thêm</button>
      </div>

      {/* Row 4: Bottom Futa Links & Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mt-4 pt-4 border-t border-slate-100 gap-4">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[14px] font-medium text-slate-600 overflow-x-auto pb-1 sm:pb-0">
          <button 
            className={`whitespace-nowrap transition-colors pb-1 ${activeTab === 'seats' ? 'text-[#F05929] border-b-2 border-[#F05929]' : 'hover:text-[#F05929]'}`}
            onClick={(e) => { e.stopPropagation(); setActiveTab(activeTab === 'seats' ? null : 'seats'); }}
          >
            Chọn ghế
          </button>
          <button className="hover:text-[#F05929] whitespace-nowrap transition-colors pb-1">Chính sách</button>
        </div>
        
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (isBuy) {
              onChoose?.(post);
              return;
            }
            onOpenQuote?.(post);
          }}
          className={`px-5 py-1.5 rounded-full text-sm font-semibold transition-colors shrink-0 w-full sm:w-auto ${
            isActive
              ? 'bg-[#d94a1d] text-white'
              : 'bg-[#F05929] text-white hover:bg-[#d94a1d]'
          }`}
        >
          {isBuy ? 'Chọn chuyến' : 'Tạo đơn'}
        </button>
      </div>
      
      {activeTab === 'seats' && (
        <SeatMap tripId={Number(post.id)} />
      )}
    </div>
  );
};


