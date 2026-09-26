export const VEHICLE_STATUSES = ['HOAT_DONG', 'BAO_TRI'] as const;

export type VehicleStatus = (typeof VEHICLE_STATUSES)[number];
export type CreateVehicleInput = {
  licensePlate: string;
  busCompanyId: number;
  vehicleTypeId: number;
  status: VehicleStatus;
};

export type UpdateVehicleInput = Omit<CreateVehicleInput, 'status'>;

export type VehicleSortKey =
  'licensePlate' | 'status' | 'createdAt' | 'updatedAt';
export type SortDirection = 'asc' | 'desc';

export type VehicleListQuery = {
  search: string;
  page: number;
  pageSize: number;
  sortBy: VehicleSortKey;
  sortDirection: SortDirection;
  status?: VehicleStatus;
  busCompanyId?: number;
  vehicleTypeId?: number;
};

export type VehicleListItem = {
  vehicleId: number;
  licensePlate: string;
  status: VehicleStatus;
  busCompany: {
    busCompanyId: number;
    code: string;
    name: string;
  };
  vehicleType: {
    vehicleTypeId: number;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
};

export type VehicleDetail = Omit<VehicleListItem, 'vehicleType'> & {
  vehicleType: VehicleListItem['vehicleType'] & {
    description: string | null;
  };
};

export type PaginatedVehicles = {
  data: VehicleListItem[];
  meta: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
};

export type VehicleFilterOption = {
  id: number;
  label: string;
};

export type VehicleSeat = {
  seatId: number;
  seatNumber: string;
  position: string | null;
  vehicleId: number;
  createdAt: string;
  updatedAt: string;
};

export type VehicleSeatInput = {
  seatNumber: string;
  position: string | null;
};
