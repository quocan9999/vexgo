export type ShipmentRateStatus = 'HOAT_DONG' | 'TAM_NGUNG';

export type ShipmentRateEffectiveState =
  | 'CHUA_DEN_NGAY'
  | 'DANG_HIEU_LUC'
  | 'HET_HIEU_LUC';

export type ShipmentRateSortKey =
  | 'fee'
  | 'weightFrom'
  | 'validFrom'
  | 'validTo'
  | 'status';

export type SortDirection = 'asc' | 'desc';

export type ShipmentRateRouteSummary = {
  routeId: number;
  code: string;
  origin: string;
  destination: string;
};

export type ShipmentRateCargoTypeSummary = {
  cargoTypeId: number;
  name: string;
  capacityGroup: string;
};

export type ShipmentRate = {
  rateId: number;
  weightFrom: number;
  weightTo: number | null;
  fee: number;
  currency: 'VND';
  validFrom: string;
  validTo: string | null;
  status: ShipmentRateStatus;
  effectiveState: ShipmentRateEffectiveState;
  route: ShipmentRateRouteSummary;
  cargoType: ShipmentRateCargoTypeSummary;
};

export type CreateShipmentRateRequest = {
  routeId: number;
  cargoTypeId: number;
  weightFrom: number;
  weightTo?: number | null;
  fee: number;
  validFrom: string;
  validTo?: string | null;
  status?: ShipmentRateStatus;
};

export type UpdateShipmentRateRequest = {
  weightFrom?: number;
  weightTo?: number | null;
  fee?: number;
  validFrom?: string;
  validTo?: string | null;
  status?: ShipmentRateStatus;
};

export type UpdateShipmentRateStatusRequest = {
  status: ShipmentRateStatus;
};

export type ShipmentRateListQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
  routeId?: number;
  cargoTypeId?: number;
  status?: ShipmentRateStatus;
  effectiveState?: ShipmentRateEffectiveState;
  sortBy?: ShipmentRateSortKey;
  sortDirection?: SortDirection;
};

export type PaginationMeta = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type PaginatedShipmentRates = {
  data: ShipmentRate[];
  meta: PaginationMeta;
};

export type ShipmentRateOption = {
  id: number;
  label: string;
  code?: string;
  description?: string;
};

export type ShipmentRateOptionsState = {
  routes: ShipmentRateOption[];
  cargoTypes: ShipmentRateOption[];
  loading: boolean;
  error: string | null;
};
