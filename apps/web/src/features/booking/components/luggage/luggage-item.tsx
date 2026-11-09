/* eslint-disable */
'use client';

import React from 'react';
import { Trash2, ChevronDown, CheckCircle2, PackageCheck } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import type { CargoCategory } from '@/features/shipments/services/shipments.api';

export interface LuggageSizePackage {
  code: 'S' | 'M' | 'L' | 'XL';
  name: string;
  shortName: string;
  weight: number;
  length: number;
  width: number;
  height: number;
  baseFee: number;
  ruleText: string;
  examples: string;
}

export const LUGGAGE_SIZE_PACKAGES: LuggageSizePackage[] = [
  {
    code: 'S',
    name: 'Gói Kiện Nhỏ (Size S)',
    shortName: 'Size S (≤ 5kg)',
    weight: 5,
    length: 40,
    width: 25,
    height: 25,
    baseFee: 50_000,
    ruleText: 'Tối đa 5kg • Không quá 40×25×25cm',
    examples: 'Balo du lịch, túi quà nhỏ, hộp carton nhỏ',
  },
  {
    code: 'M',
    name: 'Gói Tiêu Chuẩn (Size M)',
    shortName: 'Size M (≤ 10kg)',
    weight: 10,
    length: 50,
    width: 40,
    height: 25,
    baseFee: 80_000,
    ruleText: 'Tối đa 10kg • Không quá 50×40×25cm',
    examples: 'Vali cỡ vừa (20–24 inch), thùng trái cây vừa',
  },
  {
    code: 'L',
    name: 'Gói Kiện Lớn (Size L)',
    shortName: 'Size L (≤ 20kg)',
    weight: 20,
    length: 60,
    width: 40,
    height: 40,
    baseFee: 120_000,
    ruleText: 'Tối đa 20kg • Không quá 60×40×40cm',
    examples: 'Vali đại (28 inch), thùng xốp lớn, kiện hàng nặng',
  },
  {
    code: 'XL',
    name: 'Gói Cồng Kềnh (Size XL)',
    shortName: 'Size XL (≤ 35kg)',
    weight: 35,
    length: 80,
    width: 50,
    height: 40,
    baseFee: 180_000,
    ruleText: 'Tối đa 35kg • Không quá 80×50×40cm',
    examples: 'Thùng hải sản/trái cây lớn, kiện hàng cồng kềnh',
  },
];

export function resolvePackageByWeight(
  weight?: number,
  packages?: LuggageSizePackage[],
): LuggageSizePackage {
  const list = packages && packages.length > 0 ? packages : LUGGAGE_SIZE_PACKAGES;
  const sMax = list.find((p) => p.code === 'S')?.weight ?? 5;
  const mMax = list.find((p) => p.code === 'M')?.weight ?? 10;
  const lMax = list.find((p) => p.code === 'L')?.weight ?? 20;

  if (!weight || weight <= sMax) {
    return list.find((p) => p.code === 'S') || list[0];
  }
  if (weight <= mMax) {
    return list.find((p) => p.code === 'M') || list[1];
  }
  if (weight <= lMax) {
    return list.find((p) => p.code === 'L') || list[2];
  }
  return list.find((p) => p.code === 'XL') || list[3];
}

