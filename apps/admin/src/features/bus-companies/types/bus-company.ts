export type BusCompany = {
  busCompanyId: number;
  code: string;
  name: string;
  contactInfo: string | null;
  cancellationPolicy: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type BusCompanySortKey = 'name' | 'code' | 'status' | 'createdAt';

export type SortDirection = 'asc' | 'desc';

export type BusCompanyListQuery = {
  search: string;
  page: number;
  pageSize: number;
  sortBy: BusCompanySortKey;
  sortDirection: SortDirection;
  status?: string;
  createdFrom?: string;
  createdTo?: string;
};

export type PaginatedBusCompanies = {
  data: BusCompany[];
  meta: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
};
