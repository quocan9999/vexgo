import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { SearchTripsDto } from '../../../src/trips/dto/search-trips.dto.js';

const validationOptions = {
  whitelist: true,
  forbidNonWhitelisted: true,
};

describe('SearchTripsDto', () => {
  it.each(['all', 'early-morning', 'morning', 'afternoon', 'evening'])(
    'accepts the supported time range %s',
    async (timeRange) => {
      const dto = plainToInstance(SearchTripsDto, { timeRange });

      await expect(validate(dto, validationOptions)).resolves.toEqual([]);
    },
  );

  it('rejects an unsupported time range instead of silently ignoring it', async () => {
    const dto = plainToInstance(SearchTripsDto, { timeRange: 'morningg' });

    const errors = await validate(dto, validationOptions);

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: 'timeRange' }),
      ]),
    );
  });
});
