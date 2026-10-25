import { fetchWithRetry } from '../../../lib/fetch-with-retry.ts';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export type ApiTrip = {
  id: number;
  code: string;
  status: string;
  busCompany: {
    id: number;
    name: string;
    logo: string | null;
    rating: number | null;
    reviewsCount: number | null;
  };
  route: {
    id: number;
    code: string;
    origin: string;
    destination: string;
    distance: number | null;
    durationMinutes: number | null;
  };
  departureTime: string;
  arrivalTime: string | null;
  vehicle: {
    id: number;
    typeId: number;
    type: string;
    licensePlate: string;
    capacity: number;
    amenities: string[];
  };
  price: number | null;
  availableSeats: number;
};

export type ApiTripSeat = {
  tripSeatId: number;
  seatNumber: string;
  position: string | null;
  floor?: number | null;
  x?: number | null;
  y?: number | null;
  status: string;
};

export type SearchTripsParams = {
  from?: string;
  to?: string;
  search?: string;
  vehicleType?: string;
  operator?: string;
  timeRange?: string;
  departureDate?: string;
  busCompanyId?: number;
  vehicleTypeId?: number;
  minPrice?: number;
  maxPrice?: number;
  page?: number;
  pageSize?: number;
  sortBy?: 'departureTime' | 'price' | 'availableSeats';
  sortDirection?: 'asc' | 'desc';
};

export type TripSearchResponse = {
  data: ApiTrip[];
  meta: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
};

async function parseError(
  response: Response,
  fallback: string,
): Promise<Error> {
  const body = await response.json().catch(() => ({}));
  return new Error(body.message || fallback);
}

export const tripsApi = {
  async searchTrips(params: SearchTripsParams): Promise<TripSearchResponse> {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') query.set(key, String(value));
    }

    const response = await fetchWithRetry(
      `${API_BASE_URL}/trips/search?${query.toString()}`,
    );
    if (!response.ok)
      throw await parseError(response, 'Không thể tải danh sách chuyến xe');
    return response.json();
  },

  async getTripDetails(tripId: number): Promise<ApiTrip | null> {
    const response = await fetchWithRetry(`${API_BASE_URL}/trips/${tripId}`);
    if (response.status === 404) return null;
    if (!response.ok)
      throw await parseError(response, 'Không thể tải chi tiết chuyến xe');
    const body: { data: ApiTrip } = await response.json();
    return body.data;
  },

  async getTripSeats(tripId: number): Promise<ApiTripSeat[]> {
    const response = await fetchWithRetry(`${API_BASE_URL}/trips/${tripId}/seats`);
    if (!response.ok)
      throw await parseError(response, 'Không thể tải sơ đồ ghế');
    const body: { data: ApiTripSeat[] } = await response.json();
    return body.data;
  },

  async getCargoCapacity(tripId: number): Promise<{
    acceptsShipments: boolean;
    capacities: {
      motorcycles: { total: number; used: number; remaining: number };
      bulkyGoods: { total: number; used: number; remaining: number };
      parcels: { total: number; used: number; remaining: number };
    };
  }> {
    const response = await fetchWithRetry(`${API_BASE_URL}/trips/${tripId}/cargo-capacity`);
    if (!response.ok)
      throw await parseError(response, 'Không thể tải sức chứa hàng hóa');
    const body = await response.json();
    return body.data ?? body;
  },

  async getTripAlternatives(
    tripId: number,
    options?: { otherOperatorsOnly?: boolean; maxPrice?: number; limit?: number },
  ): Promise<AlternativeTripItem[]> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.otherOperatorsOnly !== undefined) {
      params.set('otherOperatorsOnly', String(options.otherOperatorsOnly));
    } else {
      params.set('otherOperatorsOnly', 'true');
    }
    if (options?.maxPrice !== undefined) {
      params.set('maxPrice', String(options.maxPrice));
    }
    const queryString = params.toString();
    const response = await fetchWithRetry(
      `${API_BASE_URL}/trips/${tripId}/alternatives${queryString ? `?${queryString}` : ''}`,
    );
    if (!response.ok) return [];
    const body = await response.json();
    return body.data ?? body ?? [];
  },
};

export type AlternativeTripItem = {
  tripId: number;
  id: string;
  routeId: string;
  busCompanyId: number;
  busCompanyName: string;
  operatorName: string;
  vehicleTypeName: string;
  vehicleType: string;
  fromCityId: string;
  fromCityName: string;
  toCityId: string;
  toCityName: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  price: number;
  originalPrice: number;
  discountPrice: number;
  availableSeats: number;
  totalSeats: number;
  seatLayoutType: string;
  rating: number | null;
  reviewCount: number;
  pickupPoint: string;
  pickupAddress: string | null;
  dropoffPoint: string;
  dropoffAddress: string | null;
  amenities: string[];
  recommendationReason: string;
  matchScore: number;
};

export type ApiBusCompany = {
  busCompanyId: number;
  code: string;
  name: string;
  status: string;
};

export const busCompaniesApi = {
  async getBusCompanies(): Promise<ApiBusCompany[]> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/bus-companies?pageSize=100&status=HOAT_DONG`,
      );
      if (!response.ok) return [];
      const body: { data?: ApiBusCompany[] } = await response.json();
      return body.data ?? [];
    } catch {
      return [];
    }
  },
};