export function resolveCargoCategoryId(
  type: string,
  weight: number = 0,
  length?: number,
  width?: number,
  height?: number,
  categories: CargoCategory[] = [],
): number | undefined {
  if (!categories || categories.length === 0) return undefined;

  const isMotorbike = type === 'Xe máy';
  const isBicycle = type === 'Xe đạp';
  const unitWeight = Math.max(
    weight || 0,
    length && width && height ? (length * width * height) / 5000 : 0,
  );

  const capacityGroup = isMotorbike
    ? 'XE_MAY'
    : isBicycle || type.toLocaleUpperCase('vi-VN').includes('CỒNG KỀNH') || (unitWeight >= 20 && unitWeight <= 40)
      ? 'HANG_CONG_KENH'
      : 'HANG_NHE';

  const isVehicle = isMotorbike || isBicycle;

  const inGroup = categories.filter((c) => c.capacityGroup === capacityGroup);
  if (inGroup.length > 0) {
    if (isMotorbike) {
      const match = inGroup.find((c) => c.name.toLocaleUpperCase('vi-VN').includes('XE MÁY'));
      if (match) return match.categoryId;
    }
    if (isBicycle) {
      const match = inGroup.find((c) => c.name.toLocaleUpperCase('vi-VN').includes('XE ĐẠP'));
      if (match) return match.categoryId;
    }
    if (!isVehicle) {
      const nonVehicle = inGroup.find(
        (c) =>
          !c.name.toLocaleUpperCase('vi-VN').includes('XE ĐẠP') &&
          !c.name.toLocaleUpperCase('vi-VN').includes('XE MÁY') &&
          !c.name.toLocaleUpperCase('vi-VN').includes('BICYCLE') &&
          !c.name.toLocaleUpperCase('vi-VN').includes('MOTORCYCLE'),
      );
      if (nonVehicle) return nonVehicle.categoryId;
    }
    return inGroup[0].categoryId;
  }

  if (isMotorbike) {
    const moto = categories.find((c) => c.name.toLocaleUpperCase('vi-VN').includes('XE MÁY'));
    if (moto) return moto.categoryId;
  }
  if (isBicycle) {
    const bike = categories.find((c) => c.name.toLocaleUpperCase('vi-VN').includes('XE ĐẠP'));
    if (bike) return bike.categoryId;
  }

  const normalGroup = categories.filter((c) => c.capacityGroup === 'HANG_NHE');
  if (normalGroup.length > 0) {
    const buuPham = normalGroup.find(
      (c) =>
        c.name.toLocaleUpperCase('vi-VN').includes('BƯU PHẨM') ||
        c.name.toLocaleUpperCase('vi-VN').includes('THƯỜNG'),
    );
    return buuPham?.categoryId || normalGroup[0].categoryId;
  }

  return categories[0]?.categoryId;
}

export interface LuggageVehiclesPricing {
  motorcycleWave?: number;
  motorcycleScooter?: number;
  motorcycleBig?: number;
  bicycle?: number;
}

export interface LuggageSurchargesPricing {
  fragile?: number;
  valuable?: number;
}

interface LuggageItemProps {
  index: number;
  item: ILuggageItem;
  cargoCategories: CargoCategory[];
  packages?: LuggageSizePackage[];
  vehicles?: LuggageVehiclesPricing;
  surcharges?: LuggageSurchargesPricing;
  onChange: (id: string, fieldOrUpdates: keyof ILuggageItem | Partial<ILuggageItem>, value?: any) => void;
  onRemove: (id: string) => void;
}

