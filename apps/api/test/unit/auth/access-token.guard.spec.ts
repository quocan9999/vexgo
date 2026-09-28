import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ExecutionContext } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccessTokenGuard } from '../../../src/auth/guards/access-token.guard.js';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';

const NOW = new Date('2026-09-28T10:00:00.000Z');
const request: { headers: { authorization?: string }; user?: unknown } = {
  headers: {},
};
const context = {
  switchToHttp: () => ({ getRequest: () => request }),
} as ExecutionContext;
const jwtService = { verifyAsync: vi.fn() };
const prisma = { phienDangNhap: { findUnique: vi.fn() } };
const guard = new AccessTokenGuard(
  jwtService as unknown as JwtService,
  new ConfigService({
    JWT_ACCESS_SECRET: 'test-only-jwt-secret-for-vexgo-unit-tests-2026',
  }),
  prisma as unknown as PrismaService,
);

function activeSession(overrides: Record<string, unknown> = {}) {
  return {
    phienDangNhapId: 1,
    sessionId: '2bef8449-9f40-4753-a58d-911f628c4725',
    taiKhoanId: 42,
    refreshTokenHash: 'hash',
    hetHanLuc: new Date('2026-10-28T10:00:00.000Z'),
    thuHoiLuc: null,
    tokenThayTheId: null,
    createdAt: NOW,
    updatedAt: NOW,
    taiKhoan: {
      taiKhoanId: 42,
      trangThai: 'HOAT_DONG',
      taiKhoanVaiTros: [{ vaiTro: { tenVaiTro: 'KHACH_HANG' } }],
    },
    ...overrides,
  };
}

describe('AccessTokenGuard', () => {
  it('fails closed when the JWT secret is missing', () => {
    expect(
      () =>
        new AccessTokenGuard(
          jwtService as unknown as JwtService,
          new ConfigService({ JWT_ACCESS_SECRET: '' }),
          prisma as unknown as PrismaService,
        ),
    ).toThrow('JWT_ACCESS_SECRET must contain at least 32 characters');
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.clearAllMocks();
    request.headers = { authorization: 'Bearer signed-token' };
    delete request.user;
    jwtService.verifyAsync.mockResolvedValue({
      sub: 42,
      sid: '2bef8449-9f40-4753-a58d-911f628c4725',
      roles: ['KHACH_HANG'],
    });
    prisma.phienDangNhap.findUnique.mockResolvedValue(activeSession());
  });

  it.each([
    ['missing header', undefined],
    ['wrong scheme', 'Basic abc'],
    ['missing token', 'Bearer '],
    ['extra token segment', 'Bearer one two'],
  ])('rejects %s', async (_name, authorization) => {
    request.headers.authorization = authorization;

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it.each(['expired token', 'wrong signature'])(
    'maps %s verification failures to ACCESS_TOKEN_INVALID',
    async () => {
      jwtService.verifyAsync.mockRejectedValueOnce(new Error('jwt invalid'));

      await expect(guard.canActivate(context)).rejects.toMatchObject({
        response: { error: 'ACCESS_TOKEN_INVALID' },
      });
    },
  );

  it.each([
    ['missing session', null],
    ['revoked session', activeSession({ thuHoiLuc: NOW })],
    [
      'expired session',
      activeSession({ hetHanLuc: new Date('2026-09-28T09:59:59.999Z') }),
    ],
  ])('rejects a valid JWT with %s', async (_name, session) => {
    prisma.phienDangNhap.findUnique.mockResolvedValueOnce(session);

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      response: { error: 'ACCESS_TOKEN_INVALID' },
    });
  });

  it('rejects an active session whose account is locked', async () => {
    prisma.phienDangNhap.findUnique.mockResolvedValueOnce(
      activeSession({
        taiKhoan: {
          taiKhoanId: 42,
          trangThai: 'KHOA',
          taiKhoanVaiTros: [{ vaiTro: { tenVaiTro: 'KHACH_HANG' } }],
        },
      }),
    );

    const activation = guard.canActivate(context);
    await expect(activation).rejects.toBeInstanceOf(ForbiddenException);
    await expect(activation).rejects.toMatchObject({
      response: { error: 'ACCOUNT_INACTIVE' },
    });
  });

  it('attaches a principal using current database roles', async () => {
    jwtService.verifyAsync.mockResolvedValueOnce({
      sub: 42,
      sid: '2bef8449-9f40-4753-a58d-911f628c4725',
      roles: ['STALE_ROLE'],
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({
      taiKhoanId: 42,
      sessionId: '2bef8449-9f40-4753-a58d-911f628c4725',
      roles: ['KHACH_HANG'],
    });
    expect(jwtService.verifyAsync).toHaveBeenCalledWith('signed-token', {
      secret: 'test-only-jwt-secret-for-vexgo-unit-tests-2026',
      algorithms: ['HS256'],
    });
  });
});
