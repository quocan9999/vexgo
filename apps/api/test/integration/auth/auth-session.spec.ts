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
  const vaiTroQuyen = { findMany: vi.fn() };
  const cauHinhQuyenVaiTroNhaXe = { findMany: vi.fn() };
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
    vaiTroQuyen,
    cauHinhQuyenVaiTroNhaXe,
    phienDangNhap: directSessions,
    $transaction: vi.fn(async (callback) => callback(tx)),
  };
  const jwtService = { signAsync: vi.fn(), verifyAsync: vi.fn() };

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
              OTP_HASH_SECRET: 'test-only-otp-secret-for-vexgo-unit-tests-2026',
              JWT_ACCESS_SECRET:
                'test-only-jwt-secret-for-vexgo-unit-tests-2026',
              JWT_ACCESS_TTL_SECONDS: '900',
              REFRESH_TOKEN_TTL_SECONDS: '2592000',
              CORS_ALLOWED_ORIGINS:
                'http://localhost:3000,http://localhost:3001',
              ADMIN_AUTH_COOKIE_ALLOWED_ORIGINS: 'http://localhost:3001',
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
      taiKhoanVaiTros: [{ vaiTro: { vaiTroId: 4, tenVaiTro: 'KHACH_HANG' } }],
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
    vaiTroQuyen.findMany.mockResolvedValue([]);
    cauHinhQuyenVaiTroNhaXe.findMany.mockResolvedValue([]);
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
    jwtService.verifyAsync.mockResolvedValue({
      sub: 42,
      sid: '2bef8449-9f40-4753-a58d-911f628c4725',
      roles: ['NHA_XE_ADMIN'],
    });
  });

  it('returns the token envelope for valid credentials', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phoneNumber: PHONE, password: 'VexGo@123' })
      .expect(200);

    expect(response.body).toEqual({
      data: {
        accessToken: 'signed-access-token',
        refreshToken: expect.any(String),
        tokenType: 'Bearer',
        expiresIn: 900,
        user: {
          accountId: 42,
          customerId: 12,
          fullName: 'Nguyễn Văn An',
          phoneNumber: PHONE,
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
    async (_name, stored, password) => {
      taiKhoan.findUnique.mockResolvedValueOnce(stored);

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ phoneNumber: PHONE, password })
        .expect(401);

      expect(response.body).toEqual({
        statusCode: 401,
        error: 'INVALID_CREDENTIALS',
        message: 'Thông tin đăng nhập không chính xác.',
      });
    },
  );

  it('logs in through a normalized email identifier without changing the token contract', async () => {
    taiKhoan.findUnique.mockResolvedValueOnce(
      account({
        email: 'admin@example.com',
        khachHang: null,
        taiKhoanVaiTros: [
          { vaiTro: { vaiTroId: 2, tenVaiTro: 'NHA_XE_ADMIN' } },
        ],
      }),
    );

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ identifier: '  ADMIN@EXAMPLE.COM ', password: 'VexGo@123' })
      .expect(200);

    expect(taiKhoan.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'admin@example.com' } }),
    );
    expect(response.body.data.user.roles).toEqual(['NHA_XE_ADMIN']);
    expect(response.body.data.refreshToken).toEqual(expect.any(String));
  });

  it('stores Admin refresh token in an HttpOnly cookie and omits it from JSON', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Origin', 'http://localhost:3001')
      .set('X-Refresh-Token-Transport', 'cookie')
      .send({ identifier: 'admin@example.com', password: 'VexGo@123' })
      .expect(200);

    expect(response.body.data).toMatchObject({
      accessToken: 'signed-access-token',
      tokenType: 'Bearer',
      expiresIn: 900,
    });
    expect(response.body.data).not.toHaveProperty('refreshToken');
    const cookie = response.headers['set-cookie']?.[0] ?? '';
    expect(cookie).toContain('vexgo_admin_refresh=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Path=/api/v1/auth');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).not.toContain('Domain=');
  });

  it('rejects cookie transport from missing, unlisted, or non-Admin allowed CORS origins', async () => {
    const callsBefore = taiKhoan.findUnique.mock.calls.length;
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-Refresh-Token-Transport', 'cookie')
      .send({ identifier: 'admin@example.com', password: 'VexGo@123' })
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Origin', 'https://evil.example')
      .set('X-Refresh-Token-Transport', 'cookie')
      .send({})
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Origin', 'http://localhost:3000')
      .set('X-Refresh-Token-Transport', 'cookie')
      .send({ identifier: 'admin@example.com', password: 'VexGo@123' })
      .expect(403);
    expect(taiKhoan.findUnique).toHaveBeenCalledTimes(callsBefore);
  });

  it('rotates refresh cookie, rejects mixed transport, and clears it on logout', async () => {
    const cookieToken = 'old-refresh-token';
    const rotated = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Origin', 'http://localhost:3001')
      .set('X-Refresh-Token-Transport', 'cookie')
      .set('Cookie', `vexgo_admin_refresh=${cookieToken}`)
      .send({})
      .expect(200);
    expect(rotated.body.data).not.toHaveProperty('refreshToken');
    expect(rotated.headers['set-cookie']?.[0]).toContain(
      'vexgo_admin_refresh=',
    );
    expect(txSessions.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { refreshTokenHash: expect.any(String) },
      }),
    );

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Origin', 'http://localhost:3001')
      .set('X-Refresh-Token-Transport', 'cookie')
      .set('Cookie', `vexgo_admin_refresh=${cookieToken}`)
      .send({ refreshToken: cookieToken })
      .expect(400);

    directSessions.findUnique.mockResolvedValueOnce(session());
    const logout = await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Origin', 'http://localhost:3001')
      .set('X-Refresh-Token-Transport', 'cookie')
      .set('Cookie', `vexgo_admin_refresh=${cookieToken}`)
      .send({})
      .expect(204);
    expect(directSessions.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { phienDangNhapId: 5, thuHoiLuc: null },
      }),
    );
    expect(logout.headers['set-cookie']?.[0]).toContain(
      'vexgo_admin_refresh=;',
    );
  });

  it('returns trusted session identity and tenant scope from the account record', async () => {
    const operatorAccount = account({
      email: 'futa-admin@example.com',
      khachHang: null,
      nhanVien: {
        nhanVienId: 8,
        nhaXeId: 21,
        nhaXe: { maNhaXe: 'FUTA', tenNhaXe: 'FUTA' },
      },
      taiKhoanVaiTros: [
        {
          vaiTro: {
            vaiTroId: 2,
            tenVaiTro: 'NHA_XE_ADMIN',
            vaiTroQuyens: [],
          },
        },
      ],
    });
    vaiTroQuyen.findMany.mockResolvedValue([
      { vaiTroId: 2, quyen: { tenQuyen: 'vehicle:read' } },
      { vaiTroId: 2, quyen: { tenQuyen: 'route:read' } },
    ]);
    cauHinhQuyenVaiTroNhaXe.findMany.mockResolvedValue([
      {
        vaiTroId: 2,
        chiTiets: [{ quyen: { tenQuyen: 'route:read' } }],
      },
    ]);
    directSessions.findUnique.mockResolvedValueOnce(
      session({ taiKhoan: operatorAccount }),
    );
    taiKhoan.findUnique.mockResolvedValueOnce(operatorAccount);

    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/session')
      .set('Authorization', 'Bearer signed-access-token')
      .expect(200);

    expect(response.body.data).toMatchObject({
      accountId: 42,
      email: 'futa-admin@example.com',
      roles: ['NHA_XE_ADMIN'],
      permissions: ['route:read'],
      busCompanyId: 21,
      employee: {
        employeeId: 8,
        busCompanyId: 21,
        busCompanyCode: 'FUTA',
      },
    });
    expect(vaiTroQuyen.findMany).toHaveBeenCalledTimes(2);
    expect(cauHinhQuyenVaiTroNhaXe.findMany).toHaveBeenCalledTimes(2);
    expect(cauHinhQuyenVaiTroNhaXe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { nhaXeId: 21, vaiTroId: { in: [2] } },
      }),
    );
    expect(response.body.data).not.toHaveProperty('matKhau');
  });

  it('requires an access token to read the current session', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/session')
      .expect(401);
    expect(response.body.error).toBe('ACCESS_TOKEN_INVALID');
  });

  it('does not clear the refresh cookie when logout cannot reach persistence', async () => {
    directSessions.findUnique.mockRejectedValueOnce(
      new Error('database offline'),
    );

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Origin', 'http://localhost:3001')
      .set('X-Refresh-Token-Transport', 'cookie')
      .set('Cookie', 'vexgo_admin_refresh=old-refresh-token')
      .send({})
      .expect(500);

    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it.each([
    ['no identifier', { password: 'VexGo@123' }],
    [
      'both identifier fields',
      {
        phoneNumber: PHONE,
        identifier: 'admin@example.com',
        password: 'VexGo@123',
      },
    ],
    ['bad email', { identifier: 'not-an-email', password: 'VexGo@123' }],
    ['password too long', { identifier: PHONE, password: 'x'.repeat(73) }],
  ])(
    'rejects login request with %s before querying accounts',
    async (_case, body) => {
      const callsBefore = taiKhoan.findUnique.mock.calls.length;
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send(body)
        .expect(400);

      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(taiKhoan.findUnique).toHaveBeenCalledTimes(callsBefore);
    },
  );

  it('returns ACCOUNT_INACTIVE for a locked account', async () => {
    taiKhoan.findUnique.mockResolvedValueOnce(
      account({ trangThai: 'TAM_KHOA' }),
    );

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phoneNumber: PHONE, password: 'VexGo@123' })
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

  it('does not clear the winning rotated cookie when another tab replays the old refresh token', async () => {
    txSessions.findUnique.mockResolvedValueOnce(session({ thuHoiLuc: NOW }));

    const replay = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Origin', 'http://localhost:3001')
      .set('X-Refresh-Token-Transport', 'cookie')
      .set('Cookie', `vexgo_admin_refresh=${OLD_REFRESH_TOKEN}`)
      .send({})
      .expect(401);

    expect(replay.body.error).toBe('REFRESH_TOKEN_INVALID');
    expect(replay.headers['set-cookie']).toBeUndefined();
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
