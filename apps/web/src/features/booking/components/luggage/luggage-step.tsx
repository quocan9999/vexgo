'use client';

import {
  LUGGAGE_SIZE_PACKAGES,
  type ILuggageItem,
  type LuggageSizePackage,
  type LuggageVehiclesPricing,
  type LuggageSurchargesPricing,
} from "./luggage-item";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Package, Luggage, Info } from 'lucide-react';

import { LuggageForm } from './luggage-form';
import { resolveCargoCategoryId } from './luggage-item';
import { shipmentsApi, type CargoCategory } from '@/features/shipments/services/shipments.api';
import { busCompaniesApi } from '@/features/trips/services/trips.api';
import {
  findOverweightRegularCargoItem,
  MAX_REGULAR_CARGO_PACKAGE_WEIGHT_KG,
} from '../../utils/cargo-weight';

interface CargoCapacityInfo {
  acceptsShipments: boolean;
  capacities: {
    motorcycles: { total: number; used: number; remaining: number };
    bulkyGoods: { total: number; used: number; remaining: number };
    parcels: { total: number; used: number; remaining: number };
  };
}

interface LuggageStepProps {
  title?: string;
  route: string;
  time: string;
  seat: string;
  passenger: string;
  cargoCapacity?: CargoCapacityInfo | null;
  tripId?: number;
  packages?: LuggageSizePackage[];
  onPackagesChange?: (packages: LuggageSizePackage[]) => void;
  onFeeChange: (fee: number, weight: number, items: ILuggageItem[]) => void;
}

export function calculateLuggageFee(
  items: ILuggageItem[],
  packages?: LuggageSizePackage[],
  vehicles?: LuggageVehiclesPricing,
  surcharges?: LuggageSurchargesPricing,
): number {
  const packagesList = packages && packages.length > 0 ? packages : LUGGAGE_SIZE_PACKAGES;
  let total = 0;
  for (const item of items) {
    const qty = item.quantity || 1;
    const isMotorbike = item.type === 'Xe máy';
    const isBicycle = item.type === 'Xe đạp';

    let itemBaseFee = 0;
    if (isMotorbike) {
      if (item.motorbikeType === 'Xe tay ga lớn / SH' || item.motorbikeType === 'Xe côn tay / Moto') {
        itemBaseFee = vehicles?.motorcycleBig ?? 250_000;
      } else if (item.motorbikeType === 'Xe tay ga') {
        itemBaseFee = vehicles?.motorcycleScooter ?? 220_000;
      } else {
        itemBaseFee = vehicles?.motorcycleWave ?? 180_000;
      }
    } else if (isBicycle) {
      itemBaseFee = vehicles?.bicycle ?? 80_000;
    } else {
      if (item.packageSize) {
        const pkg = packagesList.find((p) => p.code === item.packageSize);
        if (pkg) {
          itemBaseFee = pkg.baseFee;
        }
      }

      if (!itemBaseFee && itemBaseFee !== 0) {
        const actualWeight = item.weight || 0;
        const volumetricWeight =
          item.length && item.width && item.height
            ? (item.length * item.width * item.height) / 5000
            : 0;
        const effectiveUnitWeight = Math.max(actualWeight, volumetricWeight);

        const sMax = packagesList.find((p) => p.code === 'S')?.weight ?? 5;
        const mMax = packagesList.find((p) => p.code === 'M')?.weight ?? 10;
        const lMax = packagesList.find((p) => p.code === 'L')?.weight ?? 20;

        if (effectiveUnitWeight <= 0) {
          itemBaseFee = 0;
        } else if (effectiveUnitWeight <= sMax) {
          itemBaseFee = packagesList.find((p) => p.code === 'S')?.baseFee ?? 50_000;
        } else if (effectiveUnitWeight <= mMax) {
          itemBaseFee = packagesList.find((p) => p.code === 'M')?.baseFee ?? 80_000;
        } else if (effectiveUnitWeight <= lMax) {
          itemBaseFee = packagesList.find((p) => p.code === 'L')?.baseFee ?? 120_000;
        } else {
          itemBaseFee = packagesList.find((p) => p.code === 'XL')?.baseFee ?? 180_000;
        }
      }
    }

    let surcharge = 0;
    if (item.category === 'fragile') {
      surcharge = surcharges?.fragile ?? 20_000;
    } else if (item.category === 'valuable') {
      surcharge = surcharges?.valuable ?? 50_000;
    }

    if (itemBaseFee > 0 || isMotorbike || isBicycle) {
      total += (itemBaseFee + surcharge) * qty;
    }
  }
  return total;
}

