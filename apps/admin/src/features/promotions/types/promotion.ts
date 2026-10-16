export type PromotionStatus = 'HOAT_DONG' | 'TAM_NGUNG';
export type PromotionDiscountType = 'PHAN_TRAM' | 'SO_TIEN';
export type PromotionEffectiveState =
  | 'UPCOMING'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'EXPIRED'
  | 'EXHAUSTED'
  | 'UNAVAILABLE';
export type PromotionSortKey =
  | 'name'
  | 'code'
  | 'startsOn'
  | 'endsOn'
  | 'usageCount'
  | 'status'
  | 'createdAt';
export type SortDirection = 'asc' | 'desc';

export type Promotion = {
  id: number;
  name: string;
  code: string;
  discountType: PromotionDiscountType;
  discountValue: string;
  maxDiscount: string | null;
  minimumTicketAmount: string | null;
  startsOn: string;
  endsOn: string;
  status: PromotionStatus;
  usageCount: number;
  usageLimit: number;
  remainingUses: number;
  effectiveState: PromotionEffectiveState;
};

export type CreatePromotionRequest = {
  name: string;
  code: string;
  discountType: PromotionDiscountType;
  discountValue: string;
  maxDiscount?: string;
  minimumTicketAmount?: string;
  startsOn: string;
  endsOn: string;
  usageLimit: number;
};

export type PromotionListQuery = {
  page: number;
  pageSize: number;
  search: string;
  sortBy: PromotionSortKey;
  sortDirection: SortDirection;
  status?: PromotionStatus;
  fromDate?: string;
  toDate?: string;
};

export type PaginatedPromotions = {
  data: Promotion[];
  meta: { page: number; pageSize: number; totalItems: number; totalPages: number };
};
