// @vitest-environment jsdom
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouteFormDialog } from '@/features/routes/components/route-form-dialog';
import {
  createRoute,
  RouteApiError,
  updateRoute,
  updateRouteStatus,
} from '@/features/routes/services/route-service';
import type { Route } from '@/features/routes/types/route';
import { setEmployeeAdminTestSession } from './admin-auth-test-session';

vi.mock('@/lib/api-url', () => ({
  getApiBaseUrl: () => 'http://localhost:4000',
}));
vi.mock('@/hooks/use-business-code-preview', () => ({
  useBusinessCodePreview: () => ({
    code: 'FUTA-TX-0101',
    error: '',
    placeholder: 'Đang sinh mã…',
    retry: vi.fn(),
  }),
}));
vi.mock('@/features/locations/services/location-service', () => ({
  getLocations: vi.fn().mockResolvedValue([
    {
      id: 'current:province:79',
      name: 'Hồ Chí Minh',
      value: 'TP.HCM',
      aliases: ['TP.HCM', 'Hồ Chí Minh'],
      versions: ['current'],
      kind: 'province',
      province: null,
    },
    {
      id: 'legacy:city:672',
      name: 'Đà Lạt',
      value: 'Đà Lạt',
      aliases: ['Đà Lạt'],
      versions: ['legacy'],
      kind: 'city',
      province: 'Lâm Đồng',
    },
  ]),
}));

const route: Route = {
  routeId: 17,
  code: 'FUTA-TX-0100',
  origin: 'TP.HCM',
  destination: 'Đà Lạt',
  durationMinutes: 420,
  status: 'HOAT_DONG',
  busCompany: { busCompanyId: 3, code: 'FUTA', name: 'Phương Trang' },
  createdAt: '2026-09-22T07:34:00.000Z',
  updatedAt: '2026-09-23T07:34:00.000Z',
};

beforeEach(() =>
  setEmployeeAdminTestSession(['route:read', 'route:create', 'route:update']),
);
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Route form composition', () => {
  it('uses the real shared Sheet and includes labeled create controls', async () => {
    render(
      <RouteFormDialog
        tenantBusCompanyId={3}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );
    const dialog = await screen.findByRole('dialog', { name: 'Thêm tuyến xe' });
    const view = within(dialog);
    expect(
      view
        .getByRole('combobox', { name: /Điểm đi/ })
        .getAttribute('aria-required'),
    ).toBe('true');
    expect(
      view
        .getByRole('combobox', { name: /Điểm đến/ })
        .getAttribute('aria-required'),
    ).toBe('true');
    expect(
      view.getByRole('spinbutton', { name: /Thời gian chạy/ }),
    ).toHaveProperty('required', true);
    const code = view.getByRole('textbox', { name: /Mã tuyến/ });
    expect(code).toHaveProperty('disabled', true);
    expect(code).toHaveProperty('value', 'FUTA-TX-0101');
    expect(
      view.getByRole('combobox', { name: /Trạng thái/ }).textContent,
    ).toContain('Chọn trạng thái');
    expect(view.queryByRole('combobox', { name: /Nhà xe/ })).toBeNull();
  });

  it('keeps code, company and status as read-only context during edit', async () => {
    render(
      <RouteFormDialog onClose={vi.fn()} onSaved={vi.fn()} route={route} />,
    );
    const dialog = await screen.findByRole('dialog', {
      name: 'Chỉnh sửa tuyến xe',
    });
    const view = within(dialog);
    expect(view.getByText('FUTA-TX-0100')).toBeTruthy();
    expect(view.getByText(/Phương Trang/)).toBeTruthy();
    expect(view.getByText(/Đang hoạt động/)).toBeTruthy();
    await waitFor(() =>
      expect(view.getByRole('combobox', { name: /Điểm đi/ })).toHaveProperty(
        'value',
        'Hồ Chí Minh',
      ),
    );
    expect(view.getByRole('combobox', { name: /Điểm đến/ })).toHaveProperty(
      'value',
      route.destination,
    );
    expect(
      view.getByRole('spinbutton', { name: /Thời gian chạy/ }),
    ).toHaveProperty('value', String(route.durationMinutes));
    expect(view.queryByRole('textbox', { name: /Mã tuyến/ })).toBeNull();
    expect(
      view.queryByRole('combobox', { name: /Nhà xe|Trạng thái/ }),
    ).toBeNull();
    expect(dialog.querySelector('input[name="code"]')).toBeNull();
  });

  it('does not require a company selector to submit a tenant route', async () => {
    render(
      <RouteFormDialog
        tenantBusCompanyId={3}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );
    const dialog = await screen.findByRole('dialog', { name: 'Thêm tuyến xe' });
    expect(
      within(dialog).queryByRole('combobox', { name: /Nhà xe/ }),
    ).toBeNull();
    expect(
      within(dialog).getByRole('button', { name: 'Tạo tuyến' }),
    ).toHaveProperty('disabled', false);
  });

  it('blocks submission and shows error when origin and destination are identical', async () => {
    const { fireEvent } = await import('@testing-library/react');
    const onSaved = vi.fn();
    render(
      <RouteFormDialog
        onClose={vi.fn()}
        onSaved={onSaved}
        route={{
          ...route,
          origin: 'Hồ Chí Minh',
          destination: 'Hồ Chí Minh',
        }}
      />,
    );
    const dialog = await screen.findByRole('dialog', {
      name: 'Chỉnh sửa tuyến xe',
    });
    const view = within(dialog);

    const submitBtn = view.getByRole('button', { name: 'Lưu thay đổi' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(view.getByText('Điểm đến không được trùng với điểm đi.')).toBeTruthy();
    });
    expect(onSaved).not.toHaveBeenCalled();
  });
});

