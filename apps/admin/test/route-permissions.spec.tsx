// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { AnchorHTMLAttributes } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { RoutesManagement, RouteDetails } from '@/features/routes/components/routes-management';
import { setEmployeeAdminTestSession } from './admin-auth-test-session';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/routes',
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

const state = vi.hoisted(() => ({
  routePage: null as unknown,
  getRouteById: vi.fn(),
  updateRouteStatus: vi.fn(),
}));

const route = {
  routeId: 17,
  code: 'FUTA-TX-0100',
  origin: 'TP.HCM',
  destination: 'Đà Lạt',
  status: 'HOAT_DONG' as const,
  busCompany: { busCompanyId: 3, code: 'FUTA', name: 'Phương Trang' },
  createdAt: '2026-09-22T07:34:00.000Z',
  updatedAt: '2026-09-23T07:34:00.000Z',
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

vi.mock('@/features/routes/hooks/use-routes', () => ({
  useRoutes: () => ({
    routePage: state.routePage,
    error: null,
    loading: false,
    searchInput: '',
    status: '',
    sortBy: 'code',
    sortDirection: 'asc',
    changePage: vi.fn(),
    updateSearch: vi.fn(),
    updateStatus: vi.fn(),
    sortRoutes: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock('@/features/routes/services/route-service', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/features/routes/services/route-service')>(),
  getRouteById: state.getRouteById,
  updateRouteStatus: state.updateRouteStatus,
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
  state.routePage = {
    data: [route],
    meta: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
  };
  state.getRouteById.mockResolvedValue(route);
  state.updateRouteStatus.mockResolvedValue({ ...route, status: 'TAM_NGUNG' });
});

afterEach(() => cleanup());

function renderRouteDetails() {
  return render(<RouteDetails
    routeId={route.routeId}
    onClose={vi.fn()}
    onUpdated={vi.fn()}
  />);
}

describe('Admin route action permissions', () => {
  it('keeps route details readable without create, edit, or status actions for read-only access', async () => {
    setEmployeeAdminTestSession(['route:read']);
    render(<RoutesManagement />);

    expect(screen.queryByRole('button', { name: 'Thêm tuyến' })).toBeNull();
    const detailButtons = screen.getAllByRole('button', { name: 'Xem chi tiết tuyến FUTA-TX-0100' });
    expect(detailButtons[0]?.getAttribute('href')).toBe('/routes/17');

    cleanup();
    setEmployeeAdminTestSession(['route:read']);
    renderRouteDetails();
    await screen.findByRole('heading', { name: 'FUTA-TX-0100' });
    expect(screen.queryByRole('button', { name: 'Chỉnh sửa' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Tạm ngưng tuyến' })).toBeNull();
  });

  it('shows create only with route:create and unmounts an open create form when permission is revoked', async () => {
    setEmployeeAdminTestSession(['route:read']);
    const { rerender } = render(<RoutesManagement />);
    expect(screen.queryByRole('button', { name: 'Thêm tuyến' })).toBeNull();

    setEmployeeAdminTestSession(['route:read', 'route:create']);
    rerender(<RoutesManagement />);
    fireEvent.click(screen.getByRole('button', { name: 'Thêm tuyến' }));
    expect(await screen.findByRole('dialog', { name: 'Thêm tuyến xe' })).toBeTruthy();

    setEmployeeAdminTestSession(['route:read']);
    rerender(<RoutesManagement />);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Thêm tuyến xe' })).toBeNull());
  });

  it('shows edit only with route:update and unmounts an open edit form when permission is revoked', async () => {
    setEmployeeAdminTestSession(['route:read', 'route:update']);
    const { rerender } = renderRouteDetails();

    const editBtn = await screen.findByRole('button', { name: 'Chỉnh sửa' });
    expect(editBtn).toBeTruthy();
    fireEvent.click(editBtn);
    expect(await screen.findByRole('dialog', { name: 'Chỉnh sửa tuyến xe' })).toBeTruthy();

    setEmployeeAdminTestSession(['route:read']);
    rerender(<RouteDetails
      routeId={route.routeId}
      onClose={vi.fn()}
      onUpdated={vi.fn()}
    />);
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Chỉnh sửa tuyến xe' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Chỉnh sửa' })).toBeNull();
    });
  });

  it('unmounts status confirmation and does not call update after route:update is revoked', async () => {
    setEmployeeAdminTestSession(['route:read', 'route:update']);
    const { rerender } = renderRouteDetails();
    const pauseBtn = await screen.findByRole('button', { name: 'Tạm ngưng tuyến' });
    fireEvent.click(pauseBtn);
    expect(await screen.findByRole('alertdialog', { name: 'Tạm ngưng tuyến xe?' })).toBeTruthy();

    setEmployeeAdminTestSession(['route:read']);
    rerender(<RouteDetails
      routeId={route.routeId}
      onClose={vi.fn()}
      onUpdated={vi.fn()}
    />);
    await waitFor(() => expect(screen.queryByRole('alertdialog', { name: 'Tạm ngưng tuyến xe?' })).toBeNull());
    expect(state.updateRouteStatus).not.toHaveBeenCalled();
  });
});
