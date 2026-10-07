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
import { FarePricesManagement } from '@/features/fare-prices/components/fare-prices-management';
import { setEmployeeAdminTestSession } from './admin-auth-test-session';

vi.mock('next/navigation', () => ({
  usePathname: () => '/fare-prices',
  useRouter: () => ({ replace: vi.fn() }),
}));

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

const fare = {
  farePriceId: 28,
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
  data: [
    {
      routeId: 3,
      code: 'SG-DL-01',
      origin: 'TP.HCM',
      destination: 'Đà Lạt',
      status: 'TAM_NGUNG',
      busCompany: { busCompanyId: 1, code: 'FUTA', name: 'Phương Trang' },
      createdAt: '2026-09-01T08:30:00.000Z',
      updatedAt: '2026-09-02T08:30:00.000Z',
    },
  ],
  meta: { page: 1, pageSize: 100, totalItems: 1, totalPages: 1 },
};

const vehicleTypePage = {
  data: [
    {
      vehicleTypeId: 2,
      name: 'Limousine',
      description: null,
      motorbikeCapacityDefault: 0,
      bulkyCargoCapacityDefault: 0,
      lightCargoCapacityDefault: 0,
      createdAt: '2026-09-01T08:30:00.000Z',
      updatedAt: '2026-09-02T08:30:00.000Z',
    },
  ],
  meta: { page: 1, pageSize: 100, totalItems: 1, totalPages: 1 },
};

function response(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as Response;
}

type ApiOptions = {
  postHandler?: (body: Record<string, unknown>) => Promise<Response>;
  failRouteOptionsOnce?: boolean;
  failVehicleTypeOptionsOnce?: boolean;
};

function installApi(options: ApiOptions = {}) {
  setEmployeeAdminTestSession([
    'fare-price:read',
    'fare-price:create',
    'route:read',
    'vehicle-type:read',
  ]);
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:4000');
  const requests: Array<{
    path: string;
    method: string;
    body?: Record<string, unknown>;
  }> = [];
  let fareListRequests = 0;
  let routeOptionFailures = 0;
  let vehicleTypeOptionFailures = 0;
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      const method = init?.method ?? 'GET';
      const requestBody =
        typeof init?.body === 'string'
          ? (JSON.parse(init.body) as Record<string, unknown>)
          : undefined;
      requests.push({ path: url.pathname, method, body: requestBody });

      if (url.pathname === '/api/v1/fare-prices' && method === 'POST') {
        return (
          options.postHandler?.(requestBody ?? {}) ?? response({ data: fare })
        );
      }
      if (url.pathname === '/api/v1/fare-prices') {
        fareListRequests += 1;
        return response({
          data: [],
          meta: {
            page: Number(url.searchParams.get('page') ?? 1),
            pageSize: Number(url.searchParams.get('pageSize') ?? 10),
            totalItems: 0,
            totalPages: 0,
          },
        });
      }
      if (url.pathname === '/api/v1/routes') {
        if (options.failRouteOptionsOnce && routeOptionFailures === 0) {
          routeOptionFailures += 1;
          return response(
            {
              statusCode: 500,
              error: 'INTERNAL_SERVER_ERROR',
              message: 'Internal failure details',
            },
            false,
            500,
          );
        }
        return response(routePage);
      }
      if (url.pathname === '/api/v1/vehicle-types') {
        if (
          options.failVehicleTypeOptionsOnce &&
          vehicleTypeOptionFailures === 0
        ) {
          vehicleTypeOptionFailures += 1;
          return response(
            {
              statusCode: 500,
              error: 'INTERNAL_SERVER_ERROR',
              message: 'Internal failure details',
            },
            false,
            500,
          );
        }
        return response(vehicleTypePage);
      }

      throw new Error(`Unexpected API request: ${method} ${url.pathname}`);
    },
  );

  vi.stubGlobal('fetch', fetchMock);
  return {
    requests,
    fetchMock,
    getFareListRequests: () => fareListRequests,
  };
}