export const LuggageStep: React.FC<LuggageStepProps> = ({
  title = 'HÀNH LÝ CỦA CHUYẾN ĐI',
  route,
  time,
  seat,
  passenger,
  cargoCapacity,
  tripId,
  packages: propPackages,
  onPackagesChange,
  onFeeChange,
}) => {
  const [packages, setPackages] = useState<LuggageSizePackage[]>(
    propPackages && propPackages.length > 0 ? propPackages : LUGGAGE_SIZE_PACKAGES,
  );
  const [vehicles, setVehicles] = useState<LuggageVehiclesPricing | undefined>(
    undefined,
  );
  const [surcharges, setSurcharges] = useState<LuggageSurchargesPricing | undefined>(
    undefined,
  );
  const [hasExtraLuggage, setHasExtraLuggage] = useState(false);
  const [items, setItems] = useState<ILuggageItem[]>([]);
  const [cargoCategories, setCargoCategories] = useState<CargoCategory[]>([]);
  const [cargoCategoriesLoading, setCargoCategoriesLoading] = useState(true);
  const [cargoCategoriesError, setCargoCategoriesError] = useState<string | null>(null);
  const overweightRegularCargoItem = findOverweightRegularCargoItem(items);

  useEffect(() => {
    if (propPackages && propPackages.length > 0) {
      setPackages(propPackages);
      return;
    }
    if (!tripId || tripId <= 0) return;

    let isMounted = true;
    busCompaniesApi
      .getTripLuggagePackages(tripId)
      .then((res) => {
        if (isMounted) {
          if (res?.packages && res.packages.length > 0) {
            setPackages(res.packages);
            onPackagesChange?.(res.packages);
          }
          if (res?.vehicles) {
            setVehicles(res.vehicles);
          }
          if (res?.surcharges) {
            setSurcharges(res.surcharges);
          }
        }
      })
      .catch(() => {
        // Fallback to default
      });

    return () => {
      isMounted = false;
    };
  }, [tripId, propPackages, onPackagesChange]);

  useEffect(() => {
    let isMounted = true;
    shipmentsApi
      .getCargoCategories()
      .then((response) => {
        if (isMounted) {
          setCargoCategories(response.data);
          setItems((current) =>
            current.map((item) => ({
              ...item,
              loaiHangHoaId:
                item.loaiHangHoaId ??
                resolveCargoCategoryId(
                  item.type,
                  item.weight,
                  item.length,
                  item.width,
                  item.height,
                  response.data,
                ),
            })),
          );
        }
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setCargoCategoriesError(
            error instanceof Error
              ? error.message
              : 'Không thể tải danh mục loại hàng hóa.',
          );
        }
      })
      .finally(() => {
        if (isMounted) setCargoCategoriesLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hasExtraLuggage) {
      onFeeChange(0, 0, []);
      return;
    }
    const totalWeight = Number(
      items
        .reduce((sum, item) => {
          const actualWeight = item.weight || 0;
          const volumetricWeight =
            item.length && item.width && item.height
              ? (item.length * item.width * item.height) / 5000
              : 0;
          return sum + Math.max(actualWeight, volumetricWeight) * (item.quantity || 1);
        }, 0)
        .toFixed(2),
    );
    const estimatedFee = calculateLuggageFee(
      items,
      packages,
      vehicles,
      surcharges,
    );
    onFeeChange(estimatedFee, totalWeight, items);
  }, [hasExtraLuggage, items, packages, vehicles, surcharges, onFeeChange]);

  return (
    <div className="p-4 md:p-5 border-b border-slate-200">
      <div className="mb-5 pb-4 border-b border-slate-100">
        <h2 className="text-base font-black text-slate-950 mb-3">{title}</h2>
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

      <h3 className="text-sm font-bold text-slate-900 mb-2">Bạn có hàng hóa cần gửi dưới hầm xe không?</h3>
      <p className="mb-4 text-xs leading-relaxed text-slate-600">
        Hành lý xách tay tiêu chuẩn không thuộc dịch vụ hàng gửi dưới hầm xe.
      </p>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div
          onClick={() => setHasExtraLuggage(false)}
          className={`cursor-pointer rounded-xl border-2 p-4 flex flex-col items-center justify-center text-center gap-1.5 transition-all select-none ${
            !hasExtraLuggage ? 'border-accent bg-accent/5' : 'border-slate-200 hover:border-slate-300 bg-white'
          }`}
        >
          <Luggage className={`w-8 h-8 ${!hasExtraLuggage ? 'text-accent' : 'text-slate-400'}`} />
          <span className={`text-sm font-bold ${!hasExtraLuggage ? 'text-accent' : 'text-slate-800'}`}>
            Chỉ có hành lý xách tay
          </span>
          <span className="text-[11px] text-slate-500 font-medium">
            (Hành lý gọn nhẹ mang theo bên người)
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
                loaiHangHoaId: resolveCargoCategoryId('Vali', 0, undefined, undefined, undefined, cargoCategories),
              }]);
            }
          }}
          className={`cursor-pointer rounded-xl border-2 p-4 flex flex-col items-center justify-center text-center gap-1.5 transition-all select-none ${
            hasExtraLuggage ? 'border-accent bg-accent/5' : 'border-slate-200 hover:border-slate-300 bg-white'
          }`}
        >
          <Package className={`w-8 h-8 ${hasExtraLuggage ? 'text-accent' : 'text-slate-400'}`} />
          <span className={`text-sm font-bold ${hasExtraLuggage ? 'text-accent' : 'text-slate-800'}`}>
            Có hàng gửi dưới hầm xe
          </span>
          <span className="text-[11px] text-slate-500 font-medium">
            (Vali lớn, thùng xốp, xe máy, xe đạp...)
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
          {cargoCategoriesLoading ? (
            <p role="status" className="mb-3 text-xs text-slate-500">
              Đang tải danh mục hàng hóa...
            </p>
          ) : cargoCategoriesError ? (
            <p role="alert" className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              {cargoCategoriesError} Cước hàng sẽ chỉ được xác định sau khi hệ thống tải được danh mục hợp lệ.
            </p>
          ) : null}
          <LuggageForm
            items={items}
            cargoCategories={cargoCategories}
            packages={packages}
            vehicles={vehicles}
            surcharges={surcharges}
            onChange={setItems}
          />
          <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
            Cước vận chuyển hàng hóa được tính theo loại hàng, tổng khối lượng và bảng cước của nhà xe trên tuyến đã chọn. Phụ phí dễ vỡ {(surcharges?.fragile ?? 20_000).toLocaleString('vi-VN')}đ và hàng giá trị cao {(surcharges?.valuable ?? 50_000).toLocaleString('vi-VN')}đ được tính một lần cho mỗi loại nếu có ít nhất một kiện tương ứng. Số tiền chính xác được máy chủ xác định khi tạo đơn.
          </p>
          {overweightRegularCargoItem && (
            <div className="mt-4 p-4 rounded-xl border border-red-200 bg-red-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
                  <Info className="w-4 h-4 text-red-600" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-900">
                    Có kiện hành lý thường vượt quá 40kg — Cần tạo vận đơn gửi hàng
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed max-w-xl">
                    Vé xe nhận hàng thường tối đa {MAX_REGULAR_CARGO_PACKAGE_WEIGHT_KG}kg mỗi kiện. Cước hàng gửi kèm được xác định theo bảng cước của tuyến khi tạo đơn; kiện vượt giới hạn này cần gửi riêng bằng dịch vụ gửi hàng hầm xe.
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

      {/* Khung thông báo & lưu ý quy định hành lý */}
      <div className="mt-6 rounded-xl border border-slate-200/90 bg-slate-50/80 p-4 space-y-2.5 text-xs text-slate-600 leading-relaxed">
        <div className="flex items-center gap-2 font-bold text-slate-900 text-xs">
          <Info className="w-4 h-4 text-accent shrink-0" />
          <span>Lưu ý về hành lý & hàng gửi kèm theo chuyến xe:</span>
        </div>
        <ul className="space-y-1.5 pl-6 list-disc text-slate-600">
          <li>
            <strong>Hành lý xách tay miễn phí:</strong> Mỗi hành khách được mang theo miễn phí 01 balo / vali xách tay nhỏ gọn (≤ 7kg) lên khoang ghế ngồi.
          </li>
          <li>
            <strong>Hành lý ký gửi hầm xe:</strong> Kiện hành lý lớn hoặc vượt kích thước gửi dưới hầm xe áp dụng theo biểu phí niêm yết của nhà xe ở trên và được nhân viên hỗ trợ xếp gọn vào hầm khi lên xe.
          </li>
          <li>
            Quý khách vui lòng đóng gói chắc chắn và dán rõ thông tin họ tên, số điện thoại lên từng kiện hàng để tránh thất lạc.
          </li>
          <li>
            Trường hợp quý khách chỉ có nhu cầu gửi hàng hóa, bưu kiện mà <strong>không đi cùng chuyến xe</strong>, vui lòng sử dụng{' '}
            <Link
              href="/send-freight"
              className="font-bold text-accent hover:underline inline-flex items-center gap-0.5"
            >
              Dịch vụ gửi hàng bưu kiện riêng →
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );
};
