/* eslint-disable */
'use client';

import type { ILuggageItem } from "./luggage-item";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Package, PackageX, Info } from 'lucide-react';

import { LuggageForm } from './luggage-form';

interface CargoCapacityInfo {
  acceptsShipments: boolean;
  capacities: {
    motorcycles: { total: number; used: number; remaining: number };
    bulkyGoods: { total: number; used: number; remaining: number };
    parcels: { total: number; used: number; remaining: number };
  };
}

interface LuggageStepProps {
  route: string;
  time: string;
  seat: string;
  passenger: string;
  cargoCapacity?: CargoCapacityInfo | null;
  onFeeChange: (fee: number, weight: number, items: ILuggageItem[]) => void;
}

export const LuggageStep: React.FC<LuggageStepProps> = ({ route, time, seat, passenger, cargoCapacity, onFeeChange }) => {
  const [hasExtraLuggage, setHasExtraLuggage] = useState(false);
  const [items, setItems] = useState<ILuggageItem[]>([]);

  useEffect(() => {
    if (!hasExtraLuggage) {
      onFeeChange(0, 0, []);
      return;
    }

    const normalItems = items.filter((item) => item.type !== 'Xe máy' && item.type !== 'Xe đạp');
    const motorbikeItems = items.filter((item) => item.type === 'Xe máy');
    const bicycleItems = items.filter((item) => item.type === 'Xe đạp');

    const normalTotalWeight = Number(
      normalItems
        .reduce((sum, item) => {
          const actualWeight = item.weight || 0;
          const volumetricWeight =
            item.length && item.width && item.height
              ? (item.length * item.width * item.height) / 5000
              : 0;
          const effectiveWeight = Math.max(actualWeight, volumetricWeight);
          return sum + effectiveWeight * (item.quantity || 1);
        }, 0)
        .toFixed(2),
    );

    let normalFee = 0;
    if (normalTotalWeight <= 20) {
      normalFee = 0;
    } else if (normalTotalWeight <= 40) {
      normalFee = 30000;
    } else {
      normalFee = 0;
    }

    const motorbikeFee = motorbikeItems.reduce((sum, item) => sum + 250000 * (item.quantity || 1), 0);
    const bicycleFee = bicycleItems.reduce((sum, item) => sum + 100000 * (item.quantity || 1), 0);
    const totalFee = normalFee + motorbikeFee + bicycleFee;

    onFeeChange(totalFee, normalTotalWeight, items);
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
          {cargoCapacity?.acceptsShipments ? (
            <div className="mb-5 rounded-xl border border-slate-200/90 bg-slate-50/60 p-3.5">
              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2.5 pb-2 border-b border-slate-200/60">
                <span>Khả năng nhận hàng của chuyến</span>
                <span className="text-slate-400 font-normal lowercase">cập nhật thời gian thực</span>
              </div>
              <div className="grid grid-cols-3 divide-x divide-slate-200 text-xs">
                <div className="pr-3">
                  <div className="text-slate-500 text-[11px]">Xe máy</div>
                  <div className="mt-0.5 flex items-baseline gap-1">
                    {cargoCapacity.capacities.motorcycles.remaining === 0 ? (
                      <span className="text-xs font-bold text-red-500">Hết chỗ</span>
                    ) : (
                      <>
                        <span className="text-sm font-extrabold text-slate-900">
                          {cargoCapacity.capacities.motorcycles.remaining}
                        </span>
                        <span className="text-[11px] text-slate-500">chỗ trống</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="px-3">
                  <div className="text-slate-500 text-[11px]">Hàng 20–40kg / Xe đạp</div>
                  <div className="mt-0.5 flex items-baseline gap-1">
                    {cargoCapacity.capacities.bulkyGoods.remaining === 0 ? (
                      <span className="text-xs font-bold text-red-500">Hết chỗ</span>
                    ) : (
                      <>
                        <span className="text-sm font-extrabold text-slate-900">
                          {cargoCapacity.capacities.bulkyGoods.remaining}
                        </span>
                        <span className="text-[11px] text-slate-500">kiện/chỗ trống</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="pl-3">
                  <div className="text-slate-500 text-[11px]">Hàng &lt;20kg</div>
                  <div className="mt-0.5 flex items-baseline gap-1">
                    {cargoCapacity.capacities.parcels.remaining === 0 ? (
                      <span className="text-xs font-bold text-red-500">Hết chỗ</span>
                    ) : (
                      <>
                        <span className="text-sm font-extrabold text-slate-900">
                          {cargoCapacity.capacities.parcels.remaining}
                        </span>
                        <span className="text-[11px] text-slate-500">kiện trống</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : cargoCapacity && !cargoCapacity.acceptsShipments ? (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center gap-2">
              <Info className="w-4 h-4 shrink-0 text-amber-600" />
              <span>Chuyến xe này không nhận chở xe máy hoặc hàng ký gửi dưới hầm. Khách chỉ được mang hành lý xách tay tiêu chuẩn.</span>
            </div>
          ) : null}
          <LuggageForm items={items} onChange={setItems} />
          {items
            .filter((item) => item.type !== 'Xe máy' && item.type !== 'Xe đạp')
            .reduce((sum, item) => {
              const actualWeight = item.weight || 0;
              const volumetricWeight =
                item.length && item.width && item.height
                  ? (item.length * item.width * item.height) / 5000
                  : 0;
              const effectiveWeight = Math.max(actualWeight, volumetricWeight);
              return sum + effectiveWeight * (item.quantity || 1);
            }, 0) > 40 && (
            <div className="mt-4 p-4 rounded-xl border border-red-200 bg-red-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
                  <Info className="w-4 h-4 text-red-600" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-900">
                    Hành lý vượt quá 40kg — Cần tạo vận đơn gửi hàng
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed max-w-xl">
                    Vé xe chỉ hỗ trợ tối đa 40kg hành lý kèm theo (dưới 20kg miễn phí, 20–40kg phụ phí 30.000đ). Với kiện trên 40kg hoặc kích thước lớn, vui lòng chuyển sang dịch vụ gửi hàng hầm xe để được xếp chỗ.
                  </p>
                </div>
              </div>
              <Link href="/send-freight" className="shrink-0 self-end sm:self-center">
                <button
                  type="button"
                  className="h-9 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  Chuyển sang gửi hàng →
                </button>
              </Link>
            </div>
          )}
        </div>
      )}

      <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/80 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h4 className="text-xs font-bold text-slate-900 mb-1">Bạn muốn gửi hàng hóa không đi kèm chuyến xe?</h4>
          <p className="text-xs text-slate-500">Tạo vận đơn ký gửi riêng để theo dõi lộ trình và giao nhận tận nơi an toàn.</p>
        </div>
        <Link href="/send-freight" className="shrink-0">
          <button type="button" className="h-8 px-3.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold transition-colors cursor-pointer">
            Tạo vận đơn gửi hàng
          </button>
        </Link>
      </div>
    </div>
  );
};
