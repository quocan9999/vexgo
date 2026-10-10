/* eslint-disable */
'use client';

import type { ILuggageItem } from "./luggage-item";
import React from 'react';
import { Plus } from 'lucide-react';

import { LuggageItemComponent } from './luggage-item';

interface LuggageFormProps {
  items: ILuggageItem[];
  onChange: (items: ILuggageItem[]) => void;
}

export const LuggageForm: React.FC<LuggageFormProps> = ({ items, onChange }) => {
  const [showLimitModal, setShowLimitModal] = React.useState(false);

  const handleAddItem = () => {
    if (items.length >= 5) {
      setShowLimitModal(true);
      return;
    }
    const newItem: ILuggageItem = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'Vali',
      quantity: 1,
      weight: 0,
      category: 'normal',
    };
    onChange([...items, newItem]);
  };

  const handleRemoveItem = (id: string) => {
    onChange(items.filter((item) => item.id !== id));
  };

  const handleChangeItem = (id: string, fieldOrUpdates: keyof ILuggageItem | Partial<ILuggageItem>, value?: any) => {
    onChange(
      items.map((item) => {
        if (item.id !== id) return item;
        if (typeof fieldOrUpdates === 'object') {
          return { ...item, ...fieldOrUpdates };
        }
        return { ...item, [fieldOrUpdates]: value };
      })
    );
  };

  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <LuggageItemComponent
          key={item.id}
          index={index}
          item={item}
          onChange={handleChangeItem}
          onRemove={handleRemoveItem}
        />
      ))}

      <button
        type="button"
        onClick={handleAddItem}
        className="flex items-center gap-2 text-sm font-bold text-accent hover:text-accent-hover transition-colors"
      >
        <Plus className="w-4 h-4" />
        Thêm kiện hành lý
      </button>

      {showLimitModal && (
        <div
          className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setShowLimitModal(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl border border-slate-100 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  Giới hạn số lượng hành lý
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Quy định gửi kèm theo vé hành khách
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowLimitModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-sm leading-relaxed space-y-3">
              <p className="text-slate-900 font-medium">
                Mỗi lượt đặt vé chỉ được mang theo tối đa <strong className="text-slate-950 font-black">5 kiện hành lý gửi hầm xe</strong> để đảm bảo đủ không gian cho hành khách khác trên cùng chuyến.
              </p>
              <div className="pt-2.5 border-t border-slate-200/80 text-xs text-slate-600 leading-normal">
                Nếu bạn cần chuyển số lượng hàng hóa lớn hơn, vui lòng sử dụng dịch vụ <strong className="text-slate-900 font-bold">Gửi hàng bưu kiện</strong> riêng hoặc liên hệ trực tiếp tổng đài nhà xe.
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowLimitModal(false)}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-sm hover:bg-slate-800 transition-colors shadow-sm"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
