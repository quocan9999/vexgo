export type FarePriceStatus = 'HOAT_DONG' | 'TAM_NGUNG';

export const FARE_PRICE_STATUSES: readonly FarePriceStatus[] = [
  'HOAT_DONG',
  'TAM_NGUNG',
];

export type FarePriceEffectiveState =
  | 'CHUA_HIEU_LUC'
  | 'DANG_HIEU_LUC'
  | 'HET_HIEU_LUC'
  | 'TAM_NGUNG';

export const FARE_PRICE_EFFECTIVE_STATES: readonly FarePriceEffectiveState[] = [
  'CHUA_HIEU_LUC',
  'DANG_HIEU_LUC',
  'HET_HIEU_LUC',
  'TAM_NGUNG',
];

export type FarePriceSortKey =
  | 'listedPrice'
  | 'validFrom'
  | 'validTo'
  | 'status';
export type SortDirection = 'asc' | 'desc';

export type FarePrice = {
  farePriceId: number;
  listedPrice: number;
  currency: 'VND';
  validFrom: string;
  validTo: string | null;
  status: FarePriceStatus;
  effectiveState: FarePriceEffectiveState;
  route: {
    routeId: number;
    code: string;
    origin: string;
    destination: string;
  };
  vehicleType: { vehicleTypeId: number; name: string };
  createdAt: string;
  updatedAt: string;
};

export type CreateFarePriceRequest = {
  routeId: number;
  vehicleTypeId: number;
  listedPrice: number;
  validFrom: string;
  validTo: string | null;
  status: FarePriceStatus;
};

export type UpdateFarePriceRequest = Partial<
  Pick<CreateFarePriceRequest, 'listedPrice' | 'validFrom' | 'validTo'>
>;

export type FarePriceListQuery = {
  page: number;
  pageSize: number;
  search: string;
  sortBy: FarePriceSortKey;
  sortDirection: SortDirection;
  routeId?: number;
  vehicleTypeId?: number;
  status?: FarePriceStatus;
  effectiveState?: FarePriceEffectiveState;
};

export type PaginatedFarePrices = {
  data: FarePrice[];
  meta: { page: number; pageSize: number; totalItems: number; totalPages: number };
};

export type FarePriceOption = { id: number; label: string };

export type FarePriceOptionsState =
  | { status: 'loading' }
  | { status: 'success'; options: FarePriceOption[] }
  | { status: 'error' };
