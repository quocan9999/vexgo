// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import type { AnchorHTMLAttributes } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { VehicleTypesManagement } from '@/features/vehicle-types/components/vehicle-types-management';
import { VehicleTypeWorkspace } from '@/features/vehicle-types/components/vehicle-type-workspace';
import { setEmployeeAdminTestSession } from './admin-auth-test-session';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

const vehicleType = {
  vehicleTypeId: 7,
  name: 'Limousine',
  description: 'Xe limousine',
  motorbikeCapacityDefault: 2,
  bulkyCargoCapacityDefault: 4,
  lightCargoCapacityDefault: 7,
  createdAt: '2026-09-25T10:00:00.000Z',
  updatedAt: '2026-09-26T10:00:00.000Z',
};

vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('lucide-react')>();
  const Icon = () => null;
  return {
    ...actual,
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
  SuperAdminLayout: ({ children }: { children: React.ReactNode }) => (
    <main>{children}</main>
  ),
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

vi.mock(
  '@/features/vehicle-types/services/vehicle-type-service',
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import('@/features/vehicle-types/services/vehicle-type-service')
    >()),
    getVehicleTypeById: vi.fn(async () => vehicleType),
  }),
);

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
    const detailButtons = screen.getAllByRole('button', {
      name: 'Xem chi tiết loại xe Limousine',
    });
    expect(detailButtons[0]?.getAttribute('href')).toBe('/vehicle-types/7');

    setEmployeeAdminTestSession(['vehicle-type:read', 'vehicle-type:create']);
    rerender(<VehicleTypesManagement />);
    fireEvent.click(screen.getByRole('button', { name: 'Thêm loại xe' }));
    expect(
      await screen.findByRole('dialog', { name: 'Thêm loại xe' }),
    ).toBeTruthy();

    // Verify detail page in read-only mode
    cleanup();
    setEmployeeAdminTestSession(['vehicle-type:read']);
    render(<VehicleTypeWorkspace vehicleTypeId={7} />);
    await screen.findByRole('heading', { name: 'Limousine' });
    expect(screen.queryByRole('button', { name: 'Chỉnh sửa' })).toBeNull();
  });

  it('unmounts an open edit form when vehicle-type:update is revoked', async () => {
    setEmployeeAdminTestSession(['vehicle-type:read', 'vehicle-type:update']);
    const { rerender } = render(<VehicleTypeWorkspace vehicleTypeId={7} />);

    await screen.findByText('Limousine');
    fireEvent.click(await screen.findByRole('button', { name: 'Chỉnh sửa' }));
    expect(
      await screen.findByRole('dialog', { name: 'Chỉnh sửa loại xe' }),
    ).toBeTruthy();

    setEmployeeAdminTestSession(['vehicle-type:read']);
    rerender(<VehicleTypeWorkspace vehicleTypeId={7} />);
    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: 'Chỉnh sửa loại xe' }),
      ).toBeNull();
      expect(screen.queryByRole('button', { name: 'Chỉnh sửa' })).toBeNull();
    });
  });
});
