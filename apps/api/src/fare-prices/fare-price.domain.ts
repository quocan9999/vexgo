export const FARE_PRICE_STATUSES = ['HOAT_DONG', 'TAM_NGUNG'] as const;
export type FarePriceStatus = (typeof FARE_PRICE_STATUSES)[number];

export const FARE_PRICE_EFFECTIVE_STATES = [
  'CHUA_HIEU_LUC',
  'DANG_HIEU_LUC',
  'HET_HIEU_LUC',
  'TAM_NGUNG',
] as const;
export type FarePriceEffectiveState =
  (typeof FARE_PRICE_EFFECTIVE_STATES)[number];

export function deriveEffectiveState(
  status: string,
  validFrom: string,
  validTo: string | null,
  businessDate: string,
): FarePriceEffectiveState {
  if (status === 'TAM_NGUNG') return 'TAM_NGUNG';
  if (status !== 'HOAT_DONG') {
    throw new Error(`Invalid persisted fare price status: ${status}`);
  }

  if (businessDate < validFrom) return 'CHUA_HIEU_LUC';
  if (validTo === null || businessDate <= validTo) return 'DANG_HIEU_LUC';
  return 'HET_HIEU_LUC';
}
