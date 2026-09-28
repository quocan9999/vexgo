// frontend/src/modules/client/property/components/PropertyFilterSidebar.tsx
'use client';

import React from 'react';
import {
  Search,
  Filter,
  RotateCcw,
  Bus,
  MapPin,
  Coins,
  Armchair,
  Clock3,
} from 'lucide-react';
import type { PostFilterState } from '../types/post';

interface PropertyFilterSidebarProps {
  filters: PostFilterState;
  onFilterChange: (filters: PostFilterState) => void;
  onReset: () => void;
  totalCount?: number;
}

const PROPERTY_TYPES = [
  'Tất cả loại xe',
  'Limousine',
  'Limousine VIP',
  'Limousine giường phòng',
  'Giường nằm',
  'Ghế ngồi',
];

const PROVINCES = [
  'Tất cả Tỉnh/Thành',
  'Hồ Chí Minh',
  'Hà Nội',
  'Đà Nẵng',
  'Lâm Đồng',
  'Vũng Tàu',
  'Cần Thơ',
];

const PRICE_RANGES_BUY = [
  { label: 'Tất cả mức giá', value: '' },
  { label: 'Dưới 200.000đ', value: '0-200' },
  { label: '200.000đ - 350.000đ', value: '200-350' },
  { label: '350.000đ - 500.000đ', value: '350-500' },
  { label: 'Trên 500.000đ', value: '500-9999' },
];

const PRICE_RANGES_RENT = [
  { label: 'Tất cả mức giá', value: '' },
  { label: 'Dưới 100.000đ', value: '0-100' },
  { label: '100.000đ - 200.000đ', value: '100-200' },
  { label: 'Trên 200.000đ', value: '200-9999' },
];

const AREA_RANGES = [
  { label: 'Tất cả tình trạng', value: '' },
  { label: 'Còn dưới 10 ghế', value: '0-10' },
  { label: 'Còn 10 - 20 ghế', value: '10-20' },
  { label: 'Còn trên 20 ghế', value: '20-99999' },
];

const TIME_SLOTS = [
  { label: 'Tất cả khung giờ', value: '' },
  { label: 'Sáng 00:00 - 11:59', value: 'morning' },
  { label: 'Chiều 12:00 - 17:59', value: 'afternoon' },
  { label: 'Tối 18:00 - 22:59', value: 'evening' },
  { label: 'Đêm 23:00 - 23:59', value: 'night' },
];

export const PostFilterSidebar: React.FC<PropertyFilterSidebarProps> = ({
  filters,
  onFilterChange,
  onReset,
}) => {
  const handleChange = (key: keyof PostFilterState, value: string) => {
    onFilterChange({
      ...filters,
      [key]: value,
    });
  };

  const isRent = filters.needType === 'RENT';
  const priceOptions = isRent ? PRICE_RANGES_RENT : PRICE_RANGES_BUY;

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-brand" />
          <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">
            Lọc chuyến
          </h2>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-rose-600 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Đặt lại</span>
        </button>
      </div>



      {/* Keyword Search */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-700">Từ khóa tìm kiếm</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={filters.keyword}
            onChange={(e) => handleChange('keyword', e.target.value)}
            placeholder="Điểm đi, điểm đến, loại xe..."
            className="w-full pl-9 pr-3 py-2.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
          />
        </div>
      </div>

      {/* Property Type */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <Bus className="w-3.5 h-3.5 text-brand" />
          <span>Loại xe / dịch vụ</span>
        </label>
        <select
          value={filters.propertyType}
          onChange={(e) => handleChange('propertyType', e.target.value)}
          className="w-full px-3 py-2.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent text-slate-700 font-medium"
        >
          {PROPERTY_TYPES.map((type) => (
            <option key={type} value={type === 'Tất cả loại xe' ? '' : type}>
              {type}
            </option>
          ))}
        </select>
      </div>



      {/* Price Range */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <Clock3 className="w-3.5 h-3.5 text-brand" />
          <span>Khung giờ</span>
        </label>
        <select
          value={filters.direction}
          onChange={(e) => handleChange('direction', e.target.value)}
          className="w-full px-3 py-2.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent text-slate-700 font-medium"
        >
          {TIME_SLOTS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      {/* Price Range */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <Coins className="w-3.5 h-3.5 text-amber-600" />
          <span>Khoảng giá</span>
        </label>
        <select
          value={filters.priceRange}
          onChange={(e) => handleChange('priceRange', e.target.value)}
          className="w-full px-3 py-2.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent text-slate-700 font-medium"
        >
          {priceOptions.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      {/* Area Range */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <Armchair className="w-3.5 h-3.5 text-emerald-600" />
          <span>Ghế trống / khối lượng</span>
        </label>
        <select
          value={filters.areaRange}
          onChange={(e) => handleChange('areaRange', e.target.value)}
          className="w-full px-3 py-2.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent text-slate-700 font-medium"
        >
          {AREA_RANGES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2 pt-3 border-t border-slate-100">
        <p className="text-xs font-bold text-slate-700">Tiêu chí phổ biến</p>
        <div className="space-y-2">
          {['Chọn trước chỗ ngồi', 'Có trung chuyển', 'Có mã giảm giá', 'Hủy vé linh hoạt'].map((label) => (
            <label key={label} className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <input type="checkbox" className="accent-brand" />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
};


