// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

const baseFare = {
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
    createdAt: '2026-09-01T08:30:00.000Z',
    updatedAt: '2026-09-02T08:30:00.000Z',
  }],
  meta: { page: 1, pageSize: 100, totalItems: 1, totalPages: 1 },
};

function response(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as Response;
}

type ApiOptions = {
  initialStatus?: 'HOAT_DONG' | 'TAM_NGUNG';
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
  let currentFare = {
    ...baseFare,
    status: options.initialStatus ?? baseFare.status,
    effectiveState: options.initialStatus === 'TAM_NGUNG'
      ? 'TAM_NGUNG'
      : baseFare.effectiveState,
  };
  const requests: Array<{ path: string; method: string; body?: Record<string, unknown> }> = [];
  let listRequests = 0;
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? 'GET';
    const requestBody = typeof init?.body === 'string'
      ? JSON.parse(init.body) as Record<string, unknown>
      : undefined;
    requests.push({ path: url.pathname, method, body: requestBody });

    if (url.pathname === '/api/v1/fare-prices/15/status' && method === 'PATCH') {
      if (options.patchHandler) return options.patchHandler(requestBody ?? {});
      const status = requestBody?.status === 'TAM_NGUNG' ? 'TAM_NGUNG' : 'HOAT_DONG';
      currentFare = {
        ...currentFare,
        status,
        effectiveState: status === 'TAM_NGUNG' ? 'TAM_NGUNG' : 'CHUA_HIEU_LUC',
        updatedAt: '2026-09-03T08:30:00.000Z',
      };
      return response({ data: currentFare });
    }
    if (url.pathname === '/api/v1/fare-prices/15' && method === 'GET') {
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

async function openDetail() {
  fireEvent.click((await screen.findAllByRole('button', { name: 'Xem chi tiết SG-DL-01' }))[0]!);
  return screen.findByRole('dialog', { name: 'Chi tiết bảng giá' });
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

describe('Fare Price status lifecycle behavior', () => {
  it('shows the status-dependent target action in the detail sheet', async () => {
    installApi();
    render(<FarePricesManagement />);
    const activeDetail = await openDetail();
    expect(await within(activeDetail).findByRole('button', { name: 'Tạm ngưng' })).toBeTruthy();

    cleanup();
    installApi({ initialStatus: 'TAM_NGUNG' });
    render(<FarePricesManagement />);
    const suspendedDetail = await openDetail();
    expect(await within(suspendedDetail).findByRole('button', { name: 'Kích hoạt' })).toBeTruthy();
  });

  it('cancels the confirmation without sending a request', async () => {
    const api = installApi();
    render(<FarePricesManagement />);
    const detail = await openDetail();
    fireEvent.click(within(detail).getByRole('button', { name: 'Tạm ngưng' }));

    const confirm = await screen.findByRole('dialog', { name: 'Tạm ngưng bảng giá?' });
    expect(within(confirm).getByText(/không còn được dùng để xác định giá áp dụng/i)).toBeTruthy();
    fireEvent.click(within(confirm).getByRole('button', { name: 'Hủy' }));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Tạm ngưng bảng giá?' })).toBeNull());
    expect(screen.getByRole('dialog', { name: 'Chi tiết bảng giá' })).toBe(detail);
    expect(api.requests.some((item) => item.path.endsWith('/status') && item.method === 'PATCH')).toBe(false);
  });

  it('sends a single target-state request and refreshes the list/detail after success', async () => {
    let resolvePatch: ((value: Response) => void) | undefined;
    const api = installApi({
      patchHandler: () => new Promise((resolve) => {
        resolvePatch = resolve;
      }),
    });
    render(<FarePricesManagement />);
    const detail = await openDetail();
    fireEvent.click(within(detail).getByRole('button', { name: 'Tạm ngưng' }));
    const confirm = await screen.findByRole('dialog', { name: 'Tạm ngưng bảng giá?' });
    const confirmButton = within(confirm).getByRole('button', { name: 'Tạm ngưng bảng giá' });

    await act(async () => {
      confirmButton.click();
      confirmButton.click();
    });
    expect(confirm.getAttribute('aria-busy')).toBe('true');
    expect(confirmButton.hasAttribute('disabled')).toBe(true);
    const statusRequests = api.requests.filter((item) => item.path.endsWith('/status') && item.method === 'PATCH');
    expect(statusRequests).toHaveLength(1);
    expect(statusRequests[0]?.body).toEqual({ status: 'TAM_NGUNG' });

    resolvePatch?.(response({
      data: {
        ...baseFare,
        status: 'TAM_NGUNG',
        effectiveState: 'TAM_NGUNG',
        updatedAt: '2026-09-03T08:30:00.000Z',
      },
    }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Tạm ngưng bảng giá?' })).toBeNull());
    expect(screen.getByRole('dialog', { name: 'Chi tiết bảng giá' })).toBe(detail);
    expect(
      within(detail).getByText('Trạng thái cấu hình').nextElementSibling?.textContent,
    ).toBe('Tạm ngưng');
    expect(within(detail).getByRole('status')).toBeTruthy();
    await waitFor(() => expect(api.getListRequests()).toBeGreaterThan(1));
  });

  it('shows the activation-specific overlap error and leaves the detail unchanged', async () => {
    installApi({
      initialStatus: 'TAM_NGUNG',
      patchHandler: async () => response({
        statusCode: 409,
        error: 'FARE_PRICE_OVERLAP',
        message: 'Khoảng hiệu lực bị trùng với một bảng giá đang hoạt động.',
      }, false, 409),
    });
    render(<FarePricesManagement />);
    const detail = await openDetail();
    fireEvent.click(within(detail).getByRole('button', { name: 'Kích hoạt' }));
    const confirm = await screen.findByRole('dialog', { name: 'Kích hoạt bảng giá?' });
    fireEvent.click(within(confirm).getByRole('button', { name: 'Kích hoạt bảng giá' }));

    expect((await within(confirm).findByRole('alert')).textContent).toContain(
      'Không thể kích hoạt vì khoảng hiệu lực bị trùng với một bảng giá đang hoạt động của cùng tuyến và loại xe.',
    );
    expect(
      within(detail).getByText('Trạng thái cấu hình').nextElementSibling?.textContent,
    ).toBe('Tạm ngưng');
    expect(screen.getByRole('dialog', { name: 'Chi tiết bảng giá' })).toBe(detail);
  });

  it('closes stale detail and refreshes the list when status mutation returns 404', async () => {
    const api = installApi({
      patchHandler: async () => response(
        {
          statusCode: 404,
          error: 'FARE_PRICE_NOT_FOUND',
          message: 'Không tìm thấy bảng giá.',
        },
        false,
        404,
      ),
    });
    render(<FarePricesManagement />);
    const detail = await openDetail();
    fireEvent.click(within(detail).getByRole('button', { name: 'Tạm ngưng' }));
    const confirm = await screen.findByRole('dialog', { name: 'Tạm ngưng bảng giá?' });
    fireEvent.click(
      within(confirm).getByRole('button', { name: 'Tạm ngưng bảng giá' }),
    );

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(api.getListRequests()).toBeGreaterThan(1);
    });
    expect(screen.getByRole('alert').textContent).toContain(
      'Bảng giá không còn tồn tại.',
    );
  });

  it('maps concurrent modification and treats a stale same-state 200 as success', async () => {
    let api = installApi({
      initialStatus: 'TAM_NGUNG',
      patchHandler: async () => response({
        statusCode: 409,
        error: 'FARE_PRICE_CONCURRENT_MODIFICATION',
        message: 'Dữ liệu bảng giá vừa thay đổi đồng thời. Vui lòng thử lại.',
      }, false, 409),
    });
    render(<FarePricesManagement />);
    let detail = await openDetail();
    fireEvent.click(within(detail).getByRole('button', { name: 'Kích hoạt' }));
    let confirm = await screen.findByRole('dialog', { name: 'Kích hoạt bảng giá?' });
    fireEvent.click(within(confirm).getByRole('button', { name: 'Kích hoạt bảng giá' }));
    expect((await within(confirm).findByRole('alert')).textContent).toContain(
      'Dữ liệu bảng giá vừa thay đổi đồng thời. Vui lòng tải lại và thử lại.',
    );
    fireEvent.click(within(confirm).getByRole('button', { name: 'Hủy' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Kích hoạt bảng giá?' })).toBeNull());
    expect(
      within(detail).getByText('Trạng thái cấu hình').nextElementSibling?.textContent,
    ).toBe('Tạm ngưng');

    cleanup();
    api = installApi({
      initialStatus: 'TAM_NGUNG',
      patchHandler: async () => response({
        data: {
          ...baseFare,
          status: 'HOAT_DONG',
          effectiveState: 'CHUA_HIEU_LUC',
        },
      }),
    });
    render(<FarePricesManagement />);
    detail = await openDetail();
    fireEvent.click(within(detail).getByRole('button', { name: 'Kích hoạt' }));
    confirm = await screen.findByRole('dialog', { name: 'Kích hoạt bảng giá?' });
    fireEvent.click(within(confirm).getByRole('button', { name: 'Kích hoạt bảng giá' }));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Kích hoạt bảng giá?' })).toBeNull());
    expect(within(detail).getByText('Hoạt động')).toBeTruthy();
    expect(await within(detail).findByRole('status')).toBeTruthy();
    await waitFor(() => expect(api.getListRequests()).toBeGreaterThan(1));
  });
});
