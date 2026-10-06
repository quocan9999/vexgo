const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export type RouteSummary = {
  routeId: number;
  code: string;
  origin: string;
  destination: string;
  status: string;
  busCompany: {
    busCompanyId: number;
    code: string;
    name: string;
  };
};

export type RouteListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: 'HOAT_DONG' | 'TAM_NGUNG';
  busCompanyId?: number;
  sortBy?:
    'code' | 'origin' | 'destination' | 'status' | 'createdAt' | 'updatedAt';
  sortDirection?: 'asc' | 'desc';
};

export type RouteListResponse = {
  data: RouteSummary[];
  meta: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
};

export const routesApi = {
  async listRoutes(params: RouteListParams = {}): Promise<RouteListResponse> {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') query.set(key, String(value));
    }

    const suffix = query.size > 0 ? `?${query.toString()}` : '';
    const response = await fetch(`${API_BASE_URL}/routes${suffix}`);
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Không thể tải danh sách tuyến xe');
    }
    return response.json();
  },
};
