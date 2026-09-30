import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../../src/auth/auth.service.js';
import type { OtpService } from '../../../src/auth/otp/otp.service.js';
import { TokenService } from '../../../src/auth/tokens/token.service.js';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';

const NOW = new Date('2026-09-28T10:00:00.000Z');
let passwordHash: string;

const customerAccount = {
  taiKhoanId: 42,
  hoTen: 'Nguyễn Văn An',
  soDienThoai: '+84901234567',
  matKhau: '',
  ngaySinh: null,
  cccd: null,
  email: null,
  daXacThucSoDienThoai: true,
  trangThai: 'HOAT_DONG',
  createdAt: NOW,
  updatedAt: NOW,
  khachHang: { khachHangId: 12 },
  taiKhoanVaiTros: [{ vaiTro: { tenVaiTro: 'KHACH_HANG' } }],
};
const authResponse = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  tokenType: 'Bearer' as const,
  expiresIn: 900,
  user: {
    accountId: 42,
    customerId: 12,
    fullName: customerAccount.hoTen,
    phoneNumber: customerAccount.soDienThoai,
    roles: ['KHACH_HANG'],
  },
};

describe('AuthService login', () => {
  const tx = {};
  const prisma = {
    taiKhoan: { findUnique: vi.fn() },
    $transaction: vi.fn(async (callback) => callback(tx)),
  };
  const tokenService = { createSession: vi.fn() };
  const service = new AuthService(
    prisma as unknown as PrismaService,
    {} as OtpService,
    tokenService as unknown as TokenService,
  );

  beforeAll(async () => {
    passwordHash = await bcrypt.hash('VexGo@123', 4);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.taiKhoan.findUnique.mockResolvedValue({
      ...customerAccount,
      matKhau: passwordHash,
    });
    tokenService.createSession.mockResolvedValue(authResponse);
  });

  it('creates a persisted session for correct credentials', async () => {
    await expect(
      service.login({
        phoneNumber: customerAccount.soDienThoai,
        password: 'VexGo@123',
      }),
    ).resolves.toEqual(authResponse);

    expect(tokenService.createSession).toHaveBeenCalledWith(tx, {
      accountId: 42,
      customerId: 12,
      fullName: customerAccount.hoTen,
      phoneNumber: customerAccount.soDienThoai,
      roles: ['KHACH_HANG'],
    });
  });

  it('finds an account by a normalized email identifier', async () => {
    prisma.taiKhoan.findUnique.mockResolvedValueOnce({
      ...customerAccount,
      email: 'admin@example.com',
      matKhau: passwordHash,
      khachHang: null,
      taiKhoanVaiTros: [{ vaiTro: { tenVaiTro: 'NHA_XE_ADMIN' } }],
    });

    await service.login({
      identifier: '  ADMIN@EXAMPLE.COM ',
      password: 'VexGo@123',
    });

    expect(prisma.taiKhoan.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'admin@example.com' } }),
    );
    expect(tokenService.createSession).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ roles: ['NHA_XE_ADMIN'], customerId: null }),
    );
  });

  it.each([
    ['unknown phone', null, 'VexGo@123'],
    [
      'wrong password',
      {
        ...customerAccount,
        matKhau: '$2b$04$abcdefghijklmnopqrstuuO6xYB5XGx9lJWjPj2X6F6NwK',
      },
      'wrong-password',
    ],
  ])(
    'uses the same INVALID_CREDENTIALS error for %s',
    async (_name, account, password) => {
      prisma.taiKhoan.findUnique.mockResolvedValueOnce(account);

      const login = service.login({
        phoneNumber: customerAccount.soDienThoai,
        password,
      });
      await expect(login).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(login).rejects.toMatchObject({
        response: { error: 'INVALID_CREDENTIALS' },
      });
      expect(tokenService.createSession).not.toHaveBeenCalled();
    },
  );

  it('rejects a locked account with ACCOUNT_INACTIVE', async () => {
    prisma.taiKhoan.findUnique.mockResolvedValueOnce({
      ...customerAccount,
      matKhau: passwordHash,
      trangThai: 'TAM_KHOA',
    });

    const login = service.login({
      phoneNumber: customerAccount.soDienThoai,
      password: 'VexGo@123',
    });
    await expect(login).rejects.toBeInstanceOf(ForbiddenException);
    await expect(login).rejects.toMatchObject({
      response: { error: 'ACCOUNT_INACTIVE' },
    });
  });

  it('supports a seeded non-customer account without inventing a customer id', async () => {
    prisma.taiKhoan.findUnique.mockResolvedValueOnce({
      ...customerAccount,
      matKhau: passwordHash,
      khachHang: null,
      taiKhoanVaiTros: [{ vaiTro: { tenVaiTro: 'SUPER_ADMIN' } }],
    });

    await service.login({
      phoneNumber: customerAccount.soDienThoai,
      password: 'VexGo@123',
    });

    expect(tokenService.createSession).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        customerId: null,
        roles: ['SUPER_ADMIN'],
      }),
    );
  });
});

