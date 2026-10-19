import type { ILuggageItem } from '../components/luggage/luggage-item';

export const MAX_REGULAR_CARGO_PACKAGE_WEIGHT_KG = 40;

export function getEffectiveCargoUnitWeightKg(item: ILuggageItem): number {
  const actualWeight = Number.isFinite(item.weight) ? item.weight : 0;
  const hasDimensions =
    item.length !== undefined &&
    item.length > 0 &&
    item.width !== undefined &&
    item.width > 0 &&
    item.height !== undefined &&
    item.height > 0;
  const rawVolumetricWeight = hasDimensions
    ? (item.length! * item.width! * item.height!) / 5000
    : 0;
  const volumetricWeight = Math.round((rawVolumetricWeight + Number.EPSILON) * 10) / 10;

  return Math.max(actualWeight, volumetricWeight);
}

export function isVehicleCargoItem(item: Pick<ILuggageItem, 'type'>): boolean {
  const normalizedType = item.type.trim().toLocaleUpperCase('vi-VN');
  return (
    normalizedType.includes('XE MÁY') ||
    normalizedType.includes('MOTORCYCLE') ||
    normalizedType.includes('XE ĐẠP') ||
    normalizedType.includes('BICYCLE')
  );
}

export function findOverweightRegularCargoItem(
  items: ILuggageItem[],
  maxWeightKg = MAX_REGULAR_CARGO_PACKAGE_WEIGHT_KG,
): ILuggageItem | undefined {
  return items.find(
    (item) =>
      !isVehicleCargoItem(item) &&
      getEffectiveCargoUnitWeightKg(item) > maxWeightKg,
  );
}
