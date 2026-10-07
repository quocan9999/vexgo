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

export type TripCargoCapacity = {
  motorbikes: number;
  bulkyCargo: number;
  lightCargo: number;
};

export type Trip = {
  tripId: number;
  code: string;
  departureDate: string;
  departureTime: string;
  status: TripStatus;
  acceptsShipments: boolean;
  cargoCapacity: TripCargoCapacity;
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

export type CreateTripInput = {
  code: string;
  routeId: number;
  vehicleId: number;
  departureDate: string;
  departureTime: string;
  acceptsShipments: boolean;
};

export type UpdateTripInput = {
  departureDate: string;
  departureTime: string;
};

export type TripLookupOption = {
  id: number;
  label: string;
};

export type TripLookupOptionsState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; options: TripLookupOption[] };

export type TripSeatStatus = 'TRONG' | 'DANG_GIU' | 'DA_DAT';

export type TripSeat = {
  tripSeatId: number;
  status: TripSeatStatus;
  seat: {
    seatId: number;
    code: string;
    position: string | null;
  };
  createdAt: string;
  updatedAt: string;
};

export type TripSeatsMeta = {
  tripId: number;
  total: number;
  available: number;
  held: number;
  booked: number;
};

export type TripSeatsResponse = {
  data: TripSeat[];
  meta: TripSeatsMeta;
};
