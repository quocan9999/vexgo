// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { VehicleTypesManagement } from '@/features/vehicle-types/components/vehicle-types-management';
import { setEmployeeAdminTestSession } from './admin-auth-test-session';

const vehicleType = {
  vehicleTypeId: 7,
  name: 'Limousine',
  description: 'Xe limousine',
  createdAt: '2026-09-25T10:00:00.000Z',
  updatedAt: '2026-09-26T10:00:00.000Z',
};

vi.mock('lucide-react', () => {
  const Icon = () => null;
  return {
    ArrowDown: Icon,
    ArrowUp: Icon,
    ArrowUpDown: Icon,
    CheckCircle2: Icon,
    ChevronLeft: Icon,
    ChevronRight: Icon,
    Eye: Icon,
    LoaderCircle: Icon,
    Pencil: Icon,
    Plus: Icon,
    RefreshCw: Icon,
    Search: Icon,
    X: Icon,
  };
});

vi.mock('@/features/super-admin-layout/components/super-admin-layout', () => ({
  SuperAdminLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));

vi.mock('@/features/vehicle-types/hooks/use-vehicle-types', () => ({
  useVehicleTypes: () => ({
    vehicleTypePage: {
      data: [vehicleType],
      meta: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
    },
    error: null,
    loading: false,
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

vi.mock('@/features/vehicle-types/services/vehicle-type-service', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/features/vehicle-types/services/vehicle-type-service')>(),
  getVehicleTypeById: vi.fn(async () => vehicleType),
}));

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

describe('Vehicle Type action permissions', () => {
  it('shows create only with vehicle-type:create and keeps read-only detail available', async () => {
    setEmployeeAdminTestSession(['vehicle-type:read']);
    const { rerender } = render(<VehicleTypesManagement />);

    expect(screen.queryByRole('button', { name: 'Thêm loại xe' })).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: 'Xem chi tiết loại xe Limousine' })[0]!);
    const detail = await screen.findByRole('dialog', { name: 'Chi tiết loại xe' });
    expect(within(detail).queryByRole('button', { name: 'Chỉnh sửa' })).toBeNull();

    setEmployeeAdminTestSession(['vehicle-type:read', 'vehicle-type:create']);
    rerender(<VehicleTypesManagement />);
    fireEvent.click(screen.getByRole('button', { name: 'Thêm loại xe' }));
    expect(await screen.findByRole('dialog', { name: 'Thêm loại xe' })).toBeTruthy();
  });

  it('unmounts an open edit form when vehicle-type:update is revoked', async () => {
    setEmployeeAdminTestSession(['vehicle-type:read', 'vehicle-type:update']);
    const { rerender } = render(<VehicleTypesManagement />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Xem chi tiết loại xe Limousine' })[0]!);
    const detail = await screen.findByRole('dialog', { name: 'Chi tiết loại xe' });
    fireEvent.click(await within(detail).findByRole('button', { name: 'Chỉnh sửa' }));
    expect(await screen.findByRole('dialog', { name: 'Chỉnh sửa loại xe' })).toBeTruthy();

    setEmployeeAdminTestSession(['vehicle-type:read']);
    rerender(<VehicleTypesManagement />);
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Chỉnh sửa loại xe' })).toBeNull();
      expect(within(screen.getByRole('dialog', { name: 'Chi tiết loại xe' }))
        .queryByRole('button', { name: 'Chỉnh sửa' })).toBeNull();
    });
  });
});
