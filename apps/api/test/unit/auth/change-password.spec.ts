import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../../../src/auth/auth.service.js';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';
import type { OtpService } from '../../../src/auth/otp/otp.service.js';
import type { TokenService } from '../../../src/auth/tokens/token.service.js';
import type { PermissionResolverService } from '../../../src/auth/permissions/permission-resolver.service.js';
import type { EffectiveRolePermissionLoaderService } from '../../../src/auth/permissions/effective-role-permission-loader.service.js';

describe('AuthService.changePassword', () => {
  const prisma = {
    taiKhoan: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  const otpService = {} as OtpService;
  const tokenService = {} as TokenService;
  const permissionResolver = {} as PermissionResolverService;
  const permissionLoader = {} as EffectiveRolePermissionLoaderService;

  const authService = new AuthService(
    prisma as unknown as PrismaService,
    otpService,
    tokenService,
    permissionResolver,
    permissionLoader,
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects when account is not found', async () => {
    prisma.taiKhoan.findUnique.mockResolvedValue(null);

    await expect(
      authService.changePassword(999, 'OldPass123', 'NewPass456'),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects when account is inactive', async () => {
    prisma.taiKhoan.findUnique.mockResolvedValue({
      taiKhoanId: 1,
      matKhau: await bcrypt.hash('OldPass123', 10),
      trangThai: 'KHOA',
    });

    await expect(
      authService.changePassword(1, 'OldPass123', 'NewPass456'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects when old password does not match', async () => {
    prisma.taiKhoan.findUnique.mockResolvedValue({
      taiKhoanId: 1,
      matKhau: await bcrypt.hash('CorrectOld123', 10),
      trangThai: 'HOAT_DONG',
    });

    await expect(
      authService.changePassword(1, 'WrongOld123', 'NewPass456'),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects when new password is the same as old password', async () => {
    prisma.taiKhoan.findUnique.mockResolvedValue({
      taiKhoanId: 1,
      matKhau: await bcrypt.hash('SamePassword123', 10),
      trangThai: 'HOAT_DONG',
    });

    await expect(
      authService.changePassword(1, 'SamePassword123', 'SamePassword123'),
    ).rejects.toThrow(BadRequestException);
  });

  it('successfully updates password when input is valid', async () => {
    const oldHash = await bcrypt.hash('OldPassword123', 10);
    prisma.taiKhoan.findUnique.mockResolvedValue({
      taiKhoanId: 1,
      matKhau: oldHash,
      trangThai: 'HOAT_DONG',
    });
    prisma.taiKhoan.update.mockResolvedValue({ taiKhoanId: 1 });

    const result = await authService.changePassword(1, 'OldPassword123', 'NewPassword456');

    expect(result).toEqual({ message: 'Đổi mật khẩu thành công.' });
    expect(prisma.taiKhoan.update).toHaveBeenCalledWith({
      where: { taiKhoanId: 1 },
      data: {
        matKhau: expect.any(String),
      },
    });

    const updatedHash = prisma.taiKhoan.update.mock.calls[0][0].data.matKhau;
    expect(await bcrypt.compare('NewPassword456', updatedHash)).toBe(true);
  });
});
