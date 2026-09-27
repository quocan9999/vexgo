import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { LoginDto, RegisterDto } from '../../../src/auth/dto/auth.dto.js';

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
      otpProof: 'verified-proof',
      email: 'an@example.com',
      cccd: '079123456789',
      ngaySinh: '2000-02-29',
    });

    await expect(validate(dto, validationOptions)).resolves.toEqual([]);
  });

  it('rejects malformed auth fields and unknown properties', async () => {
    const dto = plainToInstance(RegisterDto, {
      hoTen: '',
      soDienThoai: 'abc',
      matKhau: '',
      otpProof: '',
      email: 'invalid-email',
      cccd: '123',
      ngaySinh: '2026-02-30',
      role: 'ADMIN',
    });

    const errors = await validate(dto, validationOptions);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining([
        'hoTen',
        'soDienThoai',
        'matKhau',
        'otpProof',
        'email',
        'cccd',
        'ngaySinh',
        'role',
      ]),
    );
  });

  it.each([
    ['local format', '0901234567'],
    ['non-Vietnamese country code', '+66901234567'],
    ['too short', '+8490123456'],
  ])('rejects a phone number in %s', async (_name, soDienThoai) => {
    const dto = plainToInstance(RegisterDto, {
      hoTen: 'Nguyễn Văn An',
      soDienThoai,
      matKhau: 'VexGo@123',
      otpProof: 'verified-proof',
    });

    const errors = await validate(dto, validationOptions);
    expect(errors.map(({ property }) => property)).toContain('soDienThoai');
  });

  it.each([
    ['fewer than eight UTF-8 bytes', '1234567'],
    ['more than 72 ASCII bytes', 'a'.repeat(73)],
    ['Unicode over 72 UTF-8 bytes', 'ậ'.repeat(25)],
  ])('rejects a password with %s', async (_name, matKhau) => {
    const dto = plainToInstance(RegisterDto, {
      hoTen: 'Nguyễn Văn An',
      soDienThoai: '+84901234567',
      matKhau,
      otpProof: 'verified-proof',
    });

    const errors = await validate(dto, validationOptions);
    expect(errors.map(({ property }) => property)).toContain('matKhau');
  });

  it.each(['2026-02-30', '2025-02-29', '2000-13-01', '01-01-2000'])(
    'rejects impossible or malformed date-only value %s',
    async (ngaySinh) => {
      const dto = plainToInstance(RegisterDto, {
        hoTen: 'Nguyễn Văn An',
        soDienThoai: '+84901234567',
        matKhau: 'VexGo@123',
        otpProof: 'verified-proof',
        ngaySinh,
      });

      const errors = await validate(dto, validationOptions);
      expect(errors.map(({ property }) => property)).toContain('ngaySinh');
    },
  );
});
