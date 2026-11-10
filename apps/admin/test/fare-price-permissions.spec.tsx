// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { AnchorHTMLAttributes } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { FarePricesManagement } from '@/features/fare-prices/components/fare-prices-management';
import { FarePriceWorkspace } from '@/features/fare-prices/components/fare-price-workspace';
import { setEmployeeAdminTestSession } from './admin-auth-test-session';

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
  farePricePage: null as unknown,
  getFarePriceById: vi.fn(),
  updateFarePriceStatus: vi.fn(),
  getFarePriceRouteOptions: vi.fn(),
  getFarePriceVehicleTypeOptions: vi.fn(),
}));

const farePrice = {
  farePriceId: 15,
  listedPrice: 250000,
  currency: 'VND',
  validFrom: '2026-09-01',
  validTo: null,
  status: 'HOAT_DONG' as const,
  effectiveState: 'DANG_HIEU_LUC' as const,
  route: {
    routeId: 3,
    code: 'SG-DL-01',
    origin: 'TP.HCM',
    destination: 'Đà Lạt',
  },
  vehicleType: { vehicleTypeId: 2, name: 'Limousine' },
  createdAt: '2026-09-01T08:30:00.000Z',
  updatedAt: '2026-09-02T08:30:00.000Z',
};

vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('lucide-react')>();
  const Icon = () => null;
  return {
    ...actual,
    ArrowDown: Icon,
    ArrowUp: Icon,
    ArrowUpDown: Icon,
    CalendarDays: Icon,
    Check: Icon,
    CheckCircle2: Icon,
    ChevronDown: Icon,
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

vi.mock('@/components/data-filters/data-filters', () => ({
  FilterToolbar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SearchInput: () => null,
  SelectFilter: () => null,
}));

vi.mock('@/features/fare-prices/hooks/use-fare-prices', () => ({
  useFarePrices: () => ({
    farePricePage: state.farePricePage,
    error: null,
    loading: false,
    searchInput: '',
    routeId: '',
    vehicleTypeId: '',
    status: '',
    effectiveState: '',
    sortBy: 'listedPrice',
    sortDirection: 'asc',
    changePage: vi.fn(),
    updateSearch: vi.fn(),
    updateRoute: vi.fn(),
    updateVehicleType: vi.fn(),
    updateStatus: vi.fn(),
    updateEffectiveState: vi.fn(),
    sortFarePrices: vi.fn(),
    resetFilters: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock('@/features/fare-prices/services/fare-price-service', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/features/fare-prices/services/fare-price-service')>(),
  getFarePriceById: state.getFarePriceById,
  updateFarePriceStatus: state.updateFarePriceStatus,
  getFarePriceRouteOptions: state.getFarePriceRouteOptions,
  getFarePriceVehicleTypeOptions: state.getFarePriceVehicleTypeOptions,
}));

beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value(this: HTMLDialogElement) { this.setAttribute('open', ''); },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    },
  });
});

beforeEach(() => {
  state.farePricePage = {
    data: [farePrice],
    meta: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
  };
  state.getFarePriceById.mockResolvedValue(farePrice);
  state.updateFarePriceStatus.mockResolvedValue({ ...farePrice, status: 'TAM_NGUNG' });
  state.getFarePriceRouteOptions.mockResolvedValue([
    { id: 3, label: 'TP.HCM → Đà Lạt (SG-DL-01)' },
  ]);
  state.getFarePriceVehicleTypeOptions.mockResolvedValue([
    { id: 2, label: 'Limousine' },
  ]);
});

afterEach(() => cleanup());

describe('Admin fare price action permissions', () => {
  it('keeps list and detail readable without create, edit, or status actions for read-only access', async () => {
    setEmployeeAdminTestSession(['fare-price:read']);
    render(<FarePricesManagement />);

    expect(screen.queryByRole('button', { name: 'Thêm bảng giá' })).toBeNull();
    const link = (await screen.findAllByRole('button', { name: 'Xem chi tiết SG-DL-01' }))[0]!;
    expect(link.getAttribute('href') || link.closest('a')?.getAttribute('href')).toBe('/fare-prices/15');

    cleanup();
    render(<FarePriceWorkspace farePriceId={15} />);
    expect(await screen.findByText('SG-DL-01')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Chỉnh sửa' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Tạm ngưng' })).toBeNull();
  });

  it('shows create only with fare-price:create and unmounts an open form when revoked', async () => {
    setEmployeeAdminTestSession(['fare-price:read']);
    const { rerender } = render(<FarePricesManagement />);
    expect(screen.queryByRole('button', { name: 'Thêm bảng giá' })).toBeNull();

    setEmployeeAdminTestSession(['fare-price:read', 'fare-price:create']);
    rerender(<FarePricesManagement />);
    fireEvent.click(screen.getByRole('button', { name: 'Thêm bảng giá' }));
    expect(await screen.findByRole('dialog', { name: 'Thêm bảng giá' })).toBeTruthy();

    setEmployeeAdminTestSession(['fare-price:read']);
    rerender(<FarePricesManagement />);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Thêm bảng giá' })).toBeNull());
  });

  it('does not treat fare-price:create as permission to edit or change status', async () => {
    setEmployeeAdminTestSession(['fare-price:read', 'fare-price:create']);
    render(<FarePriceWorkspace farePriceId={15} />);

    expect(await screen.findByText('SG-DL-01')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Chỉnh sửa' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Tạm ngưng' })).toBeNull();
  });

  it('shows edit only with fare-price:update and unmounts an open form when revoked', async () => {
    setEmployeeAdminTestSession(['fare-price:read', 'fare-price:update']);
    const { rerender } = render(<FarePriceWorkspace farePriceId={15} />);

    expect(await screen.findByText('SG-DL-01')).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: 'Chỉnh sửa' }));
    expect(await screen.findByRole('dialog', { name: 'Chỉnh sửa bảng giá' })).toBeTruthy();

    setEmployeeAdminTestSession(['fare-price:read']);
    rerender(<FarePriceWorkspace farePriceId={15} />);
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Chỉnh sửa bảng giá' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Chỉnh sửa' })).toBeNull();
    });
  });

  it('unmounts status confirmation when fare-price:update is revoked', async () => {
    setEmployeeAdminTestSession(['fare-price:read', 'fare-price:update']);
    const { rerender } = render(<FarePriceWorkspace farePriceId={15} />);

    expect(await screen.findByText('SG-DL-01')).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: 'Tạm ngưng' }));
    expect(await screen.findByRole('alertdialog', { name: /Tạm ngưng( bảng giá\?)?/i })).toBeTruthy();

    setEmployeeAdminTestSession(['fare-price:read']);
    rerender(<FarePriceWorkspace farePriceId={15} />);
    await waitFor(() => expect(screen.queryByRole('alertdialog', { name: /Tạm ngưng( bảng giá\?)?/i })).toBeNull());
    expect(state.updateFarePriceStatus).not.toHaveBeenCalled();
  });
});
