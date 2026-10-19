import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateBookingDto } from '../../../src/bookings/dto/create-booking.dto.js';

describe('CreateBookingDto', () => {
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
    expect(errors.flatMap((error) => Object.keys(error.constraints ?? {}))).toEqual(
      expect.arrayContaining(['arrayUnique', 'isNotEmpty']),
    );
  });
});
