export type VehicleType = {
  vehicleTypeId: number;
  name: string;
  description: string | null;
  motorbikeCapacityDefault: number;
  bulkyCargoCapacityDefault: number;
  lightCargoCapacityDefault: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateVehicleTypeInput = {
  name: string;
  description: string | null;
  busCompanyId: number;
  motorbikeCapacityDefault?: number;
  bulkyCargoCapacityDefault?: number;
  lightCargoCapacityDefault?: number;
};

export type UpdateVehicleTypeInput = {
  name: string;
  description: string | null;
  motorbikeCapacityDefault?: number;
  bulkyCargoCapacityDefault?: number;
  lightCargoCapacityDefault?: number;
};

export type VehicleTypeSortKey = 'name' | 'createdAt' | 'updatedAt';

export type SortDirection = 'asc' | 'desc';

export type VehicleTypeListQuery = {
  search: string;
  page: number;
  pageSize: number;
  sortBy: VehicleTypeSortKey;
  sortDirection: SortDirection;
};

export type PaginatedVehicleTypes = {
  data: VehicleType[];
  meta: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
};
