import { getApiBaseUrl } from '@/lib/api-url';
import { getBusCompanies } from '@/features/bus-companies/services/bus-company-service';
import type {
  BusCompany,
  BusCompanyListQuery,
} from '@/features/bus-companies/types/bus-company';
import { getVehicleTypes } from '@/features/vehicle-types/services/vehicle-type-service';
import type {
  VehicleType,
  VehicleTypeListQuery,
} from '@/features/vehicle-types/types/vehicle-type';
import type {
  CreateVehicleInput,
  PaginatedVehicles,
  Vehicle,
  VehicleListQuery,
  VehicleStatus,
  UpdateVehicleInput,
} from '../types/vehicle';

const FILTER_OPTION_PAGE_SIZE = 100;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getErrorMessage(body: unknown, resource: string, status: number) {
  if (isRecord(body) && typeof body.message === 'string') {
    return body.message;
  }
  return `Không thể tải ${resource} (HTTP ${status}).`;
}

export type VehicleApiErrorDetail = {
  field: string;
  message: string;
};

export class VehicleApiError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly details: VehicleApiErrorDetail[] = [],
  ) {
    super(message);
    this.name = 'VehicleApiError';
  }
}

function getApiErrorCode(body: unknown) {
  return isRecord(body) && typeof body.error === 'string'
    ? body.error
    : undefined;
}

function getApiErrorDetails(body: unknown): VehicleApiErrorDetail[] {
  if (!isRecord(body) || !Array.isArray(body.details)) return [];

  return body.details.flatMap((detail) =>
    isRecord(detail) &&
    typeof detail.field === 'string' &&
    typeof detail.message === 'string'
      ? [{ field: detail.field, message: detail.message }]
      : [],
  );
}

async function readResponse(response: Response, resource: string) {
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new VehicleApiError(
      getErrorMessage(body, resource, response.status),
      getApiErrorCode(body),
      getApiErrorDetails(body),
    );
  }
  return body;
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
  const body = await readResponse(response, 'danh sách xe');

  if (!isRecord(body) || !Array.isArray(body.data) || !isRecord(body.meta)) {
    throw new Error('API trả về danh sách xe không hợp lệ.');
  }

  return body as unknown as PaginatedVehicles;
}

export async function getVehicleById(
  vehicleId: number,
  signal?: AbortSignal,
): Promise<Vehicle> {
  const response = await fetch(
    `${getApiBaseUrl()}/api/v1/vehicles/${vehicleId}`,
    { cache: 'no-store', signal },
  );
  const body = await readResponse(response, 'thông tin xe');

  if (!isRecord(body) || !isRecord(body.data)) {
    throw new Error('API trả về thông tin xe không hợp lệ.');
  }

  return body.data as unknown as Vehicle;
}

async function mutateVehicle(
  url: string,
  method: 'POST' | 'PATCH',
  input: CreateVehicleInput | UpdateVehicleInput | { status: VehicleStatus },
  resource: string,
): Promise<Vehicle> {
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    cache: 'no-store',
  });
  const body = await readResponse(response, resource);

  if (!isRecord(body) || !isRecord(body.data)) {
    throw new Error('API trả về thông tin xe không hợp lệ.');
  }

  return body.data as unknown as Vehicle;
}

export function createVehicle(input: CreateVehicleInput): Promise<Vehicle> {
  return mutateVehicle(
    `${getApiBaseUrl()}/api/v1/vehicles`,
    'POST',
    input,
    'tạo xe',
  );
}

export function updateVehicle(
  vehicleId: number,
  input: UpdateVehicleInput,
): Promise<Vehicle> {
  return mutateVehicle(
    `${getApiBaseUrl()}/api/v1/vehicles/${vehicleId}`,
    'PATCH',
    input,
    'cập nhật xe',
  );
}

export function updateVehicleStatus(
  vehicleId: number,
  status: VehicleStatus,
): Promise<Vehicle> {
  return mutateVehicle(
    `${getApiBaseUrl()}/api/v1/vehicles/${vehicleId}/status`,
    'PATCH',
    { status },
    'cập nhật trạng thái xe',
  );
}

async function getAllPages<T>(
  loadPage: (page: number) => Promise<{
    data: T[];
    meta: { totalPages: number };
  }>,
): Promise<T[]> {
  const firstPage = await loadPage(1);
  const totalPages = firstPage.meta.totalPages;

  if (!Number.isInteger(totalPages) || totalPages < 0) {
    throw new Error('API trả về số trang bộ lọc không hợp lệ.');
  }
  if (totalPages === 0) return firstPage.data;

  const remainingPageCount = totalPages - 1;

  const remainingPages = await Promise.all(
    Array.from({ length: remainingPageCount }, (_, index) =>
      loadPage(index + 2),
    ),
  );

  return [firstPage, ...remainingPages].flatMap((page) => page.data);
}

const busCompanyOptionsQuery = (page: number): BusCompanyListQuery => ({
  page,
  pageSize: FILTER_OPTION_PAGE_SIZE,
  search: '',
  sortBy: 'name',
  sortDirection: 'asc',
});

const vehicleTypeOptionsQuery = (page: number): VehicleTypeListQuery => ({
  page,
  pageSize: FILTER_OPTION_PAGE_SIZE,
  search: '',
  sortBy: 'name',
  sortDirection: 'asc',
});

export function getAllBusCompanyOptions(
  signal?: AbortSignal,
): Promise<BusCompany[]> {
  return getAllPages<BusCompany>((page) =>
    getBusCompanies(busCompanyOptionsQuery(page), signal),
  );
}

export function getAllVehicleTypeOptions(
  signal?: AbortSignal,
): Promise<VehicleType[]> {
  return getAllPages<VehicleType>((page) =>
    getVehicleTypes(vehicleTypeOptionsQuery(page), signal),
  );
}
