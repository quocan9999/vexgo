import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { IsPasswordByteLength } from '../../../src/auth/validators/is-password-byte-length.validator.js';

class PasswordDto {
  @IsPasswordByteLength()
  password!: string;
}

describe('IsPasswordByteLength', () => {
  it.each([
    ['minimum accepted UTF-8 byte length', '12345678'],
    ['maximum accepted UTF-8 byte length', 'a'.repeat(72)],
    ['maximum multi-byte password at 72 bytes', 'ậ'.repeat(24)],
  ])('accepts the %s', async (_name, password) => {
    const dto = plainToInstance(PasswordDto, { password });

    await expect(validate(dto)).resolves.toEqual([]);
  });

  it.each([
    ['fewer than eight bytes', '1234567'],
    ['more than 72 ASCII bytes', 'a'.repeat(73)],
    ['more than 72 UTF-8 bytes', 'ậ'.repeat(25)],
  ])('rejects a password with %s', async (_name, password) => {
    const dto = plainToInstance(PasswordDto, { password });
    const errors = await validate(dto);

    expect(errors.map(({ property }) => property)).toContain('password');
  });
});
