import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate, type ValidationError } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateShipmentDto } from '../../../src/shipments/dto/create-shipment.dto.js';

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