describe('Route write service', () => {
  it('PATCHes explicit target status through the status endpoint', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(
          JSON.stringify({ data: { ...route, status: 'TAM_NGUNG' } }),
          { status: 200 },
        ),
      );
    const result = await updateRouteStatus(17, { status: 'TAM_NGUNG' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(new URL(url as string).pathname).toBe('/api/v1/routes/17/status');
    expect(init?.method).toBe('PATCH');
    expect(JSON.parse(init?.body as string)).toEqual({ status: 'TAM_NGUNG' });
    expect(result.status).toBe('TAM_NGUNG');
  });
  it('sends explicit create payload and returns the API route', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ data: route }), { status: 201 }),
      );
    await expect(
      createRoute({
        origin: route.origin,
        destination: route.destination,
        durationMinutes: 420,
        busCompanyId: 3,
        status: 'HOAT_DONG',
      }),
    ).resolves.toEqual(route);
    const [url, init] = fetchMock.mock.calls[0];
    expect(new URL(url as string).pathname).toBe('/api/v1/routes');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual({
      origin: route.origin,
      destination: route.destination,
      durationMinutes: 420,
      busCompanyId: 3,
      status: 'HOAT_DONG',
    });
  });

  it('maps scoped duplicate and validation details into RouteApiError', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          statusCode: 409,
          error: 'ROUTE_CODE_EXISTS',
          message: 'Mã tuyến đã tồn tại trong nhà xe này.',
        }),
        { status: 409 },
      ),
    );
    const error = await createRoute({
      origin: route.origin,
      destination: route.destination,
      durationMinutes: 420,
      busCompanyId: 3,
      status: 'HOAT_DONG',
    }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(RouteApiError);
    expect((error as RouteApiError).code).toBe('ROUTE_CODE_EXISTS');
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: 'Dữ liệu không hợp lệ.',
          details: [{ field: 'origin', message: 'Điểm đi không hợp lệ.' }],
        }),
        { status: 400 },
      ),
    );
    const validationError = await updateRoute(17, {
      origin: '',
      destination: 'B',
      durationMinutes: 60,
    }).catch((caught: unknown) => caught);
    expect((validationError as RouteApiError).details).toEqual([
      { field: 'origin', message: 'Điểm đi không hợp lệ.' },
    ]);
  });

  it('PATCHes only editable endpoints to the route ID', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ data: route }), { status: 200 }),
      );
    await updateRoute(17, {
      origin: 'A',
      destination: 'B',
      durationMinutes: 60,
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(new URL(url as string).pathname).toBe('/api/v1/routes/17');
    expect(init?.method).toBe('PATCH');
    expect(JSON.parse(init?.body as string)).toEqual({
      origin: 'A',
      destination: 'B',
      durationMinutes: 60,
    });
  });
});
