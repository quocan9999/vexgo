import type { BusCompany } from '@/features/bus-companies/types/bus-company';
import type { VehicleType } from '@/features/vehicle-types/types/vehicle-type';

export type VehicleStatus = 'HOAT_DONG' | 'BAO_TRI';

export type VehicleStatusOption = {
  value: VehicleStatus;
  label: string;
};

export const VEHICLE_STATUS_OPTIONS: VehicleStatusOption[] = [
  { value: 'HOAT_DONG', label: 'Đang hoạt động' },
  { value: 'BAO_TRI', label: 'Bảo trì' },
];

export type VehicleSortKey =
  'licensePlate' | 'status' | 'createdAt' | 'updatedAt';

export type SortDirection = 'asc' | 'desc';

export type VehicleListItem = {
  vehicleId: number;
  licensePlate: string;
  status: VehicleStatus;
  busCompany: Pick<BusCompany, 'busCompanyId' | 'code' | 'name'>;
  vehicleType: Pick<VehicleType, 'vehicleTypeId' | 'name'>;
  createdAt: string;
  updatedAt: string;
};

export type Vehicle = Omit<VehicleListItem, 'vehicleType'> & {
  vehicleType: Pick<VehicleType, 'vehicleTypeId' | 'name' | 'description'>;
};

export type VehicleListQuery = {
  page: number;
  pageSize: number;
  search: string;
  sortBy: VehicleSortKey;
  sortDirection: SortDirection;
  status?: VehicleStatus;
  busCompanyId?: number;
  vehicleTypeId?: number;
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
