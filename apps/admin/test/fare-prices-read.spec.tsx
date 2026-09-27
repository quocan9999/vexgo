// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { AnchorHTMLAttributes } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { FarePricesManagement } from '@/features/fare-prices/components/fare-prices-management';

vi.mock('next/navigation', () => ({
  usePathname: () => '/fare-prices',
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

const fare = {
  farePriceId: 15,
  listedPrice: 250000,
  currency: 'VND',
  validFrom: '2026-09-01',
  validTo: null,
  status: 'HOAT_DONG',
  effectiveState: 'DANG_HIEU_LUC',
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
      status: 'HOAT_DONG',
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
      createdAt: '2026-09-01T08:30:00.000Z',
      updatedAt: '2026-09-02T08:30:00.000Z',
    },
  ],
  meta: { page: 1, pageSize: 100, totalItems: 1, totalPages: 1 },
};

function response(body: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
  } as Response;
}

function installApi(options: { failFirstFareList?: boolean; emptyFareList?: boolean } = {}) {
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:4000');
  const requests: string[] = [];
  let fareListRequests = 0;
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    requests.push(`${url.pathname}${url.search}`);

    if (url.pathname === '/api/v1/fare-prices/15') {
      return response({ data: fare });
    }
    if (url.pathname === '/api/v1/fare-prices') {
      fareListRequests += 1;
      if (options.failFirstFareList && fareListRequests === 1) {
        return response({
          statusCode: 500,
          error: 'INTERNAL_SERVER_ERROR',
          message: 'raw Prisma stack must stay hidden',
        }, false);
      }
      return response({
        data: options.emptyFareList ? [] : [fare],
        meta: {
          page: Number(url.searchParams.get('page') ?? 1),
          pageSize: Number(url.searchParams.get('pageSize') ?? 10),
          totalItems: options.emptyFareList ? 0 : 1,
          totalPages: options.emptyFareList ? 0 : 1,
        },
      });
    }
    if (url.pathname === '/api/v1/routes') return response(routePage);
    if (url.pathname === '/api/v1/vehicle-types') return response(vehicleTypePage);

    throw new Error(`Unexpected API request: ${url.pathname}${url.search}`);
  });

  vi.stubGlobal('fetch', fetchMock);
  return { requests, fetchMock, getFareListRequests: () => fareListRequests };
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
      (this as HTMLDialogElement & { returnFocusTo?: Element | null }).returnFocusTo = document.activeElement;
      this.setAttribute('open', '');
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.removeAttribute('open');
      const returnFocusTo = (this as HTMLDialogElement & { returnFocusTo?: Element | null }).returnFocusTo;
      if (returnFocusTo instanceof HTMLElement) returnFocusTo.focus();
      this.dispatchEvent(new Event('close'));
    },
  });
});

describe('Fare Prices list and detail behavior', () => {
  it('renders API data, exposes create, and opens the shared detail sheet', async () => {
    const api = installApi();

    render(<FarePricesManagement />);

    expect(screen.getByRole('heading', { name: 'Quản lý bảng giá vé' })).toBeTruthy();
    expect(screen.getByText('Theo dõi giá vé theo tuyến, loại xe và thời gian hiệu lực.')).toBeTruthy();
    expect((await screen.findAllByText('Limousine')).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Thêm bảng giá' })).toBeTruthy();
    const mobileList = screen.getByRole('list', { name: 'Danh sách bảng giá dạng thẻ' });
    expect(mobileList.tagName).toBe('UL');
    expect(within(mobileList).getAllByRole('listitem')).toHaveLength(1);

    const trigger = screen.getAllByRole('button', { name: 'Xem chi tiết SG-DL-01' })[0];
    trigger.focus();
    fireEvent.click(trigger);
    const detail = await screen.findByRole('dialog');
    expect(within(detail).getByText(/250\.000/)).toBeTruthy();
    expect(api.requests).toContain('/api/v1/fare-prices/15');

    const closeButton = within(detail).getByRole('button', { name: 'Đóng chi tiết bảng giá' });
    closeButton.focus();
    fireEvent.click(closeButton);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it('shows an empty state when the server returns no fares', async () => {
    installApi({ emptyFareList: true });

    render(<FarePricesManagement />);

    expect(await screen.findByText('Chưa có bảng giá nào.')).toBeTruthy();
  });

  it('shows a safe error and retries the list request', async () => {
    const api = installApi({ failFirstFareList: true });

    render(<FarePricesManagement />);

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByText('raw Prisma stack must stay hidden')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect((await screen.findAllByText('Limousine')).length).toBeGreaterThan(0);
    expect(api.getFareListRequests()).toBe(2);
  });

  it('sends search to the API instead of filtering only the current page', async () => {
    const api = installApi();

    render(<FarePricesManagement />);

    const search = await screen.findByRole('searchbox', { name: 'Tìm bảng giá' });
    fireEvent.change(search, { target: { value: 'SG-DL' } });

    await waitFor(() => {
      expect(api.requests.some((url) => url.includes('search=SG-DL'))).toBe(true);
    });
  });
});
