// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { VehicleTypeFormDialog } from '@/features/vehicle-types/components/vehicle-type-form-dialog';
import { getVehicleTypes } from '@/features/vehicle-types/services/vehicle-type-service';

const mocks = vi.hoisted(() => ({
  adminApiFetch: vi.fn(),
  getBusCompanyFilterOptions: vi.fn(),
}));

vi.mock('@/lib/admin-api-client', () => ({
  adminApiFetch: mocks.adminApiFetch,
}));

vi.mock('@/lib/api-url', () => ({
  getApiBaseUrl: () => 'http://localhost:4000',
}));

vi.mock(
  '@/features/bus-companies/services/bus-company-service',
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import('@/features/bus-companies/services/bus-company-service')
    >()),
    getBusCompanyFilterOptions: mocks.getBusCompanyFilterOptions,
  }),
);

const existingVehicleType = {
  vehicleTypeId: 13,
  name: 'Xe du lịch',
  description: null,
  motorbikeCapacityDefault: 2,
  bulkyCargoCapacityDefault: 4,
  lightCargoCapacityDefault: 7,
  createdAt: '2026-09-25T10:00:00.000Z',
  updatedAt: '2026-09-26T10:00:00.000Z',
};

function apiResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function fillCreateBasics(dialog: HTMLElement) {
  fireEvent.change(within(dialog).getByLabelText('Nhà xe *'), {
    target: { value: '4' },
  });
  fireEvent.change(within(dialog).getByLabelText('Tên loại xe *'), {
    target: { value: 'Xe du lịch' },
  });
  fireEvent.change(dialog.querySelector('textarea') as HTMLTextAreaElement, {
    target: { value: 'Xe chở khách' },
  });
}

async function fillCreateBasicsWhenReady(dialog: HTMLElement) {
  await within(dialog).findByRole('option', { name: 'Nhà xe ABC' });
  fillCreateBasics(dialog);
}

function requestBodyAt(index = 0) {
  const [url, init] = mocks.adminApiFetch.mock.calls[index] as [
    string,
    RequestInit,
  ];
  return {
    url,
    init,
    body: JSON.parse(String(init.body)) as Record<string, unknown>,
  };
}

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

