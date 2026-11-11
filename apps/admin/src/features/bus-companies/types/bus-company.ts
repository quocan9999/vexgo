export type BusCompanyStatus = 'HOAT_DONG' | 'TAM_NGUNG';

export type BusCompany = {
  busCompanyId: number;
  code: string;
  name: string;
  contactInfo: string | null;
  status: BusCompanyStatus;
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
  status?: BusCompanyStatus;
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
