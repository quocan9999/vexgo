import { adminApiFetch } from '@/lib/admin-api-client';
import { getApiBaseUrl } from '@/lib/api-url';
import type { CreateStationInput, Station, StationQuery, UpdateStationInput } from '../types/station';

export class StationApiError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly details: Array<{ field: string; message: string }> = [],
  ) {
    super(message);
    this.name = 'StationApiError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function getStations(
  query: StationQuery = {},
): Promise<{ data: Station[]; meta: { page: number; pageSize: number; totalItems: number; totalPages: number } }> {
  const params = new URLSearchParams();
  if (query.page) params.set('page', String(query.page));
  if (query.pageSize) params.set('pageSize', String(query.pageSize));
  if (query.search) params.set('search', query.search);
  if (query.loaiDiem) params.set('loaiDiem', query.loaiDiem);
  if (query.diaDiemCuId) params.set('diaDiemCuId', String(query.diaDiemCuId));
  if (query.diaDiemMoiId) params.set('diaDiemMoiId', String(query.diaDiemMoiId));
  if (query.nhaXeId) params.set('nhaXeId', String(query.nhaXeId));
  if (query.sortBy) params.set('sortBy', query.sortBy);
  if (query.sortDirection) params.set('sortDirection', query.sortDirection);

  const qs = params.toString();
  const url = `${getApiBaseUrl()}/api/v1/stations${qs ? `?${qs}` : ''}`;
  const response = await adminApiFetch(url, { cache: 'no-store' });
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new StationApiError(
      isRecord(body) && typeof body.message === 'string'
        ? body.message
        : 'Failed to load stations list.',
      isRecord(body) && typeof body.error === 'string' ? body.error : undefined,
    );
  }

  return body;
}

export async function getStationById(id: number): Promise<Station> {
  const response = await adminApiFetch(`${getApiBaseUrl()}/api/v1/stations/${id}`, {
    cache: 'no-store',
  });
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new StationApiError(
      isRecord(body) && typeof body.message === 'string'
        ? body.message
        : 'Failed to load station details.',
      isRecord(body) && typeof body.error === 'string' ? body.error : undefined,
    );
  }

  return body.data;
}

export async function createStation(input: CreateStationInput): Promise<Station> {
  const response = await adminApiFetch(`${getApiBaseUrl()}/api/v1/stations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    cache: 'no-store',
  });
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new StationApiError(
      isRecord(body) && typeof body.message === 'string'
        ? body.message
        : 'Failed to create station.',
      isRecord(body) && typeof body.error === 'string' ? body.error : undefined,
    );
  }

  return body.data;
}

export async function updateStation(id: number, input: UpdateStationInput): Promise<Station> {
  const response = await adminApiFetch(`${getApiBaseUrl()}/api/v1/stations/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    cache: 'no-store',
  });
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new StationApiError(
      isRecord(body) && typeof body.message === 'string'
        ? body.message
        : 'Failed to update station.',
      isRecord(body) && typeof body.error === 'string' ? body.error : undefined,
    );
  }

  return body.data;
}

export async function deleteStation(id: number): Promise<Station> {
  const response = await adminApiFetch(`${getApiBaseUrl()}/api/v1/stations/${id}`, {
    method: 'DELETE',
    cache: 'no-store',
  });
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new StationApiError(
      isRecord(body) && typeof body.message === 'string'
        ? body.message
        : 'Failed to delete station.',
      isRecord(body) && typeof body.error === 'string' ? body.error : undefined,
    );
  }

  return body.data;
}

export async function getTripPassengerPoints(tripId: number) {
  const response = await adminApiFetch(`${getApiBaseUrl()}/api/v1/trips/${tripId}/passenger-points`, {
    cache: 'no-store',
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new StationApiError('Failed to load trip passenger points.');
  }
  return body.data;
}

export async function updateTripPassengerPoints(tripId: number, points: Record<string, unknown>[]) {
  const response = await adminApiFetch(`${getApiBaseUrl()}/api/v1/trips/${tripId}/passenger-points`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ points }),
    cache: 'no-store',
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new StationApiError('Failed to update trip passenger points.');
  }
  return body.data;
}
