import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BusCompaniesManagement } from '../src/features/bus-companies/components/bus-companies-management';
import { VehicleTypesManagement } from '../src/features/vehicle-types/components/vehicle-types-management';
import { VehiclesManagement } from '../src/features/vehicles/components/vehicles-management';
import {
  setAdminTestSession,
  setEmployeeAdminTestSession,
} from './admin-auth-test-session';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/components/data-filters/data-filters', () => ({
  DateRangeFilter: () => null,
}));
vi.mock('@/components/admin/resource-ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/components/admin/resource-ui')>()),
  ResourceCreateAction: ({ label }: { label: string }) => (
    <button data-shared-create="true">{label}</button>
  ),
  ResourceRefreshAction: ({ loading }: { loading: boolean }) => (
    <button data-shared-refresh="true" aria-busy={loading}>
      Làm mới
    </button>
  ),
  ResourceDetailAction: ({ resourceName }: { resourceName: string }) => (
    <button data-shared-detail-action={resourceName}>Xem chi tiết</button>
  ),
  ResourceTableSkeleton: ({ resourceLabel }: { resourceLabel: string }) => (
    <div data-shared-skeleton={resourceLabel} role="status" />
  ),
  ResourcePagination: ({ totalItems }: { totalItems: number }) => (
    <div data-result-count={totalItems} />
  ),
}));

const state = vi.hoisted(() => ({
  loading: true,
  companyPage: null as unknown,
  vehicleTypePage: null as unknown,
  vehiclePage: null as unknown,
}));

vi.mock('@/features/super-admin-layout/components/super-admin-layout', () => ({
  SuperAdminLayout: ({ children }: { children: React.ReactNode }) => (
    <main>{children}</main>
  ),
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

vi.mock('@/features/vehicle-types/hooks/use-vehicle-types', () => ({
  useVehicleTypes: () => ({
    vehicleTypePage: state.vehicleTypePage,
    error: null,
    loading: state.loading,
    page: 1,
    searchInput: '',
    sortBy: 'name',
    sortDirection: 'asc',
    changePage: vi.fn(),
    refresh: vi.fn(),
    retry: vi.fn(),
    sortVehicleTypes: vi.fn(),
    updateSearch: vi.fn(),
  }),
}));

vi.mock('@/features/vehicles/hooks/use-vehicles', () => ({
  useVehicles: () => ({
    vehiclePage: state.vehiclePage,
    error: null,
    loading: state.loading,
    page: 1,
    searchInput: '',
    filters: { busCompanyId: '', vehicleTypeId: '', status: '' },
    sortBy: 'licensePlate',
    sortDirection: 'asc',
    changePage: vi.fn(),
    refresh: vi.fn(),
    retry: vi.fn(),
    sortVehicles: vi.fn(),
    updateFilters: vi.fn(),
    updateSearch: vi.fn(),
  }),
}));

vi.mock('@/features/vehicles/hooks/use-vehicle-filter-options', () => ({
  useVehicleFilterOptions: () => ({
    busCompanies: { status: 'success', options: [] },
    vehicleTypes: { status: 'success', options: [] },
    retry: vi.fn(),
  }),
}));

beforeEach(() => {
  setEmployeeAdminTestSession([
    'vehicle-type:read',
    'vehicle-type:create',
    'vehicle-type:update',
    'vehicle:read',
    'vehicle:create',
    'vehicle:update',
  ]);
  state.loading = true;
  state.companyPage = null;
  state.vehicleTypePage = null;
  state.vehiclePage = null;
});

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

function populatePages() {
  const timestamp = '2026-09-26T10:00:00.000Z';
  state.companyPage = {
    data: [
      {
        busCompanyId: 1,
        name: 'Nhà xe An Bình',
        code: 'AB',
        contactInfo: '',
        status: 'HOAT_DONG',
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    meta: { page: 1, pageSize: 10, totalItems: 42, totalPages: 5 },
  };
  state.vehicleTypePage = {
    data: [
      {
        vehicleTypeId: 2,
        name: 'Limousine',
        description: '',
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    meta: { page: 1, pageSize: 10, totalItems: 24, totalPages: 3 },
  };
  state.vehiclePage = {
    data: [
      {
        vehicleId: 3,
        licensePlate: '29A-123.45',
        status: 'HOAT_DONG',
        busCompany: { name: 'Nhà xe An Bình', code: 'AB' },
        vehicleType: { name: 'Limousine' },
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    meta: { page: 1, pageSize: 10, totalItems: 12, totalPages: 2 },
  };
}

describe('Admin CRUD page composition', () => {
  it('uses the same page actions and skeleton on each initial list load', () => {
    setPlatformPermissions(['bus-company:read', 'bus-company:create']);
    const busCompanyMarkup = renderToStaticMarkup(<BusCompaniesManagement />);

    setEmployeeAdminTestSession([
      'vehicle-type:read',
      'vehicle-type:create',
      'vehicle-type:update',
      'vehicle:read',
      'vehicle:create',
      'vehicle:update',
    ]);
    const pages = [
      ['nhà xe', busCompanyMarkup],
      ['loại xe', renderToStaticMarkup(<VehicleTypesManagement />)],
      ['xe', renderToStaticMarkup(<VehiclesManagement />)],
    ] as const;

    for (const [resource, markup] of pages) {
      expect(markup).toContain(`data-shared-skeleton="${resource}"`);
      expect(markup).not.toContain('data-result-count=');
      expect(markup).toContain('data-shared-create="true"');
      expect(markup).toContain('data-shared-refresh="true"');
    }
  });

  it('passes backend totalItems and named detail actions through the shared UI', () => {
    state.loading = false;
    populatePages();

    setPlatformPermissions(['bus-company:read']);
    const busCompanyMarkup = renderToStaticMarkup(<BusCompaniesManagement />);
    setEmployeeAdminTestSession([
      'vehicle-type:read',
      'vehicle-type:create',
      'vehicle-type:update',
      'vehicle:read',
      'vehicle:create',
      'vehicle:update',
    ]);
    const cases = [
      [busCompanyMarkup, 42, 'Nhà xe An Bình'],
      [
        renderToStaticMarkup(<VehicleTypesManagement />),
        24,
        'loại xe Limousine',
      ],
      [renderToStaticMarkup(<VehiclesManagement />), 12, 'xe 29A-123.45'],
    ] as const;

    for (const [markup, totalItems, resourceName] of cases) {
      expect(markup).toContain(`data-result-count="${totalItems}"`);
      expect(markup).toContain(`data-shared-detail-action="${resourceName}"`);
      expect(markup).not.toContain('data-shared-skeleton');
    }
  });

  it('keeps populated results and backend totals visible while refreshing', () => {
    populatePages();
    state.loading = true;
    setPlatformPermissions(['bus-company:read']);
    const companyMarkup = renderToStaticMarkup(<BusCompaniesManagement />);
    setEmployeeAdminTestSession(['vehicle-type:read', 'vehicle:read']);
    const cases = [
      [companyMarkup, 42],
      [renderToStaticMarkup(<VehicleTypesManagement />), 24],
      [renderToStaticMarkup(<VehiclesManagement />), 12],
    ] as const;
    for (const [markup, total] of cases) {
      expect(markup).not.toContain('data-shared-skeleton');
      expect(markup).toContain('data-result-count="' + total + '"');
      expect(markup).toContain('aria-busy="true"');
      expect(markup).toContain('data-shared-detail-action=');
    }
  });
});
