import { adminApiFetch } from '@/lib/admin-api-client';
import { getApiBaseUrl } from '@/lib/api-url';
import type { TenantDashboardOverview } from '../types/tenant-dashboard';

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function count(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isOverviewValid(value: unknown): value is TenantDashboardOverview {
  if (!record(value) || typeof value.businessDate !== 'string' || typeof value.timeZone !== 'string') {
    return false;
  }
  if (!record(value.metrics) || !Array.isArray(value.upcomingTrips) || !record(value.urgentAlerts)) {
    return false;
  }

  const m = value.metrics;
  const metricsValid =
    count(m.totalTripsToday) &&
    count(m.preparingTrips) &&
    count(m.runningTrips) &&
    count(m.completedTrips) &&
    count(m.cancelledTrips) &&
    count(m.bookedTicketsToday) &&
    count(m.totalSeatsToday) &&
    count(m.loadFactorPercent) &&
    count(m.totalShipmentsToday) &&
    count(m.unassignedShipmentsToday) &&
    count(m.estimatedRevenueToday);

  if (!metricsValid) return false;

  const a = value.urgentAlerts;
  const alertsValid =
    count(a.pendingBookingsCount) &&
    count(a.unassignedShipmentsCount) &&
    count(a.departingSoonLowOccupancyCount);

  return alertsValid;
}

export async function getTenantDashboardOverview(
  signal?: AbortSignal,
): Promise<TenantDashboardOverview> {
  const response = await adminApiFetch(
    `${getApiBaseUrl()}/api/v1/tenant-dashboard/overview`,
    { cache: 'no-store', signal },
  );

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      record(body) && typeof body.message === 'string'
        ? body.message
        : `Failed to load bus company operations overview (HTTP ${response.status}).`,
    );
  }

  if (!record(body) || !isOverviewValid(body.data)) {
    throw new Error('Invalid bus company overview data returned. Please try again.');
  }

  return body.data;
}
