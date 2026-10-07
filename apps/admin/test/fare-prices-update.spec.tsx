// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { AnchorHTMLAttributes } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { FarePricesManagement } from '@/features/fare-prices/components/fare-prices-management';
import { setEmployeeAdminTestSession } from './admin-auth-test-session';

vi.mock('next/navigation', () => ({
  usePathname: () => '/fare-prices',
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

const initialFare = {
  farePriceId: 15,
  listedPrice: 250000,
  currency: 'VND',
  validFrom: '2099-09-01',
  validTo: null,
  status: 'HOAT_DONG',
  effectiveState: 'CHUA_HIEU_LUC',
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

const routePage = {
  data: [{
    routeId: 3,
    code: 'SG-DL-01',
    origin: 'TP.HCM',
    destination: 'Đà Lạt',
    status: 'HOAT_DONG',
    busCompany: { busCompanyId: 1, code: 'FUTA', name: 'Phương Trang' },
    createdAt: '2026-09-01T08:30:00.000Z',
    updatedAt: '2026-09-02T08:30:00.000Z',
  }],
  meta: { page: 1, pageSize: 100, totalItems: 1, totalPages: 1 },
};

const vehicleTypePage = {
  data: [{
    vehicleTypeId: 2,
    name: 'Limousine',
    description: null,
    motorbikeCapacityDefault: 0,
    bulkyCargoCapacityDefault: 0,
    lightCargoCapacityDefault: 0,
    createdAt: '2026-09-01T08:30:00.000Z',
    updatedAt: '2026-09-02T08:30:00.000Z',
  }],
  meta: { page: 1, pageSize: 100, totalItems: 1, totalPages: 1 },
};

function response(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as Response;
}

type ApiOptions = {
  patchHandler?: (body: Record<string, unknown>) => Promise<Response>;
};

function installApi(options: ApiOptions = {}) {
  setEmployeeAdminTestSession([
    'fare-price:read',
    'fare-price:update',
    'route:read',
    'vehicle-type:read',
  ]);
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:4000');
  let currentFare: Record<string, unknown> = { ...initialFare };
  const requests: Array<{ path: string; method: string; body?: Record<string, unknown> }> = [];
  let listRequests = 0;

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? 'GET';
    const requestBody = typeof init?.body === 'string'
      ? JSON.parse(init.body) as Record<string, unknown>
      : undefined;
    requests.push({ path: url.pathname, method, body: requestBody });

    if (url.pathname === '/api/v1/fare-prices/15' && method === 'GET') {
      return response({ data: currentFare });
    }
    if (url.pathname === '/api/v1/fare-prices/15' && method === 'PATCH') {
      if (options.patchHandler) return options.patchHandler(requestBody ?? {});
      currentFare = {
        ...currentFare,
        ...requestBody,
        effectiveState: 'CHUA_HIEU_LUC',
        updatedAt: '2026-09-03T08:30:00.000Z',
      };
      return response({ data: currentFare });
    }
    if (url.pathname === '/api/v1/fare-prices' && method === 'GET') {
      listRequests += 1;
      return response({
        data: [currentFare],
        meta: {
          page: Number(url.searchParams.get('page') ?? 1),
          pageSize: Number(url.searchParams.get('pageSize') ?? 10),
          totalItems: 1,
          totalPages: 1,
        },
      });
    }
    if (url.pathname === '/api/v1/routes') return response(routePage);
    if (url.pathname === '/api/v1/vehicle-types') return response(vehicleTypePage);
    throw new Error(`Unexpected API request: ${method} ${url.pathname}`);
  });

  vi.stubGlobal('fetch', fetchMock);
  return {
    requests,
    fetchMock,
    getListRequests: () => listRequests,
  };
}

async function openEditDialog() {
  fireEvent.click((await screen.findAllByRole('button', { name: 'Xem chi tiết SG-DL-01' }))[0]!);
  const detail = await screen.findByRole('dialog', { name: 'Chi tiết bảng giá' });
  fireEvent.click(await within(detail).findByRole('button', { name: 'Chỉnh sửa' }));
  const edit = await screen.findByRole('dialog', { name: 'Chỉnh sửa bảng giá' });
  return { detail, edit };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

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

describe('Fare Price edit dialog behavior', () => {
  it('opens from detail with current values and immutable route/type/status context', async () => {
    installApi();
    render(<FarePricesManagement />);
    const { edit } = await openEditDialog();

    expect(within(edit).getByLabelText('Giá niêm yết (VND) *')).toHaveProperty('value', '250000');
    expect(within(edit).getByLabelText('Hiệu lực từ *')).toHaveProperty('value', '2099-09-01');
    expect(within(edit).getByLabelText('Hiệu lực đến')).toHaveProperty('value', '');
    expect(within(edit).getByText(/SG-DL-01/)).toBeTruthy();
    expect(within(edit).getByText(/TP\.HCM → Đà Lạt/)).toBeTruthy();
    expect(within(edit).getByText('Loại xe: Limousine')).toBeTruthy();
    expect(within(edit).getByText('Trạng thái: Hoạt động')).toBeTruthy();
    expect(within(edit).queryByLabelText(/Tuyến xe/)).toBeNull();
    expect(within(edit).queryByLabelText(/Loại xe/)).toBeNull();
    expect(within(edit).queryByLabelText(/Trạng thái/)).toBeNull();
  });

  it('patches only editable fields, refreshes the list, and updates the still-open detail sheet', async () => {
    let resolvePatch: ((value: Response) => void) | undefined;
    const api = installApi({
      patchHandler: () => new Promise((resolve) => {
        resolvePatch = resolve;
      }),
    });
    render(<FarePricesManagement />);
    const { detail, edit } = await openEditDialog();

    fireEvent.change(within(edit).getByLabelText('Giá niêm yết (VND) *'), {
      target: { value: '280000' },
    });
    const submit = within(edit).getByRole('button', { name: 'Lưu thay đổi' });
    fireEvent.click(submit);
    fireEvent.click(submit);

    await waitFor(() => expect(submit).toHaveProperty('disabled', true));
    const patchRequests = api.requests.filter((item) => item.path === '/api/v1/fare-prices/15' && item.method === 'PATCH');
    expect(patchRequests).toHaveLength(1);
    const patchRequest = api.requests.find((item) => item.method === 'PATCH');
    expect(patchRequest?.body).toEqual({
      listedPrice: 280000,
      validFrom: '2099-09-01',
      validTo: null,
    });
    resolvePatch?.(response({
      data: {
        ...initialFare,
        listedPrice: 280000,
        updatedAt: '2026-09-03T08:30:00.000Z',
      },
    }));
    await waitFor(() => expect(within(detail).getByRole('status')).toBeTruthy());
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Chỉnh sửa bảng giá' })).toBeNull());
    expect(screen.getByRole('dialog', { name: 'Chi tiết bảng giá' })).toBe(detail);
    expect(within(detail).getByText(/280\.000/)).toBeTruthy();
    await waitFor(() => expect(api.getListRequests()).toBeGreaterThan(1));
  });

  it('keeps the edit form and entered price after an overlap error', async () => {
    installApi({
      patchHandler: async () => response({
        statusCode: 409,
        error: 'FARE_PRICE_OVERLAP',
        message: 'Khoảng hiệu lực bị trùng với một bảng giá đang hoạt động.',
      }, false, 409),
    });
    render(<FarePricesManagement />);
    const { detail, edit } = await openEditDialog();

    fireEvent.change(within(edit).getByLabelText('Giá niêm yết (VND) *'), {
      target: { value: '280000' },
    });
    fireEvent.click(within(edit).getByRole('button', { name: 'Lưu thay đổi' }));

    expect((await within(edit).findByRole('alert')).textContent).toContain(
      'Khoảng hiệu lực này bị trùng với một bảng giá đang hoạt động của cùng tuyến và loại xe.',
    );
    expect(within(edit).getByLabelText('Giá niêm yết (VND) *')).toHaveProperty('value', '280000');
    expect(within(detail).getByText(/250\.000/)).toBeTruthy();
    expect(screen.getByRole('dialog', { name: 'Chi tiết bảng giá' })).toBe(detail);
  });

  it('shows a stable conflict message for exhausted transaction retries', async () => {
    installApi({
      patchHandler: async () => response({
        statusCode: 409,
        error: 'FARE_PRICE_CONCURRENT_MODIFICATION',
        message: 'Dữ liệu bảng giá vừa thay đổi đồng thời. Vui lòng thử lại.',
      }, false, 409),
    });
    render(<FarePricesManagement />);
    const { edit } = await openEditDialog();
    fireEvent.change(within(edit).getByLabelText('Giá niêm yết (VND) *'), {
      target: { value: '280000' },
    });
    fireEvent.click(within(edit).getByRole('button', { name: 'Lưu thay đổi' }));

    expect((await within(edit).findByRole('alert')).textContent).toContain(
      'Dữ liệu bảng giá vừa thay đổi đồng thời. Vui lòng tải lại và thử lại.',
    );
    expect(within(edit).getByLabelText('Giá niêm yết (VND) *')).toHaveProperty('value', '280000');
  });

  it('closes stale detail and refreshes the list when the API reports a missing fare', async () => {
    const api = installApi({
      patchHandler: async () => response({
        statusCode: 404,
        error: 'FARE_PRICE_NOT_FOUND',
        message: 'Không tìm thấy bảng giá.',
      }, false, 404),
    });
    render(<FarePricesManagement />);
    const { edit } = await openEditDialog();
    fireEvent.click(within(edit).getByRole('button', { name: 'Lưu thay đổi' }));

    expect((await screen.findByRole('alert')).textContent).toContain('Bảng giá không còn tồn tại.');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(api.getListRequests()).toBeGreaterThan(1));
  });

  it('closes only the edit dialog when canceled and sends no PATCH', async () => {
    const api = installApi();
    render(<FarePricesManagement />);
    const { detail, edit } = await openEditDialog();

    fireEvent.click(within(edit).getByRole('button', { name: 'Hủy' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Chỉnh sửa bảng giá' })).toBeNull());
    expect(screen.getByRole('dialog', { name: 'Chi tiết bảng giá' })).toBe(detail);
    expect(api.requests.some((item) => item.method === 'PATCH')).toBe(false);
  });
});
