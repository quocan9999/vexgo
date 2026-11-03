import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate, type ValidationError } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateShipmentDto } from '../../../src/shipments/dto/create-shipment.dto.js';
import { ResolveShipmentMoneyCaseDto } from '../../../src/shipments/dto/shipment-operations.dto.js';

function createDto(dimensions: Record<string, unknown> = {}) {
  return plainToInstance(CreateShipmentDto, {
    tripId: 1,
    sender: { fullName: 'Người gửi', phoneNumber: '0900000001' },
    receiver: { fullName: 'Người nhận', phoneNumber: '0900000002' },
    items: [{ name: 'Thùng hàng', quantity: 1, weight: 1, ...dimensions }],
  });
}

function flattenErrors(errors: ValidationError[], parent = ''): string[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const ownMessages = Object.values(error.constraints ?? {}).map(
      (message) => `${field}: ${message}`,
    );
    return [...ownMessages, ...flattenErrors(error.children ?? [], field)];
  });
}

describe('CreateShipmentDto cargo dimensions', () => {
  it('rejects missing contacts and invalid phone numbers at the API boundary', async () => {
    const missing = createDto();
    Reflect.deleteProperty(missing, 'sender');
    expect(flattenErrors(await validate(missing)).join(' ')).toContain(
      'sender',
    );
    const invalid = createDto();
    invalid.receiver.phoneNumber = 'abc';
    expect(flattenErrors(await validate(invalid)).join(' ')).toContain(
      'receiver.phoneNumber',
    );
  });

  it.each([
    ['negative', { length: -150, width: 50, height: 50 }],
    ['zero', { length: 150, width: 0, height: 50 }],
    ['partial', { length: 150, width: 50 }],
    ['non-number', { length: '150', width: 50, height: 50 }],
    ['NaN', { length: Number.NaN, width: 50, height: 50 }],
    ['infinite', { length: 150, width: 50, height: Number.POSITIVE_INFINITY }],
  ])(
    'rejects %s dimensions with a clear Vietnamese message',
    async (_name, dimensions) => {
      const errors = await validate(createDto(dimensions));
      const messages = flattenErrors(errors);

      expect(
        messages.some((message) => message.includes('Kích thước hàng hóa')),
      ).toBe(true);
      expect(
        messages.some((message) => message.includes('số hữu hạn lớn hơn 0')),
      ).toBe(true);
    },
  );

  it('accepts three finite positive dimensions', async () => {
    const errors = await validate(
      createDto({ length: 150, width: 50, height: 50 }),
    );

    expect(errors).toEqual([]);
  });

  it('accepts all dimensions omitted', async () => {
    const errors = await validate(createDto());

    expect(errors).toEqual([]);
  });

  it('accepts all dimensions explicitly null as an omitted measurement', async () => {
    const errors = await validate(
      createDto({ length: null, width: null, height: null }),
    );

    expect(errors).toEqual([]);
  });
});

describe('standalone shipment route and calendar day', () => {
  it('rejects a null trip instead of passing it to the legacy trip flow', async () => {
    const dto = createDto();
    Object.assign(dto, {
      tripId: null,
      routeId: 7,
      sendDate: '03-11-2026',
    });

    expect(
      flattenErrors(await validate(dto)).some((error) =>
        error.startsWith('tripId:'),
      ),
    ).toBe(true);
  });

  it('accepts a route and DD-MM-YYYY without a trip', async () => {
    const dto = createDto();
    Object.assign(dto, {
      tripId: undefined,
      routeId: 7,
      sendDate: '03-11-2026',
    });
    expect(await validate(dto)).toEqual([]);
  });

  it('accepts a route without trip and without sendDate (flexible hub-to-hub dropoff)', async () => {
    const dto = createDto();
    Object.assign(dto, {
      tripId: undefined,
      routeId: 7,
      sendDate: undefined,
    });
    expect(await validate(dto)).toEqual([]);
  });
  it('rejects an impossible calendar day', async () => {
    const dto = createDto();
    Object.assign(dto, {
      tripId: undefined,
      routeId: 7,
      sendDate: '31-02-2026',
    });
    expect(
      flattenErrors(await validate(dto)).some((error) =>
        error.startsWith('sendDate:'),
      ),
    ).toBe(true);
  });
});

describe('manual money case contract', () => {
  it('rejects recording a refund liability as a new collection', async () => {
    const dto = plainToInstance(ResolveShipmentMoneyCaseDto, {
      outcome: 'COLLECTED',
      amount: 50000,
      reference: 'REF-01',
      note: 'Không được chuyển thành khoản thu',
    });

    expect(
      flattenErrors(await validate(dto)).some((error) =>
        error.startsWith('outcome:'),
      ),
    ).toBe(true);
  });
});
