'use client';

import React from 'react';
import { Trash2 } from 'lucide-react';
import { LuggageItem as ILuggageItem } from './types';

interface LuggageItemProps {
  index: number;
  item: ILuggageItem;
  onChange: (id: string, field: keyof ILuggageItem, value: any) => void;
  onRemove: (id: string) => void;
}

export const LuggageItem: React.FC<LuggageItemProps> = ({ index, item, onChange, onRemove }) => {
  return (
    <div className="p-4 border border-slate-200 rounded-lg bg-slate-50 relative">
      <div className="flex justify-between items-center mb-3">
        <h4 className="text-sm font-bold text-slate-800">Kiện {index + 1}</h4>
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          className="text-red-500 hover:text-red-700 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="block">
          <span className="text-xs font-bold text-slate-700">Loại hành lý</span>
          <select
            className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-semibold outline-none focus:border-accent bg-white"
            value={item.type}
            onChange={(e) => onChange(item.id, 'type', e.target.value)}
          >
            <option value="Vali">Vali</option>
            <option value="Balo">Balo</option>
            <option value="Thùng hàng">Thùng hàng</option>
            <option value="Xe đạp">Xe đạp</option>
            <option value="Thiết bị điện tử">Thiết bị điện tử</option>
            <option value="Hành lý khác">Hành lý khác</option>
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-bold text-slate-700">Số lượng</span>
          <input
            type="number"
            min="1"
            className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-semibold outline-none focus:border-accent bg-white"
            value={item.quantity}
            onChange={(e) => onChange(item.id, 'quantity', parseInt(e.target.value) || 1)}
          />
        </label>

        <label className="block">
          <span className="text-xs font-bold text-slate-700">Khối lượng ước tính (kg)</span>
          <input
            type="number"
            min="0"
            className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-semibold outline-none focus:border-accent bg-white"
            value={item.weight || ''}
            onChange={(e) => onChange(item.id, 'weight', parseFloat(e.target.value) || 0)}
            placeholder="Ví dụ: 15"
          />
        </label>

        <label className="block">
          <span className="text-xs font-bold text-slate-700">Loại hàng</span>
          <select
            className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-semibold outline-none focus:border-accent bg-white"
            value={item.category}
            onChange={(e) => onChange(item.id, 'category', e.target.value)}
          >
            <option value="normal">Hàng thường</option>
            <option value="fragile">Dễ vỡ</option>
            <option value="valuable">Giá trị cao</option>
          </select>
        </label>
      </div>

      <div className="mt-4">
        <span className="text-xs font-bold text-slate-700 block mb-1">Kích thước (cm) - Không bắt buộc</span>
        <div className="grid grid-cols-3 gap-3">
          <input
            type="number"
            placeholder="Dài"
            className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-semibold outline-none focus:border-accent bg-white"
            value={item.length || ''}
            onChange={(e) => onChange(item.id, 'length', parseFloat(e.target.value) || undefined)}
          />
          <input
            type="number"
            placeholder="Rộng"
            className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-semibold outline-none focus:border-accent bg-white"
            value={item.width || ''}
            onChange={(e) => onChange(item.id, 'width', parseFloat(e.target.value) || undefined)}
          />
          <input
            type="number"
            placeholder="Cao"
            className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-semibold outline-none focus:border-accent bg-white"
            value={item.height || ''}
            onChange={(e) => onChange(item.id, 'height', parseFloat(e.target.value) || undefined)}
          />
        </div>
      </div>

      <label className="block mt-4">
        <span className="text-xs font-bold text-slate-700">Ghi chú</span>
        <input
          type="text"
          className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-semibold outline-none focus:border-accent bg-white"
          value={item.note || ''}
          onChange={(e) => onChange(item.id, 'note', e.target.value)}
          placeholder="Ghi chú thêm về hành lý"
        />
      </label>
      
      {item.category === 'fragile' && (
         <div className="mt-3 flex items-center gap-2">
            <input type="checkbox" id={`fragile-${item.id}`} className="accent-red-500 w-4 h-4 rounded" defaultChecked />
            <label htmlFor={`fragile-${item.id}`} className="text-xs font-semibold text-slate-700">Hàng dễ vỡ, cần xử lý cẩn thận</label>
         </div>
      )}
    </div>
  );
};
