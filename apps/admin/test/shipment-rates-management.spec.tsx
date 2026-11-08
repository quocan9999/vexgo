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
import { canAccessTenantPath } from '@/features/admin-auth/services/admin-access';
import { ShipmentRatesManagement } from '@/features/shipments/components/shipment-rates-management';
import { ShipmentRateWorkspace } from '@/features/shipments/components/shipment-rate-workspace';
import { setEmployeeAdminTestSession } from './admin-auth-test-session';

vi.mock('next/navigation', () => ({
  usePathname: () => '/shipments/rates',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
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

const sampleRate = {
  rateId: 10,
  weightFrom: 0,
  weightTo: 5,
  fee: 35000,
  currency: 'VND' as const,
  validFrom: '2026-01-01',
  validTo: null,
  status: 'HOAT_DONG' as const,
  effectiveState: 'DANG_HIEU_LUC' as const,
  route: {
    routeId: 3,
    code: 'SG-DL-01',
    origin: 'TP.HCM',
    destination: 'Đà Lạt',
  },
  cargoType: {
    cargoTypeId: 1,
    name: 'Hàng nhẹ',
    capacityGroup: 'HANG_NHE',
  },
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

const categoriesPayload = {
  data: [
    {
      categoryId: 1,
      name: 'Hàng nhẹ',
      description: 'Bưu phẩm, quần áo nhỏ gọn',
      capacityGroup: 'HANG_NHE',
    },
    {
      categoryId: 2,
      name: 'Hàng cồng kềnh',
      description: 'Thùng xốp, thiết bị điện tử',
      capacityGroup: 'HANG_CONG_KENH',
    },
  ],
};

function response(body: unknown, ok = true, status = ok ? 200 : 500): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

function installApi() {
  setEmployeeAdminTestSession([
    'shipment:read',
    'shipment:update',
    'fare-price:read',
    'fare-price:create',
    'fare-price:update',
    'route:read',
  ]);
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:4002');
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];

  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      const method = init?.method ?? 'GET';
      const parsedBody =
        typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
      requests.push({
        method,
        url: `${url.pathname}${url.search}`,
        body: parsedBody,
      });

      if (url.pathname === '/api/v1/shipments/rates/10' && method === 'GET') {
        return response({ data: sampleRate });
      }
      if (url.pathname === '/api/v1/shipments/rates/10' && method === 'PATCH') {
        return response({
          data: {
            ...sampleRate,
            ...(parsedBody as Record<string, unknown>),
          },
        });
      }
      if (
        url.pathname === '/api/v1/shipments/rates/10/status' &&
        method === 'PATCH'
      ) {
        return response({
          data: {
            ...sampleRate,
            status: (parsedBody as { status: 'HOAT_DONG' | 'TAM_NGUNG' })
              .status,
          },
        });
      }
      if (url.pathname === '/api/v1/shipments/rates' && method === 'POST') {
        return response(
          {
            data: {
              ...sampleRate,
              rateId: 11,
              weightFrom: (parsedBody as { weightFrom: number }).weightFrom,
              weightTo: (parsedBody as { weightTo: number | null }).weightTo,
              fee: (parsedBody as { fee: number }).fee,
            },
          },
          true,
          201,
        );
      }
      if (url.pathname === '/api/v1/shipments/rates' && method === 'GET') {
        return response({
          data: [sampleRate],
          meta: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
        });
      }
      if (url.pathname === '/api/v1/routes') {
        return response(routePage);
      }
      if (url.pathname === '/api/v1/shipments/categories') {
        return response(categoriesPayload);
      }

      throw new Error(
        `Unexpected API request: ${method} ${url.pathname}${url.search}`,
      );
    },
  );

  vi.stubGlobal('fetch', fetchMock);
  return { requests, fetchMock };
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

describe('ShipmentRatesManagement', () => {
  it('renders shipment rates with friendly Vietnamese labels and without redundant surcharge card', async () => {
    installApi();

    render(<ShipmentRatesManagement />);

    expect(
      screen.getByRole('heading', { name: 'Quản lý bảng giá cước gửi hàng' }),
    ).toBeTruthy();

    // Verify redundant surcharge card in Figure 2 is removed
    expect(screen.queryByText(/Quy tắc cộng phụ phí cố định/)).toBeNull();

    // Wait for rate item to render
    expect((await screen.findAllByText('Hàng nhẹ')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('0 → 5 kg').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/35\.000/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Đang hoạt động').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Đang hiệu lực').length).toBeGreaterThan(0);

    // Ensure raw enum strings are not rendered in the document text
    expect(screen.queryByText('HOAT_DONG')).toBeNull();
    expect(screen.queryByText('DANG_HIEU_LUC')).toBeNull();
    expect(screen.queryByText('HANG_NHE')).toBeNull();
  });

  it('creates a new shipment rate using SearchableCombobox for route and weight band presets', async () => {
    const api = installApi();

    render(<ShipmentRatesManagement />);

    const createBtn = await screen.findByRole('button', {
      name: 'Thêm mức cước',
    });
    fireEvent.click(createBtn);

    const dialog = await screen.findByRole('dialog', {
      name: 'Thêm mức cước gửi hàng',
    });

    // Select route via SearchableCombobox
    const openRouteBtn = within(dialog).getByRole('button', {
      name: /Mở danh sách địa điểm/i,
    });
    fireEvent.click(openRouteBtn);

    const routeOption = await screen.findByRole('option', {
      name: /TP\.HCM → Đà Lạt \(SG-DL-01\)/i,
    });
    fireEvent.click(routeOption);

    // Select cargo type
    const cargoSelect = within(dialog).getByRole('combobox', {
      name: /Loại hàng hóa/i,
    });
    fireEvent.click(cargoSelect);
    const cargoOption = await screen.findByRole('option', {
      name: 'Hàng nhẹ',
    });
    fireEvent.click(cargoOption);

    // Click weight band preset '1 → 5 kg'
    const presetBtn = within(dialog).getByRole('button', {
      name: '1 → 5 kg',
    });
    fireEvent.click(presetBtn);

    // Fill fee and validFrom
    const feeInput = within(dialog).getByLabelText(/Mức cước cơ bản/i);
    fireEvent.change(feeInput, { target: { value: '45000' } });

    const validFromInput = within(dialog).getByLabelText(/Hiệu lực từ ngày/i);
    fireEvent.change(validFromInput, { target: { value: '2026-11-05' } });

    const submitBtn = within(dialog).getByRole('button', {
      name: 'Tạo mức cước',
    });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      const postCall = api.requests.find(
        (req) =>
          req.method === 'POST' && req.url === '/api/v1/shipments/rates',
      );
      expect(postCall).toBeDefined();
      expect(postCall?.body).toEqual({
        routeId: 3,
        cargoTypeId: 1,
        weightFrom: 1,
        weightTo: 5,
        fee: 45000,
        validFrom: '2026-11-05',
        status: 'HOAT_DONG',
      });
    });
  });

  it('links to dedicated workspace and toggles shipment rate status', async () => {
    const api = installApi();

    render(<ShipmentRatesManagement />);

    const detailBtn = (
      await screen.findAllByRole('button', { name: 'Xem chi tiết SG-DL-01' })
    )[0]!;
    expect(
      detailBtn.getAttribute('href') ||
        detailBtn.closest('a')?.getAttribute('href'),
    ).toBe('/shipments/rates/10');

    cleanup();
    render(<ShipmentRateWorkspace rateId={10} initialRate={sampleRate} />);

    expect(await screen.findByText('0 → 5 kg')).toBeTruthy();

    fireEvent.click(
      await screen.findByRole('button', { name: 'Tạm ngưng' }),
    );

    const confirmDialog = await screen.findByRole('alertdialog', {
      name: 'Tạm ngưng mức cước?',
    });
    fireEvent.click(
      within(confirmDialog).getByRole('button', { name: 'Xác nhận tạm ngưng' }),
    );

    await waitFor(() => {
      const statusCall = api.requests.find(
        (req) =>
          req.method === 'PATCH' &&
          req.url === '/api/v1/shipments/rates/10/status',
      );
      expect(statusCall).toBeDefined();
      expect(statusCall?.body).toEqual({ status: 'TAM_NGUNG' });
    });
  });

  it('allows tenant access to /shipments/rates with either shipment:read or fare-price:read', () => {
    const baseSession = {
      accountId: 2,
      fullName: 'Nhân viên',
      phoneNumber: '+84900000002',
      email: 'nv@vexgo.test',
      roles: ['NHAN_VIEN_CSKH'],
      employee: {
        employeeId: 1,
        busCompanyId: 10,
        busCompanyCode: 'FUTA',
        busCompanyName: 'Phương Trang',
      },
      busCompanyId: 10,
    };

    expect(
      canAccessTenantPath(
        { ...baseSession, permissions: ['fare-price:read'] },
        '/shipments/rates',
      ),
    ).toBe(true);
    expect(
      canAccessTenantPath(
        { ...baseSession, permissions: ['shipment:read'] },
        '/shipments/rates',
      ),
    ).toBe(true);
    expect(
      canAccessTenantPath(
        { ...baseSession, permissions: ['customer:read'] },
        '/shipments/rates',
      ),
    ).toBe(false);
  });
});
