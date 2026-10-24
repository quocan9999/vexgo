// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ResourceSheet } from '@/components/admin/resource-ui';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/action-button';
import { VehicleTypeFormDialog } from '@/features/vehicle-types/components/vehicle-type-form-dialog';
import { VehicleTypesManagement } from '@/features/vehicle-types/components/vehicle-types-management';
import { VehiclesManagement } from '@/features/vehicles/components/vehicles-management';
import { VehicleSeatsManagement } from '@/features/vehicles/components/vehicle-seats-management';
import { setEmployeeAdminTestSession } from './admin-auth-test-session';

const state = vi.hoisted(() => ({
  sortVehicleTypes: vi.fn(),
  vehicle: {
    vehicleId: 12,
    licensePlate: '30F-123.45',
    status: 'HOAT_DONG',
    busCompany: { busCompanyId: 10, name: 'Phương Trang', code: 'FUTA' },
    vehicleType: { vehicleTypeId: 7, name: 'Limousine', description: null },
    createdAt: '2026-09-25T10:00:00.000Z',
    updatedAt: '2026-09-26T10:00:00.000Z',
  },
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('next/link', () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));
vi.mock('@/features/super-admin-layout/components/super-admin-layout', () => ({
  SuperAdminLayout: ({ children }: { children: React.ReactNode }) => (
    <main>{children}</main>
  ),
}));
vi.mock('@/features/vehicles/hooks/use-vehicles', () => ({
  useVehicles: () => ({
    vehiclePage: {
      data: [state.vehicle],
      meta: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
    },
    error: null,
    loading: false,
    page: 1,
    searchInput: '',
    filters: { vehicleTypeId: '', status: '' },
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
vi.mock(
  '@/features/vehicles/services/vehicle-service',
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import('@/features/vehicles/services/vehicle-service')
    >()),
    getVehicleById: vi.fn(async () => state.vehicle),
    getVehicleSeats: vi.fn(async () => []),
  }),
);
vi.mock('@/features/vehicle-types/hooks/use-vehicle-types', () => ({
  useVehicleTypes: () => ({
    vehicleTypePage: {
      data: [
        {
          vehicleTypeId: 7,
          name: 'Limousine',
          description: 'Xe limousine',
          motorbikeCapacityDefault: 0,
          bulkyCargoCapacityDefault: 0,
          lightCargoCapacityDefault: 0,
          createdAt: '2026-09-25T10:00:00.000Z',
          updatedAt: '2026-09-26T10:00:00.000Z',
        },
      ],
      meta: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
    },
    error: null,
    loading: false,
    page: 1,
    searchInput: '',
    sortBy: 'updatedAt',
    sortDirection: 'asc',
    changePage: vi.fn(),
    refresh: vi.fn(),
    retry: vi.fn(),
    sortVehicleTypes: state.sortVehicleTypes,
    updateSearch: vi.fn(),
  }),
}));

beforeEach(() => {
  state.sortVehicleTypes.mockClear();
  setEmployeeAdminTestSession([
    'vehicle-type:read',
    'vehicle-type:create',
    'vehicle:read',
    'seat:read',
  ]);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Feature 02 Admin UI regressions', () => {
  it('closes the real canonical vehicle type Sheet with its named shared button', async () => {
    const onClose = vi.fn();
    render(<VehicleTypeFormDialog onClose={onClose} onSaved={vi.fn()} />);
    const dialog = await screen.findByRole('dialog', { name: 'Thêm loại xe' });
    const close = within(dialog).getByRole('button', { name: 'Đóng' });
    expect(close.getAttribute('data-slot')).toBe('sheet-close');
    fireEvent.click(close);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('announces updatedAt sort direction and sends the matching sort key', () => {
    render(<VehicleTypesManagement />);
    const table = screen.getByRole('table');
    const header = within(table).getByRole('columnheader', {
      name: /Cập nhật/,
    });
    expect(header.getAttribute('aria-sort')).toBe('ascending');
    fireEvent.click(
      within(header).getByRole('button', { name: 'Sắp xếp theo Cập nhật' }),
    );
    expect(state.sortVehicleTypes).toHaveBeenCalledWith('updatedAt');
  });

  it('renders a single main landmark on the seat configuration route', async () => {
    render(<VehicleSeatsManagement vehicleId={12} />);
    expect(screen.getAllByRole('main')).toHaveLength(1);
    await screen.findAllByText('30F-123.45');
    expect(screen.getAllByRole('main')).toHaveLength(1);
  });

  it('uses canonical heading typography and a mono identifier in real vehicle details', async () => {
    render(<VehiclesManagement />);
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Xem chi tiết xe 30F-123.45' })[0],
    );
    const dialog = await screen.findByRole('dialog');
    const heading = await within(dialog).findByRole('heading', {
      name: '30F-123.45',
    });
    expect(heading.classList.contains('text-xl')).toBe(true);
    expect(heading.classList.contains('font-semibold')).toBe(true);
    expect(heading.classList.contains('admin-data-mono')).toBe(true);
  });

  it('wraps focus at both real modal Sheet boundaries', async () => {
    // JSDOM does not perform native Tab navigation. Advance to the boundary guard
    // after dispatching Tab; the real Base UI engine must choose the destination.
    vi.spyOn(HTMLElement.prototype, 'getClientRects').mockImplementation(
      function () {
        return [new DOMRect(0, 0, 100, 30)] as unknown as DOMRectList;
      },
    );
    render(
      <ResourceSheet
        title="Focus boundary"
        description="Kiểm tra điều hướng focus trong sheet."
        onClose={vi.fn()}
      >
        <label htmlFor="focus-first">Trường đầu</label>
        <Input id="focus-first" />
        <Button>Thao tác cuối nội dung</Button>
      </ResourceSheet>,
    );
    const dialog = await screen.findByRole('dialog', {
      name: 'Focus boundary',
    });
    const first = within(dialog).getByRole('textbox', { name: 'Trường đầu' });
    const last = within(dialog).getByRole('button', { name: 'Đóng' });
    const guards = document.querySelectorAll<HTMLElement>(
      '[data-base-ui-focus-guard][data-type="inside"]',
    );
    expect(guards).toHaveLength(2);
    act(() => last.focus());
    fireEvent.keyDown(last, { key: 'Tab' });
    act(() => guards[1].focus());
    await waitFor(() => expect(document.activeElement).toBe(first));
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    act(() => guards[0].focus());
    await waitFor(() => expect(document.activeElement).toBe(last));
  });
});
