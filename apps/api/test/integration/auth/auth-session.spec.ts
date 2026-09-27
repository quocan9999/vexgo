import { type INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { AuthModule } from '../../../src/auth/auth.module.js';
import { SMS_SENDER } from '../../../src/auth/sms/sms-sender.js';
import { configureApi } from '../../../src/common/configure-api.js';
import { PrismaService } from '../../../src/prisma/prisma.service.js';

const NOW = new Date('2026-09-28T10:00:00.000Z');
const PHONE = '+84901234567';
const OLD_REFRESH_TOKEN = 'old-refresh-token';
let passwordHash: string;

describe('Auth login, refresh and logout HTTP contract', () => {
  let app: INestApplication;
  const taiKhoan = { findUnique: vi.fn() };
  const directSessions = { findUnique: vi.fn(), updateMany: vi.fn() };
  const txSessions = {
    findUnique: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
  };
  const tx = { phienDangNhap: txSessions };
  const prisma = {
    taiKhoan,
    phienDangNhap: directSessions,
    $transaction: vi.fn(async (callback) => callback(tx)),
  };
  const jwtService = { signAsync: vi.fn() };

  beforeAll(async () => {
    passwordHash = await bcrypt.hash('VexGo@123', 4);
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              SMS_PROVIDER: 'console',
              OTP_HASH_SECRET: 'integration-test-otp-secret',
              JWT_ACCESS_SECRET: 'integration-test-access-secret',
              JWT_ACCESS_TTL_SECONDS: '900',
              REFRESH_TOKEN_TTL_SECONDS: '2592000',
            }),
          ],
        }),
        AuthModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(JwtService)
      .useValue(jwtService)
      .overrideProvider(SMS_SENDER)
      .useValue({ sendOtp: vi.fn() })
      .compile();

    app = moduleRef.createNestApplication();
    configureApi(app);
    await app.init();
  });

  afterAll(async () => {
    vi.useRealTimers();
    await app?.close();
  });

  function account(overrides: Record<string, unknown> = {}) {
    return {
      taiKhoanId: 42,
      hoTen: 'Nguyễn Văn An',
      soDienThoai: PHONE,
      matKhau: passwordHash,
      ngaySinh: null,
      cccd: null,
      email: null,
      daXacThucSoDienThoai: true,
      trangThai: 'HOAT_DONG',
      createdAt: NOW,
      updatedAt: NOW,
      khachHang: { khachHangId: 12 },
      taiKhoanVaiTros: [{ vaiTro: { tenVaiTro: 'KHACH_HANG' } }],
      ...overrides,
    };
  }

  function session(overrides: Record<string, unknown> = {}) {
    return {
      phienDangNhapId: 5,
      sessionId: '2bef8449-9f40-4753-a58d-911f628c4725',
      taiKhoanId: 42,
      refreshTokenHash: '',
      hetHanLuc: new Date('2026-10-28T10:00:00.000Z'),
      thuHoiLuc: null,
      tokenThayTheId: null,
      createdAt: NOW,
      updatedAt: NOW,
      taiKhoan: account(),
      ...overrides,
    };
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.clearAllMocks();
    taiKhoan.findUnique.mockResolvedValue(account());
    txSessions.findUnique.mockResolvedValue(session());
    txSessions.updateMany.mockResolvedValue({ count: 1 });
    txSessions.create.mockResolvedValue(
      session({
        phienDangNhapId: 6,
        sessionId: '44a6dcff-1169-4bf2-8821-a1a077ea3659',
      }),
    );
    txSessions.update.mockResolvedValue(session());
    directSessions.findUnique.mockResolvedValue(session());
    directSessions.updateMany.mockResolvedValue({ count: 1 });
    jwtService.signAsync.mockResolvedValue('signed-access-token');
  });

  it('returns the token envelope for valid credentials', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ soDienThoai: PHONE, matKhau: 'VexGo@123' })
      .expect(200);

    expect(response.body).toEqual({
      data: {
        accessToken: 'signed-access-token',
        refreshToken: expect.any(String),
        tokenType: 'Bearer',
        expiresIn: 900,
        user: {
          taiKhoanId: 42,
          khachHangId: 12,
          hoTen: 'Nguyễn Văn An',
          soDienThoai: PHONE,
          roles: ['KHACH_HANG'],
        },
      },
    });
  });

  it.each([
    ['unknown phone', null, 'VexGo@123'],
    ['wrong password', account(), 'wrong-password'],
  ])(
    'returns the same INVALID_CREDENTIALS response for %s',
    async (_name, stored, matKhau) => {
      taiKhoan.findUnique.mockResolvedValueOnce(stored);

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ soDienThoai: PHONE, matKhau })
        .expect(401);

      expect(response.body).toEqual({
        statusCode: 401,
        error: 'INVALID_CREDENTIALS',
        message: 'Số điện thoại hoặc mật khẩu không chính xác.',
      });
    },
  );

  it('returns ACCOUNT_INACTIVE for a locked account', async () => {
    taiKhoan.findUnique.mockResolvedValueOnce(account({ trangThai: 'KHOA' }));

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ soDienThoai: PHONE, matKhau: 'VexGo@123' })
      .expect(403);

    expect(response.body.error).toBe('ACCOUNT_INACTIVE');
  });

  it('rotates refresh tokens and rejects replay of the old token', async () => {
    txSessions.findUnique
      .mockResolvedValueOnce(session())
      .mockResolvedValueOnce(session({ thuHoiLuc: NOW }));

    const rotated = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: OLD_REFRESH_TOKEN })
      .expect(200);

    expect(rotated.body.data).toMatchObject({
      accessToken: 'signed-access-token',
      refreshToken: expect.any(String),
      tokenType: 'Bearer',
    });
    expect(rotated.body.data.refreshToken).not.toBe(OLD_REFRESH_TOKEN);

    const replay = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: OLD_REFRESH_TOKEN })
      .expect(401);
    expect(replay.body.error).toBe('REFRESH_TOKEN_INVALID');
  });

  it('returns 204 for first and repeated logout of a known token', async () => {
    directSessions.findUnique
      .mockResolvedValueOnce(session())
      .mockResolvedValueOnce(session({ thuHoiLuc: NOW }));

    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .send({ refreshToken: OLD_REFRESH_TOKEN })
      .expect(204);
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .send({ refreshToken: OLD_REFRESH_TOKEN })
      .expect(204);
  });

  it('rejects random refresh tokens and malformed bodies', async () => {
    directSessions.findUnique.mockResolvedValueOnce(null);
    const unknown = await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .send({ refreshToken: 'random-token' })
      .expect(401);
    expect(unknown.body.error).toBe('REFRESH_TOKEN_INVALID');

    const malformed = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: '' })
      .expect(400);
    expect(malformed.body.error).toBe('VALIDATION_ERROR');
  });
});
