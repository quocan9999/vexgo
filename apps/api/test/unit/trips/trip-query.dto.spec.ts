import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { TripQueryDto } from '../../../src/trips/dto/trip-query.dto.js';

const validationOptions = {
  whitelist: true,
  forbidNonWhitelisted: true,
};

describe('TripQueryDto', () => {
  it('accepts valid origin, destination, timeRange and departureTime', async () => {
    const dto = plainToInstance(TripQueryDto, {
      origin: 'TP.HCM',
      destination: 'Đà Lạt',
      timeRange: 'morning',
      departureTime: '08:30',
      page: 1,
      pageSize: 10,
    });

    await expect(validate(dto, validationOptions)).resolves.toEqual([]);
  });

  it('rejects an unsupported timeRange', async () => {
    const dto = plainToInstance(TripQueryDto, { timeRange: 'invalid-time' });

    const errors = await validate(dto, validationOptions);
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: 'timeRange' }),
      ]),
    );
  });

  it('rejects an invalid departureTime format', async () => {
    const dto = plainToInstance(TripQueryDto, { departureTime: '25:99' });

    const errors = await validate(dto, validationOptions);
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: 'departureTime' }),
      ]),
    );
  });
});
