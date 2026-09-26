export type VehicleType = {
  vehicleTypeId: number;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateVehicleTypeInput = {
  name: string;
  description: string | null;
};

export type UpdateVehicleTypeInput = {
  name: string;
  description: string | null;
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
