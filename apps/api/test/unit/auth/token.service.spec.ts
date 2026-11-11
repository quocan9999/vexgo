import { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TokenService } from '../../../src/auth/tokens/token.service.js';
import type { Prisma } from '../../../src/generated/prisma/client.js';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';

const NOW = new Date('2026-09-28T10:00:00.000Z');
const user = {
  accountId: 42,
  customerId: 12,
  fullName: 'Nguyễn Văn An',
  phoneNumber: '+84901234567',
  roles: ['KHACH_HANG'],
};

describe('TokenService createSession', () => {
  const jwtService = { signAsync: vi.fn() };
  const phienDangNhap = { create: vi.fn() };
  const prisma = { phienDangNhap };
  const service = new TokenService(
    jwtService as unknown as JwtService,
    new ConfigService({
      JWT_ACCESS_SECRET: 'test-only-jwt-secret-for-vexgo-unit-tests-2026',
      JWT_ACCESS_TTL_SECONDS: '900',
      REFRESH_TOKEN_TTL_SECONDS: '2592000',
    }),
    prisma as unknown as PrismaService,
  );

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.clearAllMocks();
    jwtService.signAsync.mockResolvedValue('signed-access-token');
    phienDangNhap.create.mockResolvedValue({ phienDangNhapId: 1 });
  });

  it('persists only the refresh hash and signs the required access claims', async () => {
    const response = await service.createSession(
      { phienDangNhap } as unknown as Prisma.TransactionClient,
      user,
    );

    expect(response).toEqual({
      accessToken: 'signed-access-token',
      refreshToken: expect.any(String),
      tokenType: 'Bearer',
      expiresIn: 900,
      user,
    });
    const stored = phienDangNhap.create.mock.calls[0][0].data;
    expect(stored).toMatchObject({
      sessionId: expect.any(String),
      taiKhoanId: 42,
      refreshTokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      hetHanLuc: new Date('2026-10-28T10:00:00.000Z'),
    });
    expect(stored.refreshTokenHash).not.toBe(response.refreshToken);
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      { sub: 42, sid: stored.sessionId, roles: ['KHACH_HANG'] },
      {
        secret: 'test-only-jwt-secret-for-vexgo-unit-tests-2026',
        expiresIn: 900,
        algorithm: 'HS256',
      },
    );
  });

  it('rejects an unsafe JWT secret in production', () => {
    expect(
      () =>
        new TokenService(
          jwtService as unknown as JwtService,
          new ConfigService({
            NODE_ENV: 'production',
            JWT_ACCESS_SECRET: 'too-short',
          }),
          prisma as unknown as PrismaService,
        ),
    ).toThrow('JWT_ACCESS_SECRET must contain at least 32 characters');
  });
});
