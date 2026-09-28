export type RouteStatus = 'HOAT_DONG' | 'TAM_NGUNG';
export const ROUTE_STATUSES: readonly RouteStatus[] = ['HOAT_DONG', 'TAM_NGUNG'];
export type RouteSortKey = 'code' | 'origin' | 'destination' | 'status' | 'createdAt' | 'updatedAt';
export type SortDirection = 'asc' | 'desc';

export type Route = {
  routeId: number;
  code: string;
  origin: string;
  destination: string;
  status: RouteStatus;
  busCompany: { busCompanyId: number; code: string; name: string };
  createdAt: string;
  updatedAt: string;
};

export type RouteListQuery = {
  page: number;
  pageSize: number;
  search: string;
  sortBy: RouteSortKey;
  sortDirection: SortDirection;
  status?: RouteStatus;
  busCompanyId?: number;
};

export type PaginatedRoutes = {
  data: Route[];
  meta: { page: number; pageSize: number; totalItems: number; totalPages: number };
};