export const LuggageItemComponent: React.FC<LuggageItemProps> = ({
  index,
  item,
  cargoCategories,
  packages,
  vehicles,
  surcharges,
  onChange,
  onRemove,
}) => {
  const t = useTranslations('booking');
  const locale = useLocale();
  const packagesList = packages && packages.length > 0 ? packages : LUGGAGE_SIZE_PACKAGES;
  const isMotorbike = item.type === 'Xe máy';
  const isBicycle = item.type === 'Xe đạp';

  const activePackage = React.useMemo(() => {
    if (item.packageSize) {
      const found = packagesList.find((p) => p.code === item.packageSize);
      if (found) return found;
    }
    if (item.weight && item.weight > 0) {
      return resolvePackageByWeight(item.weight, packagesList);
    }
    return null;
  }, [item.packageSize, item.weight, packagesList]);

  React.useEffect(() => {
    if (cargoCategories && cargoCategories.length > 0) {
      const targetId = resolveCargoCategoryId(
        item.type,
        item.weight,
        item.length,
        item.width,
        item.height,
        cargoCategories,
      );
      if (targetId && item.loaiHangHoaId !== targetId) {
        onChange(item.id, 'loaiHangHoaId', targetId);
      }
    }
  }, [
    item.id,
    item.type,
    item.weight,
    item.length,
    item.width,
    item.height,
    item.loaiHangHoaId,
    cargoCategories,
    onChange,
  ]);

  const currencyUnit = locale === 'vi' ? 'đ' : ' VND';
  const formatMoney = (val?: number) => {
    if (typeof val !== 'number') return '';
    return locale === 'vi' ? `${val.toLocaleString('vi-VN')}đ` : `${val.toLocaleString('en-US')} VND`;
  };

  const getPackageDisplayName = (pkg: LuggageSizePackage) => {
    if (locale === 'en') {
      switch (pkg.code) {
        case 'S':
          return 'Small Package (Size S)';
        case 'M':
          return 'Standard Package (Size M)';
        case 'L':
          return 'Large Package (Size L)';
        case 'XL':
          return 'Bulky Package (Size XL)';
        default:
          return pkg.name;
      }
    }
    return pkg.name;
  };

  const getPackageRuleText = (pkg: LuggageSizePackage) => {
    if (locale === 'en') {
      switch (pkg.code) {
        case 'S':
          return 'Max 5kg • Within 40×25×25cm';
        case 'M':
          return 'Max 10kg • Within 50×40×25cm';
        case 'L':
          return 'Max 20kg • Within 60×40×40cm';
        case 'XL':
          return 'Max 35kg • Within 80×50×40cm';
        default:
          return pkg.ruleText;
      }
    }
    return pkg.ruleText;
  };

  const getPackageExamples = (pkg: LuggageSizePackage) => {
    if (locale === 'en') {
      switch (pkg.code) {
        case 'S':
          return 'Travel backpack, small gift bag, small box';
        case 'M':
          return 'Medium suitcase (20–24 inch), medium fruit crate';
        case 'L':
          return 'Large suitcase (28 inch), large foam box, heavy item';
        case 'XL':
          return 'Seafood container, oversized box, bulky cargo';
        default:
          return pkg.examples;
      }
    }
    return pkg.examples;
  };

  const headerTitle = isMotorbike
    ? t('cargoItemVehicleName', { index: index + 1, name: t('packageMotorbike') })
    : isBicycle
      ? t('cargoItemVehicleName', { index: index + 1, name: t('packageBicycle') })
      : t('cargoItemPackageName', { index: index + 1, name: '' }).replace(': ', '');

  return (
    <div className="p-4 border border-slate-200 rounded-xl bg-slate-50/80 relative shadow-2xs">
      <div className="flex justify-between items-center mb-3 pb-2.5 border-b border-slate-200/70">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
            {index + 1}
          </span>
          <h4 className="text-sm font-black text-slate-900">
            {headerTitle}
          </h4>
        </div>
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
          title={t('deleteCargoItem')}
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>{t('deleteItemText')}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        <label className="block">
          <span className="text-xs font-bold text-slate-700">{t('cargoCategoryLabel')}</span>
          <div className="relative mt-1">
            <select
              aria-label={t('luggageType')}
              className="h-10 w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 pr-9 text-sm font-semibold outline-none focus:border-accent"
              value={item.type}
              onChange={(e) => {
                const newType = e.target.value;
                if (newType === 'Xe máy') {
                  onChange(item.id, {
                    type: 'Xe máy',
                    weight: 100,
                    motorbikeType: item.motorbikeType || 'Xe số',
                    bicycleType: undefined,
                    packageSize: undefined,
                    length: undefined,
                    width: undefined,
                    height: undefined,
                  });
                } else if (newType === 'Xe đạp') {
                  onChange(item.id, {
                    type: 'Xe đạp',
                    weight: 15,
                    bicycleType: item.bicycleType || 'Xe đạp thường',
                    motorbikeType: undefined,
                    licensePlate: undefined,
                    packageSize: undefined,
                    length: undefined,
                    width: undefined,
                    height: undefined,
                  });
                } else {
                  const targetPkg =
                    newType === 'Hành lý / Đồ cồng kềnh khác'
                      ? packagesList.find((p) => p.code === 'XL') || packagesList[3] || LUGGAGE_SIZE_PACKAGES[3]
                      : newType === 'Balo / Túi du lịch'
                        ? packagesList.find((p) => p.code === 'S') || packagesList[0] || LUGGAGE_SIZE_PACKAGES[0]
                        : packagesList.find((p) => p.code === 'M') || packagesList[1] || LUGGAGE_SIZE_PACKAGES[1];
                  onChange(item.id, {
                    type: newType,
                    packageSize: targetPkg.code,
                    weight: targetPkg.weight,
                    length: targetPkg.length,
                    width: targetPkg.width,
                    height: targetPkg.height,
                    motorbikeType: undefined,
                    licensePlate: undefined,
                    bicycleType: undefined,
                    ...(newType !== 'Khác' && newType !== 'Hành lý / Đồ cồng kềnh khác'
                      ? { customTypeName: undefined }
                      : {}),
                  });
                }
              }}
            >
              <option value="Vali">{locale === 'vi' ? 'Vali du lịch' : 'Travel suitcase'}</option>
              <option value="Balo / Túi du lịch">{locale === 'vi' ? 'Balo lớn / Túi đồ quê' : 'Large backpack / Travel bag'}</option>
              <option value="Thùng xốp / Thùng carton">{locale === 'vi' ? 'Thùng xốp / Thùng carton' : 'Foam box / Carton'}</option>
              <option value="Nông sản / Đặc sản / Quà biếu">{locale === 'vi' ? 'Nông sản / Đặc sản / Quà biếu' : 'Produce / Specialties / Gifts'}</option>
              <option value="Thiết bị điện tử / Đồ gia dụng">{locale === 'vi' ? 'Thiết bị điện tử / Đồ gia dụng' : 'Electronics / Appliances'}</option>
              <option value="Hành lý / Đồ cồng kềnh khác">{locale === 'vi' ? 'Kiện hàng cồng kềnh khác' : 'Other bulky luggage'}</option>
              <option value="Xe máy">{locale === 'vi' ? 'Phương tiện: Xe máy' : 'Vehicle: Motorbike'}</option>
              <option value="Xe đạp">{locale === 'vi' ? 'Phương tiện: Xe đạp' : 'Vehicle: Bicycle'}</option>
              <option value="Khác">{locale === 'vi' ? 'Khác (Tự nhập tên đồ gửi...)' : 'Other (Custom item name...)'}</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          </div>
        </label>

        <label className="block">
          <span className="text-xs font-bold text-slate-700">{t('cargoQuantityLabel')}</span>
          <input
            type="number"
            aria-label={t('cargoQuantityLabel')}
            min="1"
            max="5"
            className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-semibold outline-none focus:border-accent bg-white"
            value={item.quantity}
            onChange={(e) => onChange(item.id, 'quantity', Math.max(1, Math.min(5, parseInt(e.target.value) || 1)))}
          />
        </label>
        <input
          type="number"
          aria-label={t('cargoWeightAria')}
          className="sr-only"
          value={item.weight || ''}
          onChange={(e) => {
            const w = parseFloat(e.target.value) || 0;
            const pkg = resolvePackageByWeight(w);
            onChange(item.id, {
              weight: w,
              packageSize: pkg.code,
            });
          }}
        />
        <div className="sr-only">
          <input
            type="number"
            placeholder="Dài (tối đa 150)"
            value={item.length || ''}
            onChange={(e) => onChange(item.id, 'length', parseFloat(e.target.value) || undefined)}
          />
          <input
            type="number"
            placeholder="Rộng (tối đa 80)"
            value={item.width || ''}
            onChange={(e) => onChange(item.id, 'width', parseFloat(e.target.value) || undefined)}
          />
          <input
            type="number"
            placeholder="Cao (tối đa 80)"
            value={item.height || ''}
            onChange={(e) => onChange(item.id, 'height', parseFloat(e.target.value) || undefined)}
          />
        </div>
      </div>

      {(item.type === 'Khác' || item.type === 'Hành lý / Đồ cồng kềnh khác') && (
        <div className="mt-3">
          <label className="block">
            <span className="text-xs font-bold text-slate-700">
              {t('cargoItemSpecificName')} <span className="text-rose-500">*</span>
            </span>
            <input
              type="text"
              className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-semibold outline-none focus:border-accent bg-white"
              value={item.customTypeName || ''}
              onChange={(e) => onChange(item.id, 'customTypeName', e.target.value)}
              placeholder={t('cargoItemSpecificNamePlaceholder')}
            />
          </label>
        </div>
      )}

      {/* Nếu là Xe máy / Xe đạp / Hoặc chọn Gói quy chuẩn */}
      {isMotorbike ? (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <label className="block">
              <span className="text-xs font-bold text-slate-700">{t('motorbikePackageFeeLabel')}</span>
              <div className="relative mt-1">
                <select
                  className="h-10 w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 pr-9 text-sm font-semibold outline-none focus:border-accent"
                  value={item.motorbikeType || 'Xe số'}
                  onChange={(e) => onChange(item.id, 'motorbikeType', e.target.value)}
                >
                  <option value="Xe số">
                    {locale === 'vi' ? 'Xe số' : 'Manual / semi-auto'}: Wave, Sirius, Future... ({formatMoney(vehicles?.motorcycleWave ?? 180_000)})
                  </option>
                  <option value="Xe tay ga">
                    {locale === 'vi' ? 'Xe tay ga' : 'Scooter'}: Vision, AirBlade, Lead... ({formatMoney(vehicles?.motorcycleScooter ?? 220_000)})
                  </option>
                  <option value="Xe tay ga lớn / SH">
                    {locale === 'vi' ? 'Xe tay ga lớn' : 'Large scooter'}: SH, NVX, Vespa... ({formatMoney(vehicles?.motorcycleBig ?? 250_000)})
                  </option>
                  <option value="Xe côn tay / Moto">
                    {locale === 'vi' ? 'Xe côn tay / PKL' : 'Clutch / Sport bike'}: Winner, Exciter... ({formatMoney(vehicles?.motorcycleBig ?? 250_000)})
                  </option>
                  <option value="Xe máy điện">
                    {locale === 'vi' ? 'Xe máy điện' : 'Electric motorbike'}: VinFast, Dat Bike... ({formatMoney(vehicles?.motorcycleWave ?? 180_000)})
                  </option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>
            </label>

            <label className="block">
              <span className="text-xs font-bold text-slate-700">{t('motorbikeLicensePlateLabel')}</span>
              <input
                type="text"
                placeholder={t('motorbikeLicensePlatePlaceholder')}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-semibold outline-none focus:border-accent bg-white uppercase"
                value={item.licensePlate || ''}
                onChange={(e) => onChange(item.id, 'licensePlate', e.target.value.toUpperCase())}
              />
            </label>
          </div>

          <div className="rounded-xl border border-amber-200/90 bg-amber-50/60 p-3.5 text-xs">
            <div className="flex items-center gap-2 mb-2 font-bold text-amber-900">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] text-white">
                📌
              </span>
              <span>{t('motorbikeRulesTitle')}</span>
            </div>
            <ul className="space-y-1.5 pl-1 text-[12px] text-slate-700">
              <li className="flex items-start gap-2">
                <span className="text-amber-600 font-bold">•</span>
                <span>{t('motorbikeArrivalNotice')}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-600 font-bold">•</span>
                <span>{t('motorbikePaperNotice')}</span>
              </li>
            </ul>
          </div>
        </div>
      ) : isBicycle ? (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <label className="block">
              <span className="text-xs font-bold text-slate-700">
                {t('bicycleTypeLabel', { fee: (vehicles?.bicycle ?? 80_000).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US') })}
              </span>
              <div className="relative mt-1">
                <select
                  className="h-10 w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 pr-9 text-sm font-semibold outline-none focus:border-accent"
                  value={item.bicycleType || 'Xe đạp thường'}
                  onChange={(e) => onChange(item.id, 'bicycleType', e.target.value)}
                >
                  <option value="Xe đạp thường">{locale === 'vi' ? 'Xe đạp thông thường / mini' : 'Standard bicycle / city bike'}</option>
                  <option value="Xe đạp thể thao">{locale === 'vi' ? 'Xe đạp thể thao / địa hình (MTB)' : 'Mountain bike (MTB)'}</option>
                  <option value="Xe đạp đua / cuộc">{locale === 'vi' ? 'Xe đạp đua / Road bike' : 'Road bike / Racing bicycle'}</option>
                  <option value="Xe đạp điện">{locale === 'vi' ? 'Xe đạp điện / Trợ lực điện' : 'Electric bicycle / E-bike'}</option>
                  <option value="Xe đạp gấp">{locale === 'vi' ? 'Xe đạp gấp gọn' : 'Folding bicycle'}</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>
            </label>
          </div>

          <div className="rounded-xl border border-sky-200/90 bg-sky-50/60 p-3.5 text-xs">
            <div className="flex items-center gap-2 mb-1.5 font-bold text-sky-950">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-500 text-[10px] text-white">
                🚲
              </span>
              <span>{t('bicycleArrivalNotice')}</span>
            </div>
          </div>
        </div>
      ) : (
        /* ================= CHỌN GÓI KÍCH THƯỚC & KHỐI LƯỢNG QUY ĐỊNH SẴN ================= */
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
              <PackageCheck className="w-4 h-4 text-accent" />
              {t('packageSizeTitle')}
            </span>
            <span className="text-[11px] font-semibold text-slate-500">
              {t('packageSizeStandardDesc')}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {packagesList.map((pkg) => {
              const isSelected = activePackage?.code === pkg.code;
              return (
                <button
                  key={pkg.code}
                  type="button"
                  onClick={() =>
                    onChange(item.id, {
                      packageSize: pkg.code,
                      weight: pkg.weight,
                      length: pkg.length,
                      width: pkg.width,
                      height: pkg.height,
                    })
                  }
                  className={`text-left p-3 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                    isSelected
                      ? 'border-accent bg-white shadow-sm ring-2 ring-accent/10'
                      : 'border-slate-200 bg-white/70 hover:border-slate-300 hover:bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 w-full">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2
                        className={`w-4 h-4 shrink-0 ${
                          isSelected ? 'text-accent' : 'text-slate-300'
                        }`}
                      />
                      <span
                        className={`text-xs font-black ${
                          isSelected ? 'text-slate-950' : 'text-slate-800'
                        }`}
                      >
                        {getPackageDisplayName(pkg)}
                      </span>
                    </div>
                    <span
                      className={`shrink-0 text-xs font-extrabold px-2 py-0.5 rounded-full ${
                        isSelected
                          ? 'bg-accent text-white'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {formatMoney(pkg.baseFee)}/{locale === 'vi' ? 'kiện' : 'pkg'}
                    </span>
                  </div>

                  <div className="pl-5.5 space-y-0.5">
                    <div className="text-[11px] font-bold text-slate-700">
                      {getPackageRuleText(pkg)}
                    </div>
                    <div className="text-[11px] text-slate-500 leading-snug">
                      {locale === 'vi' ? 'Gợi ý: ' : 'Examples: '}{getPackageExamples(pkg)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <label className="block mt-3.5">
        <span className="text-xs font-bold text-slate-700">{t('cargoItemNoteLabel')}</span>
        <input
          type="text"
          className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-semibold outline-none focus:border-accent bg-white"
          value={item.note || ''}
          onChange={(e) => onChange(item.id, 'note', e.target.value)}
          placeholder={
            isMotorbike
              ? t('cargoItemNoteMotorbikePlaceholder')
              : t('cargoItemNotePackagePlaceholder')
          }
        />
      </label>
    </div>
  );
};

export interface ILuggageItem {
  id: string;
  type: string;
  customTypeName?: string;
  packageSize?: 'S' | 'M' | 'L' | 'XL';
  quantity: number;
  weight: number;
  length?: number;
  width?: number;
  height?: number;
  category?: "normal" | "fragile" | "valuable";
  loaiHangHoaId?: number;
  note?: string;
  motorbikeType?: string;
  licensePlate?: string;
  bicycleType?: string;
}
