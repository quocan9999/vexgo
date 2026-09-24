import { getApiBaseUrl } from '@/lib/api-url';
import type {
  CreateVehicleTypeInput,
  PaginatedVehicleTypes,
  VehicleType,
  VehicleTypeListQuery,
  UpdateVehicleTypeInput,
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

export type VehicleTypeApiErrorDetail = {
  field: string;
  message: string;
};

export class VehicleTypeApiError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly details: VehicleTypeApiErrorDetail[] = [],
  ) {
    super(message);
    this.name = 'VehicleTypeApiError';
  }
}

function getApiErrorCode(body: unknown) {
  return isRecord(body) && typeof body.error === 'string'
    ? body.error
    : undefined;
}

function getApiErrorDetails(body: unknown): VehicleTypeApiErrorDetail[] {
  if (!isRecord(body) || !Array.isArray(body.details)) return [];

  return body.details.flatMap((detail) =>
    isRecord(detail) &&
    typeof detail.field === 'string' &&
    typeof detail.message === 'string'
      ? [{ field: detail.field, message: detail.message }]
      : [],
  );
}

async function saveVehicleType(
  method: 'POST' | 'PATCH',
  url: string,
  input: CreateVehicleTypeInput | UpdateVehicleTypeInput,
  action: string,
): Promise<VehicleType> {
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    cache: 'no-store',
  });
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new VehicleTypeApiError(
      isRecord(body) && typeof body.message === 'string'
        ? body.message
        : `Không thể ${action} loại xe (HTTP ${response.status}).`,
      getApiErrorCode(body),
      getApiErrorDetails(body),
    );
  }
  if (!isRecord(body) || !isRecord(body.data)) {
    throw new Error('API trả về thông tin loại xe không hợp lệ.');
  }

  return body.data as unknown as VehicleType;
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

export function createVehicleType(
  input: CreateVehicleTypeInput,
): Promise<VehicleType> {
  return saveVehicleType(
    'POST',
    `${getApiBaseUrl()}/api/v1/vehicle-types`,
    input,
    'tạo',
  );
}

export function updateVehicleType(
  vehicleTypeId: number,
  input: UpdateVehicleTypeInput,
): Promise<VehicleType> {
  return saveVehicleType(
    'PATCH',
    `${getApiBaseUrl()}/api/v1/vehicle-types/${vehicleTypeId}`,
    input,
    'cập nhật',
  );
}
