// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { AnchorHTMLAttributes } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { VehiclesManagement } from '@/features/vehicles/components/vehicles-management';
import { setEmployeeAdminTestSession } from './admin-auth-test-session';

const fixture = vi.hoisted(() => ({
  vehicle: {
    vehicleId: 12,
    licensePlate: '29A-123.45',
    status: 'HOAT_DONG' as const,
    busCompany: { busCompanyId: 10, code: 'FUTA', name: 'Phương Trang' },
    vehicleType: { vehicleTypeId: 7, name: 'Limousine', description: 'Xe cao cấp' },
    createdAt: '2026-09-25T10:00:00.000Z',
    updatedAt: '2026-09-26T10:00:00.000Z',
  },
  vehiclePage: null as unknown,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock('@/features/super-admin-layout/components/super-admin-layout', () => ({
  SuperAdminLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));

vi.mock('@/features/vehicles/hooks/use-vehicles', () => ({
  useVehicles: () => ({
    vehiclePage: fixture.vehiclePage,
    error: null,
    loading: false,
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

vi.mock('@/features/vehicles/services/vehicle-service', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/features/vehicles/services/vehicle-service')>(),
  getVehicleById: vi.fn(async () => fixture.vehicle),
  updateVehicleStatus: vi.fn(),
}));

beforeEach(() => {
  fixture.vehiclePage = {
    data: [{
      vehicleId: 12,
      licensePlate: '29A-123.45',
      status: 'HOAT_DONG',
      busCompany: { busCompanyId: 10, code: 'FUTA', name: 'Phương Trang' },
      vehicleType: { vehicleTypeId: 7, name: 'Limousine' },
      createdAt: '2026-09-25T10:00:00.000Z',
      updatedAt: '2026-09-26T10:00:00.000Z',
    }],
    meta: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
  };
});

afterEach(() => cleanup());

beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.setAttribute('open', '');
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    },
  });
});

async function openVehicleDetails() {
  fireEvent.click(screen.getAllByRole('button', { name: 'Xem chi tiết xe 29A-123.45' })[0]!);
  return screen.findByRole('dialog', { name: 'Chi tiết xe' });
}

describe('Vehicle action permissions', () => {
  it('shows the create action only with vehicle:create', () => {
    setEmployeeAdminTestSession(['vehicle:read']);
    const { rerender } = render(<VehiclesManagement />);

    expect(screen.queryByRole('button', { name: 'Thêm xe' })).toBeNull();
    setEmployeeAdminTestSession(['vehicle:read', 'vehicle:create']);
    rerender(<VehiclesManagement />);
    expect(screen.getByRole('button', { name: 'Thêm xe' })).toBeTruthy();
  });

  it('shows read-only details without create, update, status, or seat-management actions', async () => {
    setEmployeeAdminTestSession(['vehicle:read']);
    render(<VehiclesManagement />);

    expect(screen.queryByRole('button', { name: 'Thêm xe' })).toBeNull();
    const detail = await openVehicleDetails();
    expect(within(detail).queryByRole('button', { name: 'Cấu hình ghế' })).toBeNull();
    expect(within(detail).queryByRole('button', { name: 'Chuyển sang bảo trì' })).toBeNull();
    expect(within(detail).queryByRole('button', { name: 'Chỉnh sửa' })).toBeNull();
  });

  it('requires vehicle:read plus seat:read for the seat-configuration link', async () => {
    setEmployeeAdminTestSession(['vehicle:read', 'seat:read']);
    render(<VehiclesManagement />);
    const detail = await openVehicleDetails();

    expect(within(detail).getByRole('button', { name: 'Cấu hình ghế' })).toBeTruthy();
    expect(within(detail).queryByRole('button', { name: 'Chỉnh sửa' })).toBeNull();
  });

  it('unmounts the status confirmation when vehicle:update is revoked', async () => {
    setEmployeeAdminTestSession(['vehicle:read', 'vehicle:update']);
    const { rerender } = render(<VehiclesManagement />);
    const detail = await openVehicleDetails();

    fireEvent.click(within(detail).getByRole('button', { name: 'Chuyển sang bảo trì' }));
    expect(await screen.findByRole('dialog', { name: 'Chuyển xe sang bảo trì?' })).toBeTruthy();

    setEmployeeAdminTestSession(['vehicle:read']);
    rerender(<VehiclesManagement />);
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Chuyển xe sang bảo trì?' })).toBeNull();
      expect(within(screen.getByRole('dialog', { name: 'Chi tiết xe' }))
        .queryByRole('button', { name: 'Chuyển sang bảo trì' })).toBeNull();
    });
  });
});
