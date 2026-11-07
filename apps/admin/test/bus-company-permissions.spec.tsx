// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { AnchorHTMLAttributes } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BusCompaniesManagement } from '@/features/bus-companies/components/bus-companies-management';
import { BusCompanyWorkspace } from '@/features/bus-companies/components/bus-company-workspace';
import {
  setAdminTestSession,
} from './admin-auth-test-session';

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const state = vi.hoisted(() => ({
  loading: false,
  companyPage: null as unknown,
  getBusCompanyById: vi.fn(),
  updateBusCompanyStatus: vi.fn(),
}));

const company = {
  busCompanyId: 10,
  name: 'Phương Trang',
  code: 'FUTA',
  contactInfo: '1900 6067',
  status: 'HOAT_DONG' as const,
  createdAt: '2026-09-26T10:00:00.000Z',
  updatedAt: '2026-09-26T10:00:00.000Z',
};

vi.mock('@/features/super-admin-layout/components/super-admin-layout', () => ({
  SuperAdminLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));

vi.mock('@/features/bus-companies/hooks/use-bus-companies', () => ({
  useBusCompanies: () => ({
    companyPage: state.companyPage,
    error: null,
    loading: state.loading,
    searchInput: '',
    status: '',
    createdDateRange: null,
    sortBy: 'name',
    sortDirection: 'asc',
    changePage: vi.fn(),
    refresh: vi.fn(),
    sortCompanies: vi.fn(),
    updateSearch: vi.fn(),
    updateFilters: vi.fn(),
    updateCreatedDateRange: vi.fn(),
  }),
}));

vi.mock('@/features/bus-companies/services/bus-company-service', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/features/bus-companies/services/bus-company-service')>(),
  getBusCompanyById: state.getBusCompanyById,
  updateBusCompanyStatus: state.updateBusCompanyStatus,
}));

function setPlatformPermissions(permissions: string[]) {
  setAdminTestSession({
    status: 'authenticated',
    session: {
      accountId: 1,
      fullName: 'Super Admin',
      phoneNumber: '+84900000001',
      email: 'admin@vexgo.test',
      roles: ['SUPER_ADMIN'],
      permissions,
      employee: null,
      busCompanyId: null,
    },
  });
}

beforeEach(() => {
  state.loading = false;
  state.companyPage = {
    data: [company],
    meta: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
  };
  state.getBusCompanyById.mockResolvedValue(company);
  state.updateBusCompanyStatus.mockResolvedValue(company);
});

afterEach(() => cleanup());

describe('platform bus-company UI permissions', () => {
  it('keeps read access while hiding create, edit, and status actions without write permissions', async () => {
    setPlatformPermissions(['bus-company:read']);
    render(<BusCompaniesManagement />);

    expect(screen.getByRole('heading', { name: 'Quản lý nhà xe' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Thêm nhà xe' })).toBeNull();
    const link = screen.getAllByRole('button', { name: /Xem chi tiết/ })[0]!;
    expect(link.getAttribute('href') || link.closest('a')?.getAttribute('href')).toBe('/bus-companies/10');

    cleanup();
    render(<BusCompanyWorkspace companyId={10} />);
    expect(await screen.findByRole('heading', { name: 'Phương Trang' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Chỉnh sửa' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Tạm ngưng nhà xe' })).toBeNull();
  });

  it('shows create and update actions only for their matching platform permissions', async () => {
    setPlatformPermissions([
      'bus-company:read',
      'bus-company:create',
      'bus-company:update',
    ]);
    render(<BusCompaniesManagement />);
    expect(screen.getByRole('button', { name: 'Thêm nhà xe' })).toBeTruthy();

    cleanup();
    setPlatformPermissions([
      'bus-company:read',
      'bus-company:update',
    ]);
    render(<BusCompanyWorkspace companyId={10} />);
    expect(await screen.findByRole('button', { name: 'Chỉnh sửa' })).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'Tạm ngưng nhà xe' })).toBeTruthy();
  });

  it('closes status confirmation when update permission is revoked', async () => {
    setPlatformPermissions(['bus-company:read', 'bus-company:update']);
    const view = render(<BusCompanyWorkspace companyId={10} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Tạm ngưng nhà xe' }));
    expect(await screen.findByRole('heading', { name: 'Tạm ngưng nhà xe này?' })).toBeTruthy();

    setPlatformPermissions(['bus-company:read']);
    view.rerender(<BusCompanyWorkspace companyId={10} />);

    expect(screen.queryByRole('heading', { name: 'Tạm ngưng nhà xe này?' })).toBeNull();
    expect(state.updateBusCompanyStatus).not.toHaveBeenCalled();
  });
});
