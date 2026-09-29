import { type INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
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
import { SMS_SENDER } from '../../../src/auth/sms/sms-sender.js';
import { configureApi } from '../../../src/common/configure-api.js';
import { CustomersModule } from '../../../src/customers/customers.module.js';
import { PrismaService } from '../../../src/prisma/prisma.service.js';

const NOW = new Date('2026-09-28T10:00:00.000Z');
const account = {
  taiKhoanId: 42,
  hoTen: 'Nguyễn Văn An',
  soDienThoai: '+84901234567',
  matKhau: '$2b$10$hidden',
  ngaySinh: new Date('2000-02-29T00:00:00.000Z'),
  cccd: '079123456789',
  email: 'an@example.com',
  daXacThucSoDienThoai: true,
  trangThai: 'HOAT_DONG',
  createdAt: NOW,
  updatedAt: new Date('2026-09-28T10:05:00.000Z'),
  khachHang: {
    khachHangId: 12,
    maKhachHang: 'KH00000042',
    diemTichLuy: 25,
    taiKhoanId: 42,
    createdAt: NOW,
    updatedAt: NOW,
  },
  taiKhoanVaiTros: [{ vaiTro: { tenVaiTro: 'KHACH_HANG' } }],
};

describe('GET/PATCH /api/v1/customers/me', () => {
  let app: INestApplication;
  const jwtService = { verifyAsync: vi.fn() };
  const phienDangNhap = { findUnique: vi.fn() };
  const taiKhoan = { findUnique: vi.fn(), update: vi.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              SMS_PROVIDER: 'console',
              OTP_HASH_SECRET: 'test-only-otp-secret-for-vexgo-unit-tests-2026',
              JWT_ACCESS_SECRET: 'test-only-jwt-secret-for-vexgo-unit-tests-2026',
            }),
          ],
        }),
        CustomersModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue({ phienDangNhap, taiKhoan })
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

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.clearAllMocks();
    jwtService.verifyAsync.mockResolvedValue({
      sub: 42,
      sid: '2bef8449-9f40-4753-a58d-911f628c4725',
      roles: ['KHACH_HANG'],
    });
    phienDangNhap.findUnique.mockResolvedValue({
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
    });
    taiKhoan.findUnique.mockResolvedValue(account);
    taiKhoan.update.mockResolvedValue(account);
  });

  it('returns the authenticated customer profile', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/customers/me')
      .set('Authorization', 'Bearer signed-token')
      .expect(200);

    expect(response.body).toEqual({
      data: {
        accountId: 42,
        customerId: 12,
        customerCode: 'KH00000042',
        loyaltyPoints: 25,
        fullName: 'Nguyễn Văn An',
        phoneNumber: '+84901234567',
        dateOfBirth: '2000-02-29',
        citizenId: '079123456789',
        email: 'an@example.com',
        phoneVerified: true,
        status: 'HOAT_DONG',
        createdAt: '2026-09-28T10:00:00.000Z',
        updatedAt: '2026-09-28T10:05:00.000Z',
      },
    });
    expect(taiKhoan.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { taiKhoanId: 42 } }),
    );
  });

  it.each([
    ['missing bearer token', undefined],
    ['malformed bearer token', 'Basic abc'],
  ])('rejects %s', async (_name, authorization) => {
    const call = request(app.getHttpServer()).get('/api/v1/customers/me');
    if (authorization) call.set('Authorization', authorization);
    const response = await call.expect(401);
    expect(response.body.error).toBe('ACCESS_TOKEN_INVALID');
  });

  it('rejects a token whose session has been revoked', async () => {
    phienDangNhap.findUnique.mockResolvedValueOnce({
      ...(await phienDangNhap.findUnique()),
      thuHoiLuc: NOW,
    });

    const response = await request(app.getHttpServer())
      .get('/api/v1/customers/me')
      .set('Authorization', 'Bearer signed-token')
      .expect(401);
    expect(response.body.error).toBe('ACCESS_TOKEN_INVALID');
  });

  it('rejects authenticated accounts without customer scope', async () => {
    taiKhoan.findUnique.mockResolvedValueOnce({
      ...account,
      khachHang: null,
      taiKhoanVaiTros: [{ vaiTro: { tenVaiTro: 'SUPER_ADMIN' } }],
    });

    const response = await request(app.getHttpServer())
      .get('/api/v1/customers/me')
      .set('Authorization', 'Bearer signed-token')
      .expect(403);
    expect(response.body.error).toBe('CUSTOMER_ROLE_REQUIRED');
  });

  it('updates only the account from the token and supports null clearing', async () => {
    taiKhoan.update.mockResolvedValueOnce({
      ...account,
      hoTen: 'Nguyễn Văn Bình',
      ngaySinh: null,
      email: null,
      cccd: null,
    });

    const response = await request(app.getHttpServer())
      .patch('/api/v1/customers/me')
      .set('Authorization', 'Bearer signed-token')
      .send({
        fullName: 'Nguyễn Văn Bình',
        dateOfBirth: null,
        email: null,
        citizenId: null,
      })
      .expect(200);

    expect(response.body.data).toMatchObject({
      accountId: 42,
      fullName: 'Nguyễn Văn Bình',
      dateOfBirth: null,
      email: null,
      citizenId: null,
    });
    expect(taiKhoan.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { taiKhoanId: 42 } }),
    );
  });

  it('rejects phone/id changes, unknown fields and invalid dates', async () => {
    const response = await request(app.getHttpServer())
      .patch('/api/v1/customers/me')
      .set('Authorization', 'Bearer signed-token')
      .send({
        phoneNumber: '+84909999999',
        accountId: 99,
        customerId: 99,
        dateOfBirth: '2026-02-30',
      })
      .expect(400);

    expect(response.body.error).toBe('VALIDATION_ERROR');
    expect(response.body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'phoneNumber' }),
        expect.objectContaining({ field: 'accountId' }),
        expect.objectContaining({ field: 'customerId' }),
        expect.objectContaining({ field: 'dateOfBirth' }),
      ]),
    );
    expect(taiKhoan.update).not.toHaveBeenCalled();
  });
});
