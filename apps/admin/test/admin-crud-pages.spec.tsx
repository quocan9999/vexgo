import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BusCompaniesManagement } from '../src/features/bus-companies/components/bus-companies-management';
import { VehicleTypesManagement } from '../src/features/vehicle-types/components/vehicle-types-management';
import { VehiclesManagement } from '../src/features/vehicles/components/vehicles-management';

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

vi.mock('@/components/admin/admin-page-actions', () => ({
  AdminCreateAction: ({ label }: { label: string }) => (
    <button data-shared-create="true">{label}</button>
  ),
  AdminRefreshAction: () => <button data-shared-refresh="true">Làm mới</button>,
}));

vi.mock('@/components/admin/admin-detail-action', () => ({
  AdminDetailAction: ({ resourceName }: { resourceName: string }) => (
    <button data-shared-detail-action={resourceName}>Xem chi tiết</button>
  ),
}));

vi.mock('@/components/admin/admin-table-skeleton', () => ({
  AdminTableSkeleton: ({ resourceLabel }: { resourceLabel: string }) => (
    <div data-shared-skeleton={resourceLabel} role="status" />
  ),
}));

vi.mock('@/components/data-filters/data-filters', () => ({
  FilterToolbar: ({
    children,
    totalItems,
  }: {
    children: React.ReactNode;
    totalItems: number | null;
  }) => (
    <div data-result-count={totalItems === null ? 'loading' : totalItems}>
      {children}
    </div>
  ),
  SearchInput: () => null,
  SelectFilter: () => null,
  DateRangeFilter: () => null,
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
  state.loading = true;
  state.companyPage = null;
  state.vehicleTypePage = null;
  state.vehiclePage = null;
});

describe('Admin CRUD page composition', () => {
  it('uses the same page actions and skeleton on each initial list load', () => {
    const pages = [
      ['nhà xe', renderToStaticMarkup(<BusCompaniesManagement />)],
      ['loại xe', renderToStaticMarkup(<VehicleTypesManagement />)],
      ['xe', renderToStaticMarkup(<VehiclesManagement />)],
    ] as const;

    for (const [resource, markup] of pages) {
      expect(markup).toContain(`data-shared-skeleton="${resource}"`);
      expect(markup).toContain('data-result-count="loading"');
      expect(markup).toContain('data-shared-create="true"');
      expect(markup).toContain('data-shared-refresh="true"');
    }
  });

  it('passes backend totalItems and named detail actions through the shared UI', () => {
    const timestamp = '2026-09-26T10:00:00.000Z';
    state.loading = false;
    state.companyPage = {
      data: [{
        busCompanyId: 1,
        name: 'Nhà xe An Bình',
        code: 'AB',
        contactInfo: '',
        status: 'HOAT_DONG',
        createdAt: timestamp,
      }],
      meta: { page: 1, pageSize: 10, totalItems: 42, totalPages: 5 },
    };
    state.vehicleTypePage = {
      data: [{
        vehicleTypeId: 2,
        name: 'Limousine',
        description: '',
        createdAt: timestamp,
        updatedAt: timestamp,
      }],
      meta: { page: 1, pageSize: 10, totalItems: 24, totalPages: 3 },
    };
    state.vehiclePage = {
      data: [{
        vehicleId: 3,
        licensePlate: '29A-123.45',
        status: 'HOAT_DONG',
        busCompany: { name: 'Nhà xe An Bình', code: 'AB' },
        vehicleType: { name: 'Limousine' },
        createdAt: timestamp,
        updatedAt: timestamp,
      }],
      meta: { page: 1, pageSize: 10, totalItems: 12, totalPages: 2 },
    };

    const cases = [
      [renderToStaticMarkup(<BusCompaniesManagement />), 42, 'Nhà xe An Bình'],
      [renderToStaticMarkup(<VehicleTypesManagement />), 24, 'loại xe Limousine'],
      [renderToStaticMarkup(<VehiclesManagement />), 12, 'xe 29A-123.45'],
    ] as const;

    for (const [markup, totalItems, resourceName] of cases) {
      expect(markup).toContain(`data-result-count="${totalItems}"`);
      expect(markup).toContain(`data-shared-detail-action="${resourceName}"`);
      expect(markup).not.toContain('data-shared-skeleton');
    }
  });

  it('keeps populated tables visible without restoring the initial skeleton on refresh', () => {
    state.companyPage = {
      data: [],
      meta: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 },
    };
    state.vehicleTypePage = {
      data: [],
      meta: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 },
    };
    state.vehiclePage = {
      data: [],
      meta: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 },
    };

    for (const page of [
      <BusCompaniesManagement key="companies" />,
      <VehicleTypesManagement key="types" />,
      <VehiclesManagement key="vehicles" />,
    ]) {
      const markup = renderToStaticMarkup(page);
      expect(markup).not.toContain('data-shared-skeleton');
      expect(markup).toContain('data-result-count="0"');
    }
  });
});
