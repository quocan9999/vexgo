import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { BookingQueryDto } from '../../../src/bookings/dto/booking-query.dto.js';

const validationOptions = {
  whitelist: true,
  forbidNonWhitelisted: true,
};

describe('BookingQueryDto validation', () => {
  it('accepts valid query with valid YYYY-MM-DD departureDate and supported sortBy', async () => {
    const dto = plainToInstance(BookingQueryDto, {
      departureDate: '2026-10-02',
      sortBy: 'totalAmount',
      sortDirection: 'asc',
      page: 1,
      pageSize: 10,
    });

    const errors = await validate(dto, validationOptions);
    expect(errors).toHaveLength(0);
  });

  it('allows query without departureDate', async () => {
    const dto = plainToInstance(BookingQueryDto, {
      sortBy: 'createdAt',
      sortDirection: 'desc',
    });

    const errors = await validate(dto, validationOptions);
    expect(errors).toHaveLength(0);
  });

  it.each([
    ['arbitrary string', 'abc'],
    ['non-padded date', '2026-2-2'],
    ['invalid calendar date', '2026-02-30'],
    ['full ISO timestamp', '2026-10-02T00:00:00.000Z'],
    ['short date', '2026-13-01'],
  ])('rejects invalid departureDate: %s', async (_name, departureDate) => {
    const dto = plainToInstance(BookingQueryDto, { departureDate });
    const errors = await validate(dto, validationOptions);

    expect(errors.some((e) => e.property === 'departureDate')).toBe(true);
  });

  it('rejects unsupported sortBy values', async () => {
    const dto = plainToInstance(BookingQueryDto, {
      sortBy: 'departureTime',
    });
    const errors = await validate(dto, validationOptions);

    expect(errors.some((e) => e.property === 'sortBy')).toBe(true);
  });

  it.each(['createdAt', 'totalAmount'])(
    'accepts supported sortBy: %s',
    async (sortBy) => {
      const dto = plainToInstance(BookingQueryDto, { sortBy });
      const errors = await validate(dto, validationOptions);

      expect(errors).toHaveLength(0);
    },
  );
});
