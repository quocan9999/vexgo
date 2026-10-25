import { adminApiFetch } from '@/lib/admin-api-client';
import { getApiBaseUrl } from '@/lib/api-url';
import type {
  DashboardOverview,
  PlatformCompanySummary,
} from '../types/dashboard';

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function count(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function company(value: unknown): value is PlatformCompanySummary {
  return (
    record(value) &&
    count(value.id) &&
    value.id > 0 &&
    typeof value.code === 'string' &&
    typeof value.name === 'string' &&
    typeof value.status === 'string' &&
    typeof value.createdAt === 'string' &&
    Number.isFinite(Date.parse(value.createdAt)) &&
    count(value.activeAdministratorCount)
  );
}

function overview(value: unknown): value is DashboardOverview {
  if (
    !record(value) ||
    typeof value.generatedAt !== 'string' ||
    !Number.isFinite(Date.parse(value.generatedAt)) ||
    typeof value.timeZone !== 'string' ||
    !record(value.companies) ||
    !record(value.administrators)
  )
    return false;
  try {
    new Intl.DateTimeFormat('vi-VN', { timeZone: value.timeZone });
  } catch {
    return false;
  }
  const companies = value.companies;
  return (
    ['total', 'active', 'suspended', 'other', 'needingAdministrator'].every(
      (key) => count(companies[key]),
    ) &&
    count(value.administrators.total) &&
    count(value.administrators.active) &&
    Array.isArray(value.onboarding) &&
    value.onboarding.length === 6 &&
    value.onboarding.every(
      (item: unknown) =>
        record(item) &&
        typeof item.label === 'string' &&
        /^(0[1-9]|1[0-2])-\d{4}$/.test(item.label) &&
        count(item.count) &&
        typeof item.currentMonth === 'boolean',
    ) &&
    Array.isArray(value.attentionCompanies) &&
    value.attentionCompanies.every(company) &&
    Array.isArray(value.recentCompanies) &&
    value.recentCompanies.every(company)
  );
}

export async function getDashboardOverview(
  signal?: AbortSignal,
): Promise<DashboardOverview> {
  const response = await adminApiFetch(
    `${getApiBaseUrl()}/api/v1/super-admin/dashboard/overview`,
    { cache: 'no-store', signal },
  );
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      record(body) && typeof body.message === 'string'
        ? body.message
        : `Không thể tải tổng quan (HTTP ${response.status}).`,
    );
  }
  if (!record(body) || !overview(body.data)) {
    throw new Error('Dữ liệu tổng quan trả về không hợp lệ. Vui lòng thử lại.');
  }
  return body.data;
}
