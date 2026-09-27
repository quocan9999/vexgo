import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import {
  LoginDto,
  RegisterDto,
} from '../../../src/auth/dto/auth.dto.js';

const validationOptions = {
  whitelist: true,
  forbidNonWhitelisted: true,
};

describe('Auth DTO validation', () => {
  it('accepts the seeded account login payload', async () => {
    const dto = plainToInstance(LoginDto, {
      soDienThoai: '+84900000000',
      matKhau: 'VexGo@123',
    });

    await expect(validate(dto, validationOptions)).resolves.toEqual([]);
  });

  it('accepts a valid registration payload', async () => {
    const dto = plainToInstance(RegisterDto, {
      hoTen: 'Nguyễn Văn An',
      soDienThoai: '+84901234567',
      matKhau: 'VexGo@123',
      email: 'an@example.com',
      cccd: '079123456789',
    });

    await expect(validate(dto, validationOptions)).resolves.toEqual([]);
  });

  it('rejects malformed auth fields and unknown properties', async () => {
    const dto = plainToInstance(RegisterDto, {
      hoTen: '',
      soDienThoai: 'abc',
      matKhau: '',
      email: 'invalid-email',
      cccd: '123',
      role: 'ADMIN',
    });

    const errors = await validate(dto, validationOptions);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining([
        'hoTen',
        'soDienThoai',
        'matKhau',
        'email',
        'cccd',
        'role',
      ]),
    );
  });
});
