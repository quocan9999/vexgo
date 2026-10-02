export type TripStatus =
  | 'CHUA_KHOI_HANH'
  | 'DANG_CHAY'
  | 'HOAN_THANH'
  | 'DA_HUY';

export const TRIP_STATUSES: readonly TripStatus[] = [
  'CHUA_KHOI_HANH',
  'DANG_CHAY',
  'HOAN_THANH',
  'DA_HUY',
];

export type TripSortKey =
  | 'code'
  | 'departureDate'
  | 'departureTime'
  | 'status'
  | 'createdAt'
  | 'updatedAt';

export type SortDirection = 'asc' | 'desc';

export type TripRoute = {
  routeId: number;
  code: string;
  origin: string;
  destination: string;
};

export type TripVehicle = {
  vehicleId: number;
  licensePlate: string;
  status: string;
  vehicleType: {
    vehicleTypeId: number;
    name: string;
  };
};

export type TripSeatSummary = {
  total: number;
  available: number;
  held: number;
  booked: number;
};

export type Trip = {
  tripId: number;
  code: string;
  departureDate: string;
  departureTime: string;
  status: TripStatus;
  route: TripRoute;
  vehicle: TripVehicle;
  seatSummary?: TripSeatSummary;
  createdAt: string;
  updatedAt: string;
};

export type TripListQuery = {
  page: number;
  pageSize: number;
  search: string;
  sortBy: TripSortKey;
  sortDirection: SortDirection;
  status?: TripStatus;
  routeId?: number;
  vehicleId?: number;
  departureDate?: string;
};

export type PaginatedTrips = {
  data: Trip[];
  meta: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
};