describe('TokenService refresh rotation and logout', () => {
  const jwtService = { signAsync: vi.fn() };
  const tx = {
    phienDangNhap: {
      findUnique: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
  };
  const prisma = {
    $transaction: vi.fn(async (callback) => callback(tx)),
    phienDangNhap: { findUnique: vi.fn(), updateMany: vi.fn() },
  };
  const service = new TokenService(
    jwtService as unknown as JwtService,
    new ConfigService({
      JWT_ACCESS_SECRET: 'test-only-jwt-secret-for-vexgo-unit-tests-2026',
      JWT_ACCESS_TTL_SECONDS: '900',
      REFRESH_TOKEN_TTL_SECONDS: '2592000',
    }),
    prisma as unknown as PrismaService,
  );
  const activeSession = {
    phienDangNhapId: 5,
    sessionId: '2bef8449-9f40-4753-a58d-911f628c4725',
    taiKhoanId: 42,
    refreshTokenHash: service.hashRefreshToken('old-refresh-token'),
    hetHanLuc: new Date('2026-10-28T10:00:00.000Z'),
    thuHoiLuc: null,
    tokenThayTheId: null,
    createdAt: NOW,
    updatedAt: NOW,
    taiKhoan: {
      ...customerAccount,
      matKhau: passwordHash,
    },
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.clearAllMocks();
    tx.phienDangNhap.findUnique.mockResolvedValue(activeSession);
    tx.phienDangNhap.updateMany.mockResolvedValue({ count: 1 });
    tx.phienDangNhap.create.mockResolvedValue({
      ...activeSession,
      phienDangNhapId: 6,
      sessionId: '44a6dcff-1169-4bf2-8821-a1a077ea3659',
    });
    tx.phienDangNhap.update.mockResolvedValue(activeSession);
    jwtService.signAsync.mockResolvedValue('rotated-access-token');
    prisma.phienDangNhap.findUnique.mockResolvedValue(activeSession);
    prisma.phienDangNhap.updateMany.mockResolvedValue({ count: 1 });
  });

  it('atomically revokes the old session and creates one replacement', async () => {
    const response = await service.rotateRefreshToken('old-refresh-token');

    expect(response.accessToken).toBe('rotated-access-token');
    expect(response.refreshToken).not.toBe('old-refresh-token');
    expect(tx.phienDangNhap.updateMany).toHaveBeenCalledWith({
      where: {
        phienDangNhapId: 5,
        thuHoiLuc: null,
        hetHanLuc: { gt: NOW },
      },
      data: { thuHoiLuc: NOW },
    });
    expect(tx.phienDangNhap.create).toHaveBeenCalledTimes(1);
    expect(tx.phienDangNhap.update).toHaveBeenCalledWith({
      where: { phienDangNhapId: 5 },
      data: { tokenThayTheId: 6 },
    });
  });

  it.each([
    ['unknown', null],
    [
      'expired',
      { ...activeSession, hetHanLuc: new Date('2026-09-28T09:59:59.999Z') },
    ],
    [
      'revoked',
      { ...activeSession, thuHoiLuc: new Date('2026-09-28T09:00:00.000Z') },
    ],
  ])(
    'rejects an %s refresh token without creating a session',
    async (_name, session) => {
      tx.phienDangNhap.findUnique.mockResolvedValueOnce(session);

      await expect(
        service.rotateRefreshToken('old-refresh-token'),
      ).rejects.toMatchObject({
        response: { error: 'REFRESH_TOKEN_INVALID' },
      });
      expect(tx.phienDangNhap.create).not.toHaveBeenCalled();
    },
  );

  it('rejects refresh for a locked account without issuing another session', async () => {
    tx.phienDangNhap.findUnique.mockResolvedValueOnce({
      ...activeSession,
      taiKhoan: {
        ...activeSession.taiKhoan,
        trangThai: 'TAM_KHOA',
      },
    });

    await expect(
      service.rotateRefreshToken('old-refresh-token'),
    ).rejects.toMatchObject({
      response: { error: 'ACCOUNT_INACTIVE' },
    });
    expect(tx.phienDangNhap.updateMany).not.toHaveBeenCalled();
    expect(tx.phienDangNhap.create).not.toHaveBeenCalled();
  });

  it('rejects replay after another request already claimed the old token', async () => {
    tx.phienDangNhap.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      service.rotateRefreshToken('old-refresh-token'),
    ).rejects.toMatchObject({
      response: { error: 'REFRESH_TOKEN_INVALID' },
    });
    expect(tx.phienDangNhap.create).not.toHaveBeenCalled();
  });

  it('logs out a known token idempotently but rejects a random token', async () => {
    await expect(
      service.revokeRefreshToken('old-refresh-token'),
    ).resolves.toBeUndefined();
    prisma.phienDangNhap.findUnique.mockResolvedValueOnce({
      ...activeSession,
      thuHoiLuc: NOW,
    });
    await expect(
      service.revokeRefreshToken('old-refresh-token'),
    ).resolves.toBeUndefined();
    prisma.phienDangNhap.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.revokeRefreshToken('random-token'),
    ).rejects.toMatchObject({
      response: { error: 'REFRESH_TOKEN_INVALID' },
    });
  });
});
