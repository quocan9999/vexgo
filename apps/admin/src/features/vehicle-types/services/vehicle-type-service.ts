import { getApiBaseUrl } from '@/lib/api-url';
import type {
  PaginatedVehicleTypes,
  VehicleType,
  VehicleTypeListQuery,
} from '../types/vehicle-type';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getErrorMessage(body: unknown, resource: string, status: number) {
  if (isRecord(body) && typeof body.message === 'string') {
    return body.message;
  }
  return `Không thể tải ${resource} (HTTP ${status}).`;
}

async function readResponse(response: Response, resource: string) {
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(getErrorMessage(body, resource, response.status));
  }
  return body;
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
  const body = await readResponse(response, 'danh sách loại xe');

  if (!isRecord(body) || !Array.isArray(body.data) || !isRecord(body.meta)) {
    throw new Error('API trả về danh sách loại xe không hợp lệ.');
  }

  return body as unknown as PaginatedVehicleTypes;
}

export async function getVehicleTypeById(
  vehicleTypeId: number,
  signal?: AbortSignal,
): Promise<VehicleType> {
  const response = await fetch(
    `${getApiBaseUrl()}/api/v1/vehicle-types/${vehicleTypeId}`,
    { cache: 'no-store', signal },
  );
  const body = await readResponse(response, 'thông tin loại xe');

  if (!isRecord(body) || !isRecord(body.data)) {
    throw new Error('API trả về thông tin loại xe không hợp lệ.');
  }

  return body.data as unknown as VehicleType;
}
