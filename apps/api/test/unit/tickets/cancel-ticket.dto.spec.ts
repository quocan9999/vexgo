import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CancelTicketDto } from '../../../src/tickets/dto/cancel-ticket.dto.js';

const validInput = {
  ticketCode: 'VE-001',
  phoneNumber: '0912345678',
  expectedCancelFeeRate: 0.1,
};

describe('CancelTicketDto', () => {
  it('accepts a cancellation with an explicitly confirmed quote rate', async () => {
    const dto = plainToInstance(CancelTicketDto, validInput);

    await expect(validate(dto)).resolves.toEqual([]);
  });

  it('rejects a cancellation that omits the confirmed quote rate', async () => {
    const { expectedCancelFeeRate: _omitted, ...input } = validInput;
    const dto = plainToInstance(CancelTicketDto, input);

    const errors = await validate(dto);

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: 'expectedCancelFeeRate' }),
      ]),
    );
  });
});
