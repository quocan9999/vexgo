import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouteFormDialog } from '../src/features/routes/components/route-form-dialog';
import { createRoute, RouteApiError, updateRoute, updateRouteStatus } from '../src/features/routes/services/route-service';
import type { Route } from '../src/features/routes/types/route';

vi.mock('lucide-react', () => ({
  X: (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />,
  LoaderCircle: (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />,
}));
vi.mock('@/lib/api-url', () => ({ getApiBaseUrl: () => 'http://localhost:4000' }));

const route: Route = {
  routeId: 17, code: 'FUTA-TX-0100', origin: 'TP.HCM', destination: 'Đà Lạt', durationMinutes: 420,
  status: 'HOAT_DONG', busCompany: { busCompanyId: 3, code: 'FUTA', name: 'Phương Trang' },
  createdAt: '2026-09-22T07:34:00.000Z', updatedAt: '2026-09-23T07:34:00.000Z',
};
const options = { status: 'success' as const, options: [{ value: '3', label: 'Phương Trang (FUTA)' }] };

afterEach(() => vi.restoreAllMocks());

describe('Route form composition', () => {
  it('uses shared form dialog and includes explicit create fields', () => {
    const html = renderToStaticMarkup(<RouteFormDialog
      companyOptions={options} onClose={vi.fn()} onRetryOptions={vi.fn()} onSaved={vi.fn()}
    />);
    expect(html).toContain('admin-form-dialog');
    for (const label of ['Mã tuyến *', 'Điểm đi *', 'Điểm đến *', 'Thời gian chạy (phút) *', 'Nhà xe *', 'Trạng thái *']) {
      expect(html).toContain(label);
    }
    expect(html).toContain('Chọn trạng thái');
    expect(html).toContain('Phương Trang (FUTA)');
  });

  it('keeps code, company, and status as read-only context during edit', () => {
    const html = renderToStaticMarkup(<RouteFormDialog
      companyOptions={options} onClose={vi.fn()} onRetryOptions={vi.fn()} onSaved={vi.fn()} route={route}
    />);
    expect(html).toContain('admin-form-dialog');
    expect(html).toContain('FUTA-TX-0100');
    expect(html).toContain('Phương Trang');
    expect(html).toContain('Điểm đi *');
    expect(html).toContain('Điểm đến *');
    expect(html).toContain('Thời gian chạy (phút) *');
    expect(html).not.toContain('Mã tuyến *');
    expect(html).not.toContain('Nhà xe *');
    expect(html).not.toContain('Trạng thái *');
    expect(html).not.toContain('name="code"');
  });

  it('disables create submission and offers retry while company options fail', () => {
    const html = renderToStaticMarkup(<RouteFormDialog
      companyOptions={{ status: 'error', message: 'Không thể tải nhà xe.' }}
      onClose={vi.fn()} onRetryOptions={vi.fn()} onSaved={vi.fn()}
    />);
    expect(html).toContain('Không thể tải nhà xe.');
    expect(html).toContain('Thử tải lại nhà xe');
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled=""/);
  });
});

describe('Route write service', () => {
  it('PATCHes explicit target status through the status endpoint', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ data: { ...route, status: 'TAM_NGUNG' } }), { status: 200 }));
    const result = await updateRouteStatus(17, { status: 'TAM_NGUNG' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(new URL(url as string).pathname).toBe('/api/v1/routes/17/status');
    expect(init?.method).toBe('PATCH');
    expect(JSON.parse(init?.body as string)).toEqual({ status: 'TAM_NGUNG' });
    expect(result.status).toBe('TAM_NGUNG');
  });
  it('sends explicit create payload and returns the API route', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ data: route }), { status: 201 }));
    await expect(createRoute({
      code: route.code, origin: route.origin, destination: route.destination, durationMinutes: 420,
      busCompanyId: 3, status: 'HOAT_DONG',
    })).resolves.toEqual(route);
    const [url, init] = fetchMock.mock.calls[0];
    expect(new URL(url as string).pathname).toBe('/api/v1/routes');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual({
      code: route.code, origin: route.origin, destination: route.destination, durationMinutes: 420,
      busCompanyId: 3, status: 'HOAT_DONG',
    });
  });

  it('maps scoped duplicate and validation details into RouteApiError', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
      statusCode: 409, error: 'ROUTE_CODE_EXISTS', message: 'Mã tuyến đã tồn tại trong nhà xe này.',
    }), { status: 409 }));
    const error = await createRoute({
      code: route.code, origin: route.origin, destination: route.destination, durationMinutes: 420,
      busCompanyId: 3, status: 'HOAT_DONG',
    }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(RouteApiError);
    expect((error as RouteApiError).code).toBe('ROUTE_CODE_EXISTS');
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      statusCode: 400, error: 'VALIDATION_ERROR', message: 'Dữ liệu không hợp lệ.',
      details: [{ field: 'origin', message: 'Điểm đi không hợp lệ.' }],
    }), { status: 400 }));
    const validationError = await updateRoute(17, { origin: '', destination: 'B', durationMinutes: 60 }).catch((caught: unknown) => caught);
    expect((validationError as RouteApiError).details).toEqual([{ field: 'origin', message: 'Điểm đi không hợp lệ.' }]);
  });

  it('PATCHes only editable endpoints to the route ID', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ data: route }), { status: 200 }));
    await updateRoute(17, { origin: 'A', destination: 'B', durationMinutes: 60 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(new URL(url as string).pathname).toBe('/api/v1/routes/17');
    expect(init?.method).toBe('PATCH');
    expect(JSON.parse(init?.body as string)).toEqual({ origin: 'A', destination: 'B', durationMinutes: 60 });
  });
});