beforeEach(() => {
  mocks.adminApiFetch.mockReset();
  mocks.getBusCompanyFilterOptions.mockReset();
  mocks.getBusCompanyFilterOptions.mockResolvedValue([
    { id: 4, label: 'Nhà xe ABC' },
  ]);
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe('Vehicle Type default cargo capacities', () => {
  it('starts create capacities at zero and submits numeric values to the API', async () => {
    const savedVehicleType = {
      ...existingVehicleType,
      motorbikeCapacityDefault: 12,
      bulkyCargoCapacityDefault: 6,
      lightCargoCapacityDefault: 18,
    };
    mocks.adminApiFetch.mockResolvedValueOnce(
      apiResponse({ data: savedVehicleType }),
    );
    const onSaved = vi.fn();

    render(<VehicleTypeFormDialog onClose={vi.fn()} onSaved={onSaved} />);
    const dialog = await screen.findByRole('dialog', { name: 'Thêm loại xe' });
    const capacityGroup = within(dialog).getByRole('group', {
      name: 'Sức chứa hàng mặc định',
    });

    expect(
      (within(capacityGroup).getByLabelText('Xe máy') as HTMLInputElement)
        .value,
    ).toBe('0');
    expect(
      (
        within(capacityGroup).getByLabelText(
          'Hàng cồng kềnh',
        ) as HTMLInputElement
      ).value,
    ).toBe('0');
    expect(
      (within(capacityGroup).getByLabelText('Hàng nhẹ') as HTMLInputElement)
        .value,
    ).toBe('0');
    expect(
      within(dialog).getByText(
        'Các giá trị này được dùng làm sức chứa mặc định khi tạo chuyến mới. Thay đổi tại đây không cập nhật sức chứa của các chuyến đã tồn tại.',
      ),
    ).toBeTruthy();

    await fillCreateBasicsWhenReady(dialog);
    fireEvent.change(within(capacityGroup).getByLabelText('Xe máy'), {
      target: { value: '12' },
    });
    fireEvent.change(within(capacityGroup).getByLabelText('Hàng cồng kềnh'), {
      target: { value: '6' },
    });
    fireEvent.change(within(capacityGroup).getByLabelText('Hàng nhẹ'), {
      target: { value: '18' },
    });
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Tạo loại xe' }),
    );

    await waitFor(() => expect(mocks.adminApiFetch).toHaveBeenCalledOnce());
    expect(requestBodyAt()).toMatchObject({
      url: 'http://localhost:4000/api/v1/vehicle-types',
      init: { method: 'POST' },
      body: {
        name: 'Xe du lịch',
        description: 'Xe chở khách',
        busCompanyId: 4,
        motorbikeCapacityDefault: 12,
        bulkyCargoCapacityDefault: 6,
        lightCargoCapacityDefault: 18,
      },
    });
    expect(onSaved).toHaveBeenCalledWith(savedVehicleType);
  });

  it('allows the default zero capacities when creating a vehicle type', async () => {
    const savedVehicleType = {
      ...existingVehicleType,
      motorbikeCapacityDefault: 0,
      bulkyCargoCapacityDefault: 0,
      lightCargoCapacityDefault: 0,
    };
    mocks.adminApiFetch.mockResolvedValueOnce(
      apiResponse({ data: savedVehicleType }),
    );

    render(<VehicleTypeFormDialog onClose={vi.fn()} onSaved={vi.fn()} />);
    const dialog = await screen.findByRole('dialog', {
      name: 'Thêm loại xe',
    });
    await fillCreateBasicsWhenReady(dialog);
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Tạo loại xe' }),
    );

    await waitFor(() => expect(mocks.adminApiFetch).toHaveBeenCalledOnce());
    expect(requestBodyAt().body).toMatchObject({
      motorbikeCapacityDefault: 0,
      bulkyCargoCapacityDefault: 0,
      lightCargoCapacityDefault: 0,
    });
  });

  it('loads existing values into edit and submits only numeric capacity values', async () => {
    const savedVehicleType = {
      ...existingVehicleType,
      motorbikeCapacityDefault: 15,
    };
    mocks.adminApiFetch.mockResolvedValueOnce(
      apiResponse({ data: savedVehicleType }),
    );
    const onSaved = vi.fn();

    render(
      <VehicleTypeFormDialog
        vehicleType={existingVehicleType}
        onClose={vi.fn()}
        onSaved={onSaved}
      />,
    );
    const dialog = await screen.findByRole('dialog', {
      name: 'Chỉnh sửa loại xe',
    });
    const capacityGroup = within(dialog).getByRole('group', {
      name: 'Sức chứa hàng mặc định',
    });

    expect(
      (within(capacityGroup).getByLabelText('Xe máy') as HTMLInputElement)
        .value,
    ).toBe('2');
    expect(
      (
        within(capacityGroup).getByLabelText(
          'Hàng cồng kềnh',
        ) as HTMLInputElement
      ).value,
    ).toBe('4');
    expect(
      (within(capacityGroup).getByLabelText('Hàng nhẹ') as HTMLInputElement)
        .value,
    ).toBe('7');

    fireEvent.change(within(capacityGroup).getByLabelText('Xe máy'), {
      target: { value: '15' },
    });
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Lưu thay đổi' }),
    );

    await waitFor(() => expect(mocks.adminApiFetch).toHaveBeenCalledOnce());
    expect(requestBodyAt()).toMatchObject({
      url: 'http://localhost:4000/api/v1/vehicle-types/13',
      init: { method: 'PATCH' },
      body: {
        name: 'Xe du lịch',
        description: null,
        motorbikeCapacityDefault: 15,
        bulkyCargoCapacityDefault: 4,
        lightCargoCapacityDefault: 7,
      },
    });
    expect(onSaved).toHaveBeenCalledWith(savedVehicleType);
  });

  it.each([
    ['empty', 'Xe máy', ''],
    ['negative', 'Xe máy', '-1'],
    ['decimal', 'Hàng cồng kềnh', '1.5'],
    ['out of Int32 range', 'Hàng nhẹ', '2147483648'],
  ])(
    'blocks a %s capacity before making an API request',
    async (_label, label, value) => {
      render(<VehicleTypeFormDialog onClose={vi.fn()} onSaved={vi.fn()} />);
      const dialog = await screen.findByRole('dialog', {
        name: 'Thêm loại xe',
      });
      const capacityGroup = within(dialog).getByRole('group', {
        name: 'Sức chứa hàng mặc định',
      });
      await fillCreateBasicsWhenReady(dialog);
      fireEvent.change(within(capacityGroup).getByLabelText(label), {
        target: { value },
      });
      fireEvent.click(
        within(dialog).getByRole('button', { name: 'Tạo loại xe' }),
      );

      expect(
        await within(capacityGroup).findByText(
          'Nhập số nguyên từ 0 đến 2147483647.',
        ),
      ).toBeTruthy();
      expect(mocks.adminApiFetch).not.toHaveBeenCalled();
    },
  );

  it('maps a server capacity validation error to its labeled input', async () => {
    mocks.adminApiFetch.mockResolvedValueOnce(
      apiResponse(
        {
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: 'Dữ liệu không hợp lệ.',
          details: [
            {
              field: 'motorbikeCapacityDefault',
              message: 'Sức chứa xe máy phải là số nguyên.',
            },
          ],
        },
        400,
      ),
    );
    render(<VehicleTypeFormDialog onClose={vi.fn()} onSaved={vi.fn()} />);
    const dialog = await screen.findByRole('dialog', { name: 'Thêm loại xe' });
    await fillCreateBasicsWhenReady(dialog);
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Tạo loại xe' }),
    );

    const capacityInput = within(dialog).getByLabelText('Xe máy');
    await screen.findByText('Sức chứa xe máy phải là số nguyên.');
    expect(capacityInput.getAttribute('aria-invalid')).toBe('true');
    expect(capacityInput.hasAttribute('aria-describedby')).toBe(true);
    expect(within(dialog).queryByRole('alert')).toBeNull();
  });

  it('requires all three integer capacities in list responses', async () => {
    mocks.adminApiFetch.mockResolvedValueOnce(
      apiResponse({
        data: [
          {
            ...existingVehicleType,
            lightCargoCapacityDefault: undefined,
          },
        ],
        meta: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
      }),
    );

    await expect(
      getVehicleTypes({
        search: '',
        page: 1,
        pageSize: 10,
        sortBy: 'name',
        sortDirection: 'asc',
      }),
    ).rejects.toThrow('API trả về danh sách loại xe không hợp lệ.');
  });

  it('parses all default capacities from list responses', async () => {
    mocks.adminApiFetch.mockResolvedValueOnce(
      apiResponse({
        data: [existingVehicleType],
        meta: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
      }),
    );

    const result = await getVehicleTypes({
      search: '',
      page: 1,
      pageSize: 10,
      sortBy: 'name',
      sortDirection: 'asc',
    });

    expect(result.data[0]).toMatchObject({
      motorbikeCapacityDefault: 2,
      bulkyCargoCapacityDefault: 4,
      lightCargoCapacityDefault: 7,
    });
  });
});
