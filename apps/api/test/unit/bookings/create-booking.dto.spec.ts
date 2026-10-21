import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateBookingDto } from '../../../src/bookings/dto/create-booking.dto.js';

describe('CreateBookingDto', () => {
  const validBooking = {
    tripId: 5,
    seatIds: [21],
    holdToken: 'signed-hold-token',
    pickupPoint: 'Bến xe Miền Đông',
    dropoffPoint: 'Bến xe Đà Lạt',
    contact: { fullName: 'Khách đặt vé', phone: '0901234567' },
  };

  it('accepts a guest booking with a validated cargo item array', async () => {
    const dto = plainToInstance(CreateBookingDto, {
      tripId: 5,
      seatIds: [21],
      holdToken: 'signed-hold-token',
      pickupPoint: 'Bến xe Miền Đông',
      dropoffPoint: 'Bến xe Đà Lạt',
      contact: { fullName: 'Khách đặt vé', phone: '0901234567' },
      cargoItems: [{ name: 'Hành lý', quantity: 1, weight: 5 }],
    });

    await expect(validate(dto)).resolves.toEqual([]);
  });

  it('rejects duplicate seat IDs and a missing hold token', async () => {
    const dto = plainToInstance(CreateBookingDto, {
      tripId: 5,
      seatIds: [21, 21],
      pickupPoint: 'Bến xe Miền Đông',
      dropoffPoint: 'Bến xe Đà Lạt',
      contact: { fullName: 'Khách đặt vé', phone: '0901234567' },
    });

    const errors = await validate(dto);
    expect(
      errors.flatMap((error) => Object.keys(error.constraints ?? {})),
    ).toEqual(expect.arrayContaining(['arrayUnique', 'isNotEmpty']));
  });

  it.each([
    { label: 'number', promotionCode: 123 },
    { label: 'object', promotionCode: {} },
    { label: 'array', promotionCode: [] },
  ])(
    'reports a validation error when promotionCode is a $label',
    async ({ promotionCode }) => {
      const dto = plainToInstance(CreateBookingDto, {
        ...validBooking,
        promotionCode,
      });

      const errors = await validate(dto);
      const promotionCodeError = errors.find(
        (error) => error.property === 'promotionCode',
      );

      expect(promotionCodeError?.constraints).toHaveProperty('isString');
    },
  );

  it.each([null, '', '   '])(
    'keeps an empty promotionCode optional: %j',
    async (promotionCode) => {
      const dto = plainToInstance(CreateBookingDto, {
        ...validBooking,
        promotionCode,
      });

      const errors = await validate(dto);

      expect(
        errors.find((error) => error.property === 'promotionCode'),
      ).toBeUndefined();
      expect(
        errors.find((error) => error.property === 'expectedPromotionQuote'),
      ).toBeUndefined();
    },
  );

  it('requires a validated quote for a non-empty promotion code', async () => {
    const dto = plainToInstance(CreateBookingDto, {
      ...validBooking,
      promotionCode: 'FUTA10',
    });

    const errors = await validate(dto);

    expect(
      errors.find((error) => error.property === 'expectedPromotionQuote'),
    ).toBeDefined();
  });

  it('accepts a non-empty promotion code with its validated quote', async () => {
    const dto = plainToInstance(CreateBookingDto, {
      ...validBooking,
      promotionCode: 'FUTA10',
      expectedPromotionQuote: {
        originalTotal: '150000.00',
        discountAmount: '10000.00',
        finalTotal: '140000.00',
      },
    });

    await expect(validate(dto)).resolves.toEqual([]);
  });
});
