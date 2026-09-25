import { getBusCompanies } from '@/features/bus-companies/services/bus-company-service';
import type {
  BusCompanyListQuery,
  PaginatedBusCompanies,
} from '@/features/bus-companies/types/bus-company';
import { getVehicleTypes } from '@/features/vehicle-types/services/vehicle-type-service';
import type {
  PaginatedVehicleTypes,
  VehicleTypeListQuery,
} from '@/features/vehicle-types/types/vehicle-type';
import { getApiBaseUrl } from '@/lib/api-url';
import { VEHICLE_STATUSES } from '../types/vehicle';
import type {
  CreateVehicleInput,
  PaginatedVehicles,
  VehicleDetail,
  VehicleFilterOption,
  VehicleListItem,
  VehicleListQuery,
  UpdateVehicleInput,
  VehicleStatus,
  VehicleSeat,
  VehicleSeatInput,
} from '../types/vehicle';

export class VehicleApiError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'VehicleApiError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isVehicleStatus(value: unknown) {
  return (
    typeof value === 'string' &&
    VEHICLE_STATUSES.includes(value as (typeof VEHICLE_STATUSES)[number])
  );
}

function isVehicleListItem(value: unknown): value is VehicleListItem {
  return (
    isRecord(value) &&
    Number.isSafeInteger(value.vehicleId) &&
    typeof value.licensePlate === 'string' &&
    isVehicleStatus(value.status) &&
    isRecord(value.busCompany) &&
    Number.isSafeInteger(value.busCompany.busCompanyId) &&
    typeof value.busCompany.code === 'string' &&
    typeof value.busCompany.name === 'string' &&
    isRecord(value.vehicleType) &&
    Number.isSafeInteger(value.vehicleType.vehicleTypeId) &&
    typeof value.vehicleType.name === 'string' &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string'
  );
}

function isVehicleDetail(value: unknown): value is VehicleDetail {
  return (
    isRecord(value) &&
    isVehicleListItem({ ...value, vehicleType: value.vehicleType }) &&
    isRecord(value.vehicleType) &&
    (typeof value.vehicleType.description === 'string' ||
      value.vehicleType.description === null)
  );
}

function isPaginatedVehicles(value: unknown): value is PaginatedVehicles {
  return (
    isRecord(value) &&
    Array.isArray(value.data) &&
    value.data.every(isVehicleListItem) &&
    isRecord(value.meta) &&
    Number.isSafeInteger(value.meta.page) &&
    Number.isSafeInteger(value.meta.pageSize) &&
    Number.isSafeInteger(value.meta.totalItems) &&
    Number.isSafeInteger(value.meta.totalPages)
  );
}

function getErrorMessage(body: unknown, status: number, resource: string) {
  if (isRecord(body) && typeof body.message === 'string') {
    return body.message;
  }

  return `Không thể tải ${resource} (HTTP ${status}).`;
}

function getWriteError(body: unknown, status: number, action: string) {
  const message =
    isRecord(body) && typeof body.message === 'string'
      ? body.message
      : `Không thể ${action} xe (HTTP ${status}).`;
  const code =
    isRecord(body) && typeof body.error === 'string' ? body.error : undefined;

  return new VehicleApiError(message, code);
}

function parseVehicleResponse(body: unknown) {
  if (!isRecord(body) || !isVehicleDetail(body.data)) {
    throw new Error('API trả về thông tin xe không hợp lệ.');
  }
  return body.data;
}

export async function createVehicle(
  input: CreateVehicleInput,
): Promise<VehicleDetail> {
  const response = await fetch(`${getApiBaseUrl()}/api/v1/vehicles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    cache: 'no-store',
  });
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) throw getWriteError(body, response.status, 'tạo');
  return parseVehicleResponse(body);
}

export async function updateVehicle(
  vehicleId: number,
  input: UpdateVehicleInput,
): Promise<VehicleDetail> {
  const response = await fetch(
    `${getApiBaseUrl()}/api/v1/vehicles/${vehicleId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      cache: 'no-store',
    },
  );
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) throw getWriteError(body, response.status, 'cập nhật');
  return parseVehicleResponse(body);
}

export async function updateVehicleStatus(
  vehicleId: number,
  status: VehicleStatus,
): Promise<VehicleDetail> {
  const response = await fetch(
    `${getApiBaseUrl()}/api/v1/vehicles/${vehicleId}/status`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
      cache: 'no-store',
    },
  );
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) throw getWriteError(body, response.status, 'cập nhật');
  return parseVehicleResponse(body);
}

export async function getVehicles(
  query: VehicleListQuery,
  signal?: AbortSignal,
): Promise<PaginatedVehicles> {
  const searchParams = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
    search: query.search,
    sortBy: query.sortBy,
    sortDirection: query.sortDirection,
  });
  if (query.status) searchParams.set('status', query.status);
  if (query.busCompanyId !== undefined) {
    searchParams.set('busCompanyId', String(query.busCompanyId));
  }
  if (query.vehicleTypeId !== undefined) {
    searchParams.set('vehicleTypeId', String(query.vehicleTypeId));
  }

  const response = await fetch(
    `${getApiBaseUrl()}/api/v1/vehicles?${searchParams.toString()}`,
    { cache: 'no-store', signal },
  );
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(getErrorMessage(body, response.status, 'danh sách xe'));
  }
  if (!isPaginatedVehicles(body)) {
    throw new Error('API trả về danh sách xe không hợp lệ.');
  }

  return body;
}