function fillValidForm(dialog: HTMLElement) {
  fireEvent.change(within(dialog).getByLabelText(/Tuyến xe/), {
    target: { value: '3' },
  });
  fireEvent.change(within(dialog).getByLabelText(/Loại xe/), {
    target: { value: '2' },
  });
  fireEvent.change(within(dialog).getByLabelText(/Giá niêm yết/), {
    target: { value: '250000' },
  });
  fireEvent.change(within(dialog).getByLabelText(/Hiệu lực từ/), {
    target: { value: '2099-09-01' },
  });
  fireEvent.change(within(dialog).getByLabelText(/Trạng thái/), {
    target: { value: 'HOAT_DONG' },
  });
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

describe('Fare Price create dialog behavior', () => {
  it('loads live route/type options and blocks submission until required fields are valid', async () => {
    const api = installApi();
    render(<FarePricesManagement />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Thêm bảng giá' }),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Thêm bảng giá' });

    expect(
      await within(dialog).findByRole('option', {
        name: 'TP.HCM → Đà Lạt',
      }),
    ).toBeTruthy();
    expect(
      await within(dialog).findByRole('option', { name: 'Limousine' }),
    ).toBeTruthy();
    expect(within(dialog).getByLabelText(/Hiệu lực đến/)).toHaveProperty(
      'value',
      '',
    );
    expect(within(dialog).getByLabelText(/Trạng thái/)).toHaveProperty(
      'value',
      '',
    );

    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Tạo bảng giá' }),
    );

    expect(
      await within(dialog).findByText('Vui lòng chọn tuyến xe.'),
    ).toBeTruthy();
    expect(
      within(dialog).getByText('Vui lòng nhập giá niêm yết.'),
    ).toBeTruthy();
    expect(
      api.requests.filter(
        (item) => item.path === '/api/v1/fare-prices' && item.method === 'POST',
      ),
    ).toHaveLength(0);
  });

  it('prevents double-submit, sends integer VND and refreshes the list after success', async () => {
    let resolvePost: ((value: Response) => void) | undefined;
    const api = installApi({
      postHandler: () =>
        new Promise((resolve) => {
          resolvePost = resolve;
        }),
    });
    render(<FarePricesManagement />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Thêm bảng giá' }),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Thêm bảng giá' });
    await within(dialog).findByRole('option', { name: 'Limousine' });
    fillValidForm(dialog);

    const submit = within(dialog).getByRole('button', { name: 'Tạo bảng giá' });
    fireEvent.click(submit);
    fireEvent.click(submit);

    await waitFor(() => expect(submit).toHaveProperty('disabled', true));
    const posts = api.requests.filter(
      (item) => item.path === '/api/v1/fare-prices' && item.method === 'POST',
    );
    expect(posts).toHaveLength(1);
    expect(posts[0]?.body).toEqual({
      routeId: 3,
      vehicleTypeId: 2,
      listedPrice: 250000,
      validFrom: '2099-09-01',
      validTo: null,
      status: 'HOAT_DONG',
    });

    resolvePost?.(response({ data: fare }));
    expect((await screen.findByRole('status')).textContent).toContain(
      'Đã tạo bảng giá',
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(api.getFareListRequests()).toBeGreaterThan(1));
  });

  it('keeps entered values and explains the overlap conflict returned by the API', async () => {
    installApi({
      postHandler: async () =>
        response(
          {
            statusCode: 409,
            error: 'FARE_PRICE_OVERLAP',
            message:
              'Khoảng hiệu lực bị trùng với một bảng giá đang hoạt động.',
          },
          false,
          409,
        ),
    });
    render(<FarePricesManagement />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Thêm bảng giá' }),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Thêm bảng giá' });
    await within(dialog).findByRole('option', { name: 'Limousine' });
    fillValidForm(dialog);
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Tạo bảng giá' }),
    );

    expect((await within(dialog).findByRole('alert')).textContent).toContain(
      'Khoảng hiệu lực này bị trùng với một bảng giá đang hoạt động của cùng tuyến và loại xe.',
    );
    expect(within(dialog).getByLabelText(/Giá niêm yết/)).toHaveProperty(
      'value',
      '250000',
    );
    expect(within(dialog).getByLabelText(/Hiệu lực từ/)).toHaveProperty(
      'value',
      '2099-09-01',
    );
  });

  it('rejects fractional price and a reversed date range before sending a request, then cancels cleanly', async () => {
    const api = installApi();
    render(<FarePricesManagement />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Thêm bảng giá' }),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Thêm bảng giá' });
    await within(dialog).findByRole('option', { name: 'Limousine' });
    fillValidForm(dialog);
    fireEvent.change(within(dialog).getByLabelText(/Giá niêm yết/), {
      target: { value: '250000.5' },
    });
    fireEvent.change(within(dialog).getByLabelText(/Hiệu lực đến/), {
      target: { value: '2099-08-31' },
    });
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Tạo bảng giá' }),
    );

    expect(
      within(dialog).getByText('Giá niêm yết phải là số nguyên VND lớn hơn 0.'),
    ).toBeTruthy();
    expect(
      within(dialog).getByText(
        'Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.',
      ),
    ).toBeTruthy();
    expect(
      api.requests.filter(
        (item) => item.path === '/api/v1/fare-prices' && item.method === 'POST',
      ),
    ).toHaveLength(0);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Hủy' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(api.requests.filter((item) => item.method === 'POST')).toHaveLength(
      0,
    );
  });

  it('offers a retry when route options fail and uses the successful retry results', async () => {
    installApi({ failRouteOptionsOnce: true });
    render(<FarePricesManagement />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Thêm bảng giá' }),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Thêm bảng giá' });
    expect((await within(dialog).findByRole('alert')).textContent).toMatch(
      /không thể tải danh sách tuyến/i,
    );
    fireEvent.click(
      within(dialog).getByRole('button', { name: /thử lại tuyến xe/i }),
    );
    expect(
      await within(dialog).findByRole('option', {
        name: 'TP.HCM → Đà Lạt',
      }),
    ).toBeTruthy();
  });

  it('offers a retry when vehicle type options fail', async () => {
    installApi({ failVehicleTypeOptionsOnce: true });
    render(<FarePricesManagement />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Thêm bảng giá' }),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Thêm bảng giá' });
    expect((await within(dialog).findByRole('alert')).textContent).toMatch(
      /không thể tải danh sách loại xe/i,
    );
    fireEvent.click(
      within(dialog).getByRole('button', { name: /thử lại loại xe/i }),
    );
    expect(
      await within(dialog).findByRole('option', { name: 'Limousine' }),
    ).toBeTruthy();
  });

  it.each([
    [
      'route',
      'ROUTE_NOT_FOUND',
      'Tuyến xe không còn tồn tại. Vui lòng chọn lại.',
      '/api/v1/routes',
    ],
    [
      'vehicle type',
      'VEHICLE_TYPE_NOT_FOUND',
      'Loại xe không còn tồn tại. Vui lòng chọn lại.',
      '/api/v1/vehicle-types',
    ],
  ])(
    'retains form values and reloads options when the selected %s is stale',
    async (_name, code, message, optionsPath) => {
      const api = installApi({
        postHandler: async () =>
          response(
            {
              statusCode: 404,
              error: code,
              message: 'Không tìm thấy dữ liệu tham chiếu.',
            },
            false,
            404,
          ),
      });
      render(<FarePricesManagement />);

      fireEvent.click(
        await screen.findByRole('button', { name: 'Thêm bảng giá' }),
      );
      const dialog = await screen.findByRole('dialog', {
        name: 'Thêm bảng giá',
      });
      await within(dialog).findByRole('option', { name: 'Limousine' });
      fillValidForm(dialog);
      fireEvent.click(
        within(dialog).getByRole('button', { name: 'Tạo bảng giá' }),
      );

      expect(await within(dialog).findByText(message)).toBeTruthy();
      expect(within(dialog).getByLabelText(/Giá niêm yết/)).toHaveProperty(
        'value',
        '250000',
      );
      await waitFor(() => {
        expect(
          api.requests.filter(
            (item) => item.path === optionsPath && item.method === 'GET',
          ).length,
        ).toBeGreaterThan(1);
      });
    },
  );
});
