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

export type SearchTripsParams = {
  from?: string;
  to?: string;
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

    const response = await fetch(
      `${API_BASE_URL}/trips/search?${query.toString()}`,
    );
    if (!response.ok)
      throw await parseError(response, 'Không thể tải danh sách chuyến xe');
    return response.json();
  },

  async getTripDetails(tripId: number): Promise<ApiTrip | null> {
    const response = await fetch(`${API_BASE_URL}/trips/${tripId}`);
    if (response.status === 404) return null;
    if (!response.ok)
      throw await parseError(response, 'Không thể tải chi tiết chuyến xe');
    const body: { data: ApiTrip } = await response.json();
    return body.data;
  },

  async getTripSeats(tripId: number) {
    const response = await fetch(`${API_BASE_URL}/trips/${tripId}/seats`);
    if (!response.ok)
      throw await parseError(response, 'Không thể tải sơ đồ ghế');
    const body = await response.json();
    return body.data;
  },
};