export async function getVehicleById(
  vehicleId: number,
  signal?: AbortSignal,
): Promise<VehicleDetail> {
  const response = await fetch(
    `${getApiBaseUrl()}/api/v1/vehicles/${vehicleId}`,
    { cache: 'no-store', signal },
  );
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(getErrorMessage(body, response.status, 'thông tin xe'));
  }
  if (!isRecord(body) || !isVehicleDetail(body.data)) {
    throw new Error('API trả về thông tin xe không hợp lệ.');
  }

  return body.data;
}

const FILTER_PAGE_SIZE = 100;

async function collectAllPages<T>(
  firstPage: { data: T[]; meta: { totalPages: number } },
  getPage: (
    page: number,
  ) => Promise<{ data: T[]; meta: { totalPages: number } }>,
) {
  const { totalPages } = firstPage.meta;
  if (!Number.isSafeInteger(totalPages) || totalPages < 0) {
    throw new Error('API trả về thông tin phân trang bộ lọc không hợp lệ.');
  }

  const remainingPages = await Promise.all(
    Array.from({ length: Math.max(0, totalPages - 1) }, (_, index) =>
      getPage(index + 2),
    ),
  );

  return [firstPage, ...remainingPages].flatMap((page) => page.data);
}

function busCompanyQuery(page: number): BusCompanyListQuery {
  return {
    search: '',
    page,
    pageSize: FILTER_PAGE_SIZE,
    sortBy: 'name',
    sortDirection: 'asc',
  };
}

function vehicleTypeQuery(page: number): VehicleTypeListQuery {
  return {
    search: '',
    page,
    pageSize: FILTER_PAGE_SIZE,
    sortBy: 'name',
    sortDirection: 'asc',
  };
}

export async function getBusCompanyFilterOptions(
  signal?: AbortSignal,
): Promise<VehicleFilterOption[]> {
  const firstPage = await getBusCompanies(busCompanyQuery(1), signal);
  const companies = await collectAllPages<
    PaginatedBusCompanies['data'][number]
  >(firstPage, (page) => getBusCompanies(busCompanyQuery(page), signal));

  return companies.map((company) => ({
    id: company.busCompanyId,
    label: company.name,
  }));
}

export async function getVehicleTypeFilterOptions(
  signal?: AbortSignal,
): Promise<VehicleFilterOption[]> {
  const firstPage = await getVehicleTypes(vehicleTypeQuery(1), signal);
  const vehicleTypes = await collectAllPages<
    PaginatedVehicleTypes['data'][number]
  >(firstPage, (page) => getVehicleTypes(vehicleTypeQuery(page), signal));

  return vehicleTypes.map((vehicleType) => ({
    id: vehicleType.vehicleTypeId,
    label: vehicleType.name,
  }));
}

function isVehicleSeat(value: unknown): value is VehicleSeat {
  return (
    isRecord(value) &&
    Number.isSafeInteger(value.seatId) &&
    typeof value.seatNumber === 'string' &&
    (typeof value.position === 'string' || value.position === null) &&
    Number.isSafeInteger(value.vehicleId) &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string'
  );
}

export async function getVehicleSeats(
  vehicleId: number,
  signal?: AbortSignal,
): Promise<VehicleSeat[]> {
  const response = await fetch(
    `${getApiBaseUrl()}/api/v1/vehicles/${vehicleId}/seats`,
    { cache: 'no-store', signal },
  );
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(getErrorMessage(body, response.status, 'danh sách ghế'));
  }
  if (
    !isRecord(body) ||
    !Array.isArray(body.data) ||
    !body.data.every(isVehicleSeat) ||
    !isRecord(body.meta) ||
    !Number.isSafeInteger(body.meta.totalItems) ||
    body.meta.totalItems !== body.data.length
  ) {
    throw new Error('API trả về danh sách ghế không hợp lệ.');
  }
  return body.data;
}

function getVehicleSeatWriteError(
  body: unknown,
  status: number,
  action: string,
) {
  const message =
    isRecord(body) && typeof body.message === 'string'
      ? body.message
      : `Không thể ${action} ghế (HTTP ${status}).`;
  const code =
    isRecord(body) && typeof body.error === 'string' ? body.error : undefined;
  return new VehicleApiError(message, code);
}

function parseVehicleSeatResponse(body: unknown): VehicleSeat {
  if (!isRecord(body) || !isVehicleSeat(body.data)) {
    throw new Error('API trả về thông tin ghế không hợp lệ.');
  }
  return body.data;
}

export async function createVehicleSeat(
  vehicleId: number,
  input: VehicleSeatInput,
): Promise<VehicleSeat> {
  const response = await fetch(
    `${getApiBaseUrl()}/api/v1/vehicles/${vehicleId}/seats`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      cache: 'no-store',
    },
  );
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) throw getVehicleSeatWriteError(body, response.status, 'thêm');
  return parseVehicleSeatResponse(body);
}

export async function updateVehicleSeat(
  vehicleId: number,
  seatId: number,
  input: VehicleSeatInput,
): Promise<VehicleSeat> {
  const response = await fetch(
    `${getApiBaseUrl()}/api/v1/vehicles/${vehicleId}/seats/${seatId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      cache: 'no-store',
    },
  );
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) throw getVehicleSeatWriteError(body, response.status, 'sửa');
  return parseVehicleSeatResponse(body);
}

export async function deleteVehicleSeat(
  vehicleId: number,
  seatId: number,
): Promise<void> {
  const response = await fetch(
    `${getApiBaseUrl()}/api/v1/vehicles/${vehicleId}/seats/${seatId}`,
    { method: 'DELETE', cache: 'no-store' },
  );
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    throw getVehicleSeatWriteError(body, response.status, 'xóa');
  }
}
