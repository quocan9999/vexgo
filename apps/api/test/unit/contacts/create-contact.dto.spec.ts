import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateContactDto } from '../../../src/contacts/dto/create-contact.dto.js';

const validContact = {
  fullName: 'Nguyễn Văn A',
  phoneNumber: '0912345678',
  subject: 'Hỗ trợ',
  message: 'Tôi cần hỗ trợ đặt vé.',
};

describe('CreateContactDto phone validation', () => {
  it.each(['05|1234567', '07|1234567'])(
    'rejects a phone number containing a literal pipe: %s',
    async (phoneNumber) => {
      const dto = plainToInstance(CreateContactDto, {
        ...validContact,
        phoneNumber,
      });

      const errors = await validate(dto, {
        whitelist: true,
        forbidNonWhitelisted: true,
      });

      expect(errors.map(({ property }) => property)).toContain('phoneNumber');
    },
  );
});
