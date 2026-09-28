import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { LoginDto, RegisterDto } from '../../../src/auth/dto/auth.dto.js';

const validationOptions = {
  whitelist: true,
  forbidNonWhitelisted: true,
};

describe('Auth DTO validation', () => {
  it('accepts the seeded account login payload with public field names', async () => {
    const dto = plainToInstance(LoginDto, {
      phoneNumber: '+84900000000',
      password: 'VexGo@123',
    });

    await expect(validate(dto, validationOptions)).resolves.toEqual([]);
  });

  it('accepts a valid registration payload with public field names', async () => {
    const dto = plainToInstance(RegisterDto, {
      fullName: 'Nguyễn Văn An',
      phoneNumber: '+84901234567',
      password: 'VexGo@123',
      otpProof: 'verified-proof',
      email: 'an@example.com',
      citizenId: '079123456789',
      dateOfBirth: '2000-02-29',
    });

    await expect(validate(dto, validationOptions)).resolves.toEqual([]);
  });

  it('rejects legacy Vietnamese auth fields', async () => {
    const dto = plainToInstance(RegisterDto, {
      hoTen: 'Nguyễn Văn An',
      soDienThoai: '+84901234567',
      matKhau: 'VexGo@123',
      otpProof: 'verified-proof',
    });

    const errors = await validate(dto, validationOptions);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['hoTen', 'soDienThoai', 'matKhau']),
    );
  });

  it('rejects malformed auth fields and unknown properties', async () => {
    const dto = plainToInstance(RegisterDto, {
      fullName: '',
      phoneNumber: 'abc',
      password: '',
      otpProof: '',
      email: 'invalid-email',
      citizenId: '123',
      dateOfBirth: '2026-02-30',
      role: 'ADMIN',
    });

    const errors = await validate(dto, validationOptions);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining([
        'fullName',
        'phoneNumber',
        'password',
        'otpProof',
        'email',
        'citizenId',
        'dateOfBirth',
        'role',
      ]),
    );
  });

  it.each([
    ['local format', '0901234567'],
    ['non-Vietnamese country code', '+66901234567'],
    ['too short', '+8490123456'],
  ])('rejects a phone number in %s', async (_name, phoneNumber) => {
    const dto = plainToInstance(RegisterDto, {
      fullName: 'Nguyễn Văn An',
      phoneNumber,
      password: 'VexGo@123',
      otpProof: 'verified-proof',
    });

    const errors = await validate(dto, validationOptions);
    expect(errors.map(({ property }) => property)).toContain('phoneNumber');
  });

  it.each([
    ['fewer than eight UTF-8 bytes', '1234567'],
    ['more than 72 ASCII bytes', 'a'.repeat(73)],
    ['Unicode over 72 UTF-8 bytes', 'ậ'.repeat(25)],
  ])('rejects a password with %s', async (_name, password) => {
    const dto = plainToInstance(RegisterDto, {
      fullName: 'Nguyễn Văn An',
      phoneNumber: '+84901234567',
      password,
      otpProof: 'verified-proof',
    });

    const errors = await validate(dto, validationOptions);
    expect(errors.map(({ property }) => property)).toContain('password');
  });

  it.each(['2026-02-30', '2025-02-29', '2000-13-01', '01-01-2000'])(
    'rejects impossible or malformed date-only value %s',
    async (dateOfBirth) => {
      const dto = plainToInstance(RegisterDto, {
        fullName: 'Nguyễn Văn An',
        phoneNumber: '+84901234567',
        password: 'VexGo@123',
        otpProof: 'verified-proof',
        dateOfBirth,
      });

      const errors = await validate(dto, validationOptions);
      expect(errors.map(({ property }) => property)).toContain('dateOfBirth');
    },
  );
});
