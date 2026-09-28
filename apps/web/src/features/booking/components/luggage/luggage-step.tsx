'use client';

import type { ILuggageItem } from "./luggage-item";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Package, PackageX, Info } from 'lucide-react';

import { LuggageForm } from './luggage-form';

interface LuggageStepProps {
  route: string;
  time: string;
  seat: string;
  passenger: string;
  onFeeChange: (fee: number, weight: number, items: ILuggageItem[]) => void;
}

export const LuggageStep: React.FC<LuggageStepProps> = ({ route, time, seat, passenger, onFeeChange }) => {
  const [hasExtraLuggage, setHasExtraLuggage] = useState(false);
  const [items, setItems] = useState<ILuggageItem[]>([]);

  useEffect(() => {
    if (!hasExtraLuggage) {
      onFeeChange(0, 0, []);
      return;
    }

    const totalWeight = items.reduce((sum, item) => sum + (item.weight || 0) * item.quantity, 0);
    
    let fee = 0;
    if (totalWeight <= 20) {
      fee = 0;
    } else if (totalWeight <= 30) {
      fee = 30000;
    } else if (totalWeight <= 40) {
      fee = 50000;
    } else {
      // > 40kg, require contact, maybe standard fee + 50k
      fee = 100000; 
    }

    onFeeChange(fee, totalWeight, items);
  }, [hasExtraLuggage, items, onFeeChange]);

  return (
    <div className="p-4 md:p-5 border-b border-slate-200">
      <div className="mb-5 pb-4 border-b border-slate-100">
        <h2 className="text-base font-black text-slate-950 mb-3">HÀNH LÝ CỦA CHUYẾN ĐI</h2>
        <div className="bg-slate-50 rounded-lg p-3 text-sm flex flex-col gap-1.5 border border-slate-200">
          <div className="flex justify-between">
            <span className="text-slate-500">Tuyến:</span>
            <span className="font-bold text-slate-800">{route}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Thời gian:</span>
            <span className="font-bold text-slate-800">{time}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Ghế:</span>
            <span className="font-bold text-slate-800">{seat || 'Chưa chọn'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Hành khách:</span>
            <span className="font-bold text-slate-800">{passenger || 'Chưa nhập'}</span>
          </div>
        </div>
      </div>

      <h3 className="text-sm font-bold text-slate-900 mb-4">Bạn có hành lý mang theo không?</h3>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div
          onClick={() => setHasExtraLuggage(false)}
          className={`cursor-pointer rounded-xl border-2 p-4 flex flex-col items-center justify-center text-center gap-2 transition-all ${
            !hasExtraLuggage ? 'border-accent bg-accent/5' : 'border-slate-200 hover:border-slate-300 bg-white'
          }`}
        >
          <PackageX className={`w-8 h-8 ${!hasExtraLuggage ? 'text-accent' : 'text-slate-400'}`} />
          <span className={`text-sm font-bold ${!hasExtraLuggage ? 'text-accent' : 'text-slate-700'}`}>
            Không có hành lý<br/>vượt tiêu chuẩn
          </span>
        </div>

        <div
          onClick={() => {
            setHasExtraLuggage(true);
            if (items.length === 0) {
              setItems([{
                id: Math.random().toString(36).substr(2, 9),
                type: 'Vali',
                quantity: 1,
                weight: 0,
                category: 'normal',
              }]);
            }
          }}
          className={`cursor-pointer rounded-xl border-2 p-4 flex flex-col items-center justify-center text-center gap-2 transition-all ${
            hasExtraLuggage ? 'border-accent bg-accent/5' : 'border-slate-200 hover:border-slate-300 bg-white'
          }`}
        >
          <Package className={`w-8 h-8 ${hasExtraLuggage ? 'text-accent' : 'text-slate-400'}`} />
          <span className={`text-sm font-bold ${hasExtraLuggage ? 'text-accent' : 'text-slate-700'}`}>
            Có hành lý cồng kềnh /<br/>vượt tiêu chuẩn
          </span>
        </div>
      </div>

      {hasExtraLuggage && (
        <div className="mb-6">
          <LuggageForm items={items} onChange={setItems} />
          {items.reduce((sum, item) => sum + (item.weight || 0) * item.quantity, 0) > 40 && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex gap-2">
              <Info className="w-5 h-5 shrink-0" />
              <span>Hành lý trên 40kg yêu cầu liên hệ nhà xe hoặc cân nhắc gửi hàng riêng.</span>
            </div>
          )}
        </div>
      )}

      <div className="mt-6 rounded-xl border border-sky-200 bg-sky-50 p-4">
        <h4 className="text-sm font-bold text-sky-900 mb-2">Bạn đang muốn gửi hàng thay vì mang hành lý theo vé?</h4>
        <p className="text-xs text-sky-700 mb-3">Nếu người gửi không đi cùng chuyến, hãy tạo vận đơn ký gửi riêng để đảm bảo an toàn và dễ theo dõi.</p>
        <Link href="/send-freight">
          <button type="button" className="h-9 px-4 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition-colors">
            Tạo vận đơn gửi hàng
          </button>
        </Link>
      </div>
    </div>
  );
};
