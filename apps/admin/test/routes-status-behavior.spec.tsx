// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { RouteDetails } from '../src/features/routes/components/routes-management';
import { getRouteById, updateRouteStatus } from '../src/features/routes/services/route-service';
import type { Route } from '../src/features/routes/types/route';

vi.mock('lucide-react', () => ({
  ArrowDown: () => null, ArrowUp: () => null, ArrowUpDown: () => null,
  CheckCircle2: () => null, LoaderCircle: () => null, Search: () => null, X: () => null,
}));
vi.mock('@/lib/api-url', () => ({ getApiBaseUrl: () => 'http://localhost:4000' }));
vi.mock('../src/features/routes/services/route-service', async (importOriginal) => ({
  ...await importOriginal<typeof import('../src/features/routes/services/route-service')>(),
  getRouteById: vi.fn(),
  updateRouteStatus: vi.fn(),
}));

const activeRoute: Route = {
  routeId: 17, code: 'FUTA-TX-0100', origin: 'TP.HCM', destination: 'Đà Lạt',
  status: 'HOAT_DONG', busCompany: { busCompanyId: 3, code: 'FUTA', name: 'Phương Trang' },
  createdAt: '2026-09-22T07:34:00.000Z', updatedAt: '2026-09-23T07:34:00.000Z',
};
const companyOptions = { status: 'success' as const, options: [{ value: '3', label: 'Phương Trang (FUTA)' }] };

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function renderDetails(route: Route = activeRoute) {
  vi.mocked(getRouteById).mockResolvedValue(route);
  const onUpdated = vi.fn();
  const rendered = render(<RouteDetails routeId={route.routeId} companyOptions={companyOptions}
    onClose={vi.fn()} onRetryOptions={vi.fn()} onUpdated={onUpdated} />);
  return { onUpdated, ...rendered };
}

describe('Route status interaction', () => {
  it('shows the pause action for an active route and activate action for a paused route', async () => {
    const { unmount } = renderDetails();
    expect(await screen.findByRole('button', { name: 'Tạm ngưng tuyến' })).toBeTruthy();
    unmount();
    renderDetails({ ...activeRoute, status: 'TAM_NGUNG' });
    expect(await screen.findByRole('button', { name: 'Kích hoạt tuyến' })).toBeTruthy();
  });

  it('sends the target status once on immediate double click', async () => {
    vi.mocked(updateRouteStatus).mockImplementation(() => new Promise(() => {}));
    renderDetails();
    const detail = await screen.findByRole('dialog', { name: 'Thông tin tuyến xe' });
    fireEvent.click(within(detail).getByRole('button', { name: 'Tạm ngưng tuyến' }));
    const confirm = await screen.findByRole('dialog', { name: 'Tạm ngưng tuyến xe?' });
    const confirmButton = within(confirm).getByRole('button', { name: 'Tạm ngưng tuyến' });
    await act(async () => {
      confirmButton.click();
      confirmButton.click();
    });
    expect(confirm.getAttribute('aria-busy')).toBe('true');
    expect(confirmButton.hasAttribute('disabled')).toBe(true);
    expect(updateRouteStatus).toHaveBeenCalledTimes(1);
    expect(updateRouteStatus).toHaveBeenCalledWith(17, { status: 'TAM_NGUNG' });
  });

  it('keeps confirmation open and detail unchanged after API error', async () => {
    vi.mocked(updateRouteStatus).mockRejectedValue(new Error('Máy chủ từ chối cập nhật.'));
    renderDetails();
    const detail = await screen.findByRole('dialog', { name: 'Thông tin tuyến xe' });
    fireEvent.click(within(detail).getByRole('button', { name: 'Tạm ngưng tuyến' }));
    const confirm = await screen.findByRole('dialog', { name: 'Tạm ngưng tuyến xe?' });
    fireEvent.click(within(confirm).getByRole('button', { name: 'Tạm ngưng tuyến' }));
    expect(await within(confirm).findByRole('alert')).toHaveProperty('textContent', 'Máy chủ từ chối cập nhật.');
    expect(screen.getByText('Đang hoạt động')).toBeTruthy();
    expect(screen.getByRole('dialog', { name: 'Thông tin tuyến xe' })).toBeTruthy();
  });

  it('closes confirmation, keeps detail open, applies backend status, and refreshes list after success', async () => {
    vi.mocked(updateRouteStatus).mockResolvedValue({ ...activeRoute, status: 'TAM_NGUNG' });
    const { onUpdated } = renderDetails();
    const detail = await screen.findByRole('dialog', { name: 'Thông tin tuyến xe' });
    fireEvent.click(within(detail).getByRole('button', { name: 'Tạm ngưng tuyến' }));
    const confirm = await screen.findByRole('dialog', { name: 'Tạm ngưng tuyến xe?' });
    fireEvent.click(within(confirm).getByRole('button', { name: 'Tạm ngưng tuyến' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Tạm ngưng tuyến xe?' })).toBeNull());
    expect(screen.getByRole('dialog', { name: 'Thông tin tuyến xe' })).toBeTruthy();
    expect(within(screen.getByRole('dialog', { name: 'Thông tin tuyến xe' })).getByText('Tạm ngưng')).toBeTruthy();
    expect(onUpdated).toHaveBeenCalledWith({ ...activeRoute, status: 'TAM_NGUNG' });
  });

  it('keeps status read-only in the edit form', async () => {
    renderDetails();
    const detail = await screen.findByRole('dialog', { name: 'Thông tin tuyến xe' });
    fireEvent.click(within(detail).getByRole('button', { name: 'Chỉnh sửa' }));
    const editDialog = await screen.findByRole('dialog', { name: 'Chỉnh sửa tuyến xe' });
    expect(within(editDialog).queryByLabelText(/Trạng thái/)).toBeNull();
    expect(within(editDialog).getByLabelText('Điểm đi *')).toHaveProperty('value', 'TP.HCM');
    expect(within(editDialog).getByLabelText('Điểm đến *')).toHaveProperty('value', 'Đà Lạt');
  });
});
