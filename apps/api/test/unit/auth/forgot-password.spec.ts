import { ForbiddenException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../../src/auth/auth.service.js';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';
import type { OtpService } from '../../../src/auth/otp/otp.service.js';
import type { TokenService } from '../../../src/auth/tokens/token.service.js';
import { PermissionResolverService } from '../../../src/auth/permissions/permission-resolver.service.js';
import type { EffectiveRolePermissionLoaderService } from '../../../src/auth/permissions/effective-role-permission-loader.service.js';
import type { RealtimeSessionInvalidatorService } from '../../../src/auth/realtime-session-invalidator.service.js';
import type { ResetForgotPasswordDto } from '../../../src/auth/dto/forgot-password.dto.js';

const NOW = new Date('2026-11-05T10:00:00.000Z');

describe('AuthService.resetForgotPassword', () => {
  const activeSessions = [
    { sessionId: 'session-1', taiKhoanId: 10, hetHanLuc: new Date('2026-11-06T10:00:00.000Z') },
    { sessionId: 'session-2', taiKhoanId: 10, hetHanLuc: new Date('2026-11-06T10:00:00.000Z') },
  ];

  const tx = {
    taiKhoan: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    phienDangNhap: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
  };

  const prisma = {
    $transaction: vi.fn(async (cb) => cb(tx)),
    taiKhoan: { findUnique: vi.fn() },
  };

  const otpService = {
    consumeForgotPasswordProof: vi.fn(),
  };

  const tokenService = {} as TokenService;
  const permissionResolver = new PermissionResolverService();
  const permissionLoader = {} as EffectiveRolePermissionLoaderService;
  const sessionInvalidator = {
    invalidateSession: vi.fn(),
  };

  const service = new AuthService(
    prisma as unknown as PrismaService,
    otpService as unknown as OtpService,
    tokenService,
    permissionResolver,
    permissionLoader,
    sessionInvalidator as unknown as RealtimeSessionInvalidatorService,
  );

  const resetDto: ResetForgotPasswordDto = {
    phoneNumber: '+84901234567',
    otpProof: 'valid-otp-proof-jwt',
    newPassword: 'NewPassword@123',
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.clearAllMocks();
    otpService.consumeForgotPasswordProof.mockResolvedValue(undefined);
    tx.taiKhoan.findUnique.mockResolvedValue({
      taiKhoanId: 10,
      soDienThoai: '+84901234567',
      loaiTaiKhoan: 'KHACH_HANG',
      trangThai: 'HOAT_DONG',
      khoaDenNgay: null,
      lyDoKhoa: null,
    });
    tx.phienDangNhap.findMany.mockResolvedValue(activeSessions);
    tx.phienDangNhap.updateMany.mockResolvedValue({ count: 2 });
    tx.taiKhoan.update.mockResolvedValue({ taiKhoanId: 10 });
  });

  it('consumes OTP proof, updates hashed password, revokes all active sessions, and invalidates them', async () => {
    const result = await service.resetForgotPassword(resetDto);

    expect(result).toEqual({
      message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.',
    });

    expect(otpService.consumeForgotPasswordProof).toHaveBeenCalledWith(tx, {
      soDienThoai: resetDto.phoneNumber,
      otpProof: resetDto.otpProof,
      usedAt: NOW,
    });

    expect(tx.taiKhoan.findUnique).toHaveBeenCalledWith({
      where: {
        soDienThoai_loaiTaiKhoan: {
          soDienThoai: resetDto.phoneNumber,
          loaiTaiKhoan: 'KHACH_HANG',
        },
      },
      select: {
        taiKhoanId: true,
        trangThai: true,
        khoaDenNgay: true,
        lyDoKhoa: true,
      },
    });

    const updateCall = tx.taiKhoan.update.mock.calls[0][0];
    expect(updateCall.where).toEqual({ taiKhoanId: 10 });
    expect(await bcrypt.compare(resetDto.newPassword, updateCall.data.matKhau)).toBe(true);

    expect(tx.phienDangNhap.updateMany).toHaveBeenCalledWith({
      where: {
        taiKhoanId: 10,
        thuHoiLuc: null,
      },
      data: {
        thuHoiLuc: NOW,
      },
    });

    expect(sessionInvalidator.invalidateSession).toHaveBeenCalledWith('session-1');
    expect(sessionInvalidator.invalidateSession).toHaveBeenCalledWith('session-2');
  });

  it('rejects with PHONE_NOT_REGISTERED when KHACH_HANG account does not exist', async () => {
    tx.taiKhoan.findUnique.mockResolvedValueOnce(null);

    await expect(service.resetForgotPassword(resetDto)).rejects.toMatchObject({
      response: {
        error: 'PHONE_NOT_REGISTERED',
      },
    });
    expect(tx.taiKhoan.update).not.toHaveBeenCalled();
    expect(sessionInvalidator.invalidateSession).not.toHaveBeenCalled();
  });

  it('rejects with ACCOUNT_SUSPENDED when account is locked or suspended', async () => {
    tx.taiKhoan.findUnique.mockResolvedValueOnce({
      taiKhoanId: 10,
      soDienThoai: '+84901234567',
      loaiTaiKhoan: 'KHACH_HANG',
      trangThai: 'TAM_KHOA',
      khoaDenNgay: null,
      lyDoKhoa: 'Vi phạm',
    });

    await expect(service.resetForgotPassword(resetDto)).rejects.toMatchObject({
      response: {
        error: 'ACCOUNT_SUSPENDED',
      },
    });
    expect(tx.taiKhoan.update).not.toHaveBeenCalled();
    expect(sessionInvalidator.invalidateSession).not.toHaveBeenCalled();
  });
});
