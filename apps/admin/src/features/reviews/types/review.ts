export type ReviewStatus = 'HIEN_THI' | 'DA_AN';

export type ReviewCustomer = {
  id: number;
  fullName: string;
  phoneNumber: string;
  email: string | null;
};

export type ReviewTrip = {
  id: number;
  departureDate: string;
  departureTime: string;
  routeName: string;
  busCompanyName: string;
  busCompanyId: number;
  vehicleType: string;
  licensePlate: string;
};

export type ReviewReply = {
  content: string;
  createdAt: string | null;
  responderName: string;
};

export type AdminReviewItem = {
  id: number;
  rating: number;
  comment: string | null;
  createdAt: string;
  isEdited?: boolean;
  status: ReviewStatus;
  reply?: ReviewReply | null;
  customer: ReviewCustomer;
  trip: ReviewTrip | null;
};

export type AdminReviewStats = {
  averageRating: number;
  totalReviews: number;
  satisfactionRate: number;
  negativeCount: number;
  hiddenCount: number;
  visibleCount: number;
  ratingDistribution: Record<number, number>;
};

export type AdminReviewSortKey = 'thoiGian' | 'mucDanhGia';

export type AdminReviewQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
  rating?: number;
  status?: ReviewStatus;
  busCompanyId?: number;
  routeId?: number;
  hasComment?: 'ALL' | 'WITH_COMMENT' | 'WITHOUT_COMMENT';
  timeRange?: 'ALL' | '7_DAYS' | '30_DAYS' | 'THIS_MONTH';
  sortBy?: AdminReviewSortKey;
  sortDirection?: 'asc' | 'desc';
};

export type PaginationMeta = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type AdminReviewPageResponse = {
  data: AdminReviewItem[];
  meta: PaginationMeta;
};

export type AdminReviewStatsResponse = {
  data: AdminReviewStats;
};

export type UpdateReviewStatusResponse = {
  data: {
    id: number;
    status: ReviewStatus;
    updatedAt: string;
  };
  message: string;
};
