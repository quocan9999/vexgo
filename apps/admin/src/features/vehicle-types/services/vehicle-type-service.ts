import { getApiBaseUrl } from '@/lib/api-url';
import type {
  PaginatedVehicleTypes,
  VehicleType,
  VehicleTypeListQuery,
} from '../types/vehicle-type';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isVehicleType(value: unknown): value is VehicleType {
  return (
    isRecord(value) &&
    Number.isSafeInteger(value.vehicleTypeId) &&
    typeof value.name === 'string' &&
    (typeof value.description === 'string' || value.description === null) &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string'
  );
}

function isPaginatedVehicleTypes(
  value: unknown,
): value is PaginatedVehicleTypes {
  return (
    isRecord(value) &&
    Array.isArray(value.data) &&
    value.data.every(isVehicleType) &&
    isRecord(value.meta) &&
    Number.isInteger(value.meta.page) &&
    Number.isInteger(value.meta.pageSize) &&
    Number.isInteger(value.meta.totalItems) &&
    Number.isInteger(value.meta.totalPages)
  );
}

function getErrorMessage(body: unknown, status: number, resource: string) {
  if (isRecord(body) && typeof body.message === 'string') {
    return body.message;
  }

  return `Không thể tải ${resource} (HTTP ${status}).`;
}

export async function getVehicleTypes(
  query: VehicleTypeListQuery,
  signal?: AbortSignal,
): Promise<PaginatedVehicleTypes> {
  const searchParams = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
    search: query.search,
    sortBy: query.sortBy,
    sortDirection: query.sortDirection,
  });
  const response = await fetch(
    `${getApiBaseUrl()}/api/v1/vehicle-types?${searchParams.toString()}`,
    { cache: 'no-store', signal },
  );
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(getErrorMessage(body, response.status, 'danh sách loại xe'));
  }
  if (!isPaginatedVehicleTypes(body)) {
    throw new Error('API trả về danh sách loại xe không hợp lệ.');
  }

  return body;
}

export async function getVehicleTypeById(
  vehicleTypeId: number,
  signal?: AbortSignal,
): Promise<VehicleType> {
  const response = await fetch(
    `${getApiBaseUrl()}/api/v1/vehicle-types/${vehicleTypeId}`,
    { cache: 'no-store', signal },
  );
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      getErrorMessage(body, response.status, 'thông tin loại xe'),
    );
  }
  if (!isRecord(body) || !isVehicleType(body.data)) {
    throw new Error('API trả về thông tin loại xe không hợp lệ.');
  }

  return body.data;
}
