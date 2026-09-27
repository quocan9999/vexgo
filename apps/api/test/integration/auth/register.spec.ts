import { BadRequestException, type INestApplication } from '@nestjs/common';
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
import { AuthModule } from '../../../src/auth/auth.module.js';
import { OtpService } from '../../../src/auth/otp/otp.service.js';
import { SMS_SENDER } from '../../../src/auth/sms/sms-sender.js';
import { configureApi } from '../../../src/common/configure-api.js';
import { Prisma } from '../../../src/generated/prisma/client.js';
import { PrismaService } from '../../../src/prisma/prisma.service.js';

const NOW = new Date('2026-09-28T10:00:00.000Z');
const validPayload = {
  otpProof: 'verified-one-time-proof',
  hoTen: 'Nguyễn Văn An',
  soDienThoai: '+84901234567',
  matKhau: 'VexGo@123',
  email: 'an@example.com',
  cccd: '079123456789',
  ngaySinh: '2000-02-29',
};
const account = {
  taiKhoanId: 42,
  hoTen: validPayload.hoTen,
  soDienThoai: validPayload.soDienThoai,
  matKhau: '$2b$10$hashed',
  ngaySinh: new Date('2000-02-29T00:00:00.000Z'),
  cccd: validPayload.cccd,
  email: validPayload.email,
  daXacThucSoDienThoai: true,
  trangThai: 'HOAT_DONG',
  createdAt: NOW,
  updatedAt: NOW,
};
const tx = {
  yeuCauOtp: { updateMany: vi.fn() },
  taiKhoan: { findUnique: vi.fn(), create: vi.fn() },
  khachHang: { create: vi.fn() },
  vaiTro: { findUnique: vi.fn() },
  taiKhoanVaiTro: { create: vi.fn() },
  phienDangNhap: { create: vi.fn() },
};
const prisma = {
  $transaction: vi.fn(async (callback) => callback(tx)),
};
const otpService = {
  requestRegistrationOtp: vi.fn(),
  verifyRegistrationOtp: vi.fn(),
  consumeRegistrationProof: vi.fn(),
};
const jwtService = { signAsync: vi.fn() };

function uniquePhoneError() {
  return new Prisma.PrismaClientKnownRequestError('duplicate phone', {
    code: 'P2002',
    clientVersion: '7.10.0',
    meta: { target: ['soDienThoai'] },
  });
}

describe('POST /api/v1/auth/register', () => {
  let app: INestApplication;

  beforeAll(async () => {
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
      .overrideProvider(OtpService)
      .useValue(otpService)
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
    otpService.consumeRegistrationProof.mockResolvedValue(undefined);
    tx.taiKhoan.findUnique.mockResolvedValue(null);
    tx.taiKhoan.create.mockImplementation(async ({ data }) => ({
      ...account,
      ...data,
    }));
    tx.vaiTro.findUnique.mockResolvedValue({
      vaiTroId: 7,
      tenVaiTro: 'KHACH_HANG',
    });
    tx.khachHang.create.mockResolvedValue({
      khachHangId: 12,
      maKhachHang: 'KH00000042',
      diemTichLuy: 0,
      taiKhoanId: 42,
    });
    tx.taiKhoanVaiTro.create.mockResolvedValue({});
    tx.phienDangNhap.create.mockResolvedValue({ phienDangNhapId: 1 });
    jwtService.signAsync.mockResolvedValue('signed-access-token');
  });

  it('registers a verified customer and returns sanitized tokens', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(validPayload)
      .expect(201);

    expect(response.body).toEqual({
      data: {
        accessToken: 'signed-access-token',
        refreshToken: expect.any(String),
        tokenType: 'Bearer',
        expiresIn: 900,
        user: {
          taiKhoanId: 42,
          khachHangId: 12,
          hoTen: validPayload.hoTen,
          soDienThoai: validPayload.soDienThoai,
          roles: ['KHACH_HANG'],
        },
      },
    });
    expect(JSON.stringify(response.body)).not.toContain('matKhau');
    expect(JSON.stringify(response.body)).not.toContain('refreshTokenHash');
  });

  it('returns OTP_PROOF_INVALID when a proof is replayed', async () => {
    otpService.consumeRegistrationProof.mockRejectedValueOnce(
      new BadRequestException({
        error: 'OTP_PROOF_INVALID',
        message: 'Bằng chứng xác thực OTP không hợp lệ hoặc đã hết hạn.',
      }),
    );

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(validPayload)
      .expect(400);

    expect(response.body.error).toBe('OTP_PROOF_INVALID');
    expect(tx.taiKhoan.create).not.toHaveBeenCalled();
  });

  it('maps a concurrent unique phone constraint to PHONE_ALREADY_REGISTERED', async () => {
    tx.taiKhoan.create.mockRejectedValueOnce(uniquePhoneError());

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(validPayload)
      .expect(409);

    expect(response.body.error).toBe('PHONE_ALREADY_REGISTERED');
    expect(tx.phienDangNhap.create).not.toHaveBeenCalled();
  });

  it('rejects missing proof, invalid date and unknown role input', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        ...validPayload,
        otpProof: undefined,
        ngaySinh: '2026-02-30',
        role: 'ADMIN',
      })
      .expect(400);

    expect(response.body).toMatchObject({
      statusCode: 400,
      error: 'VALIDATION_ERROR',
      details: expect.arrayContaining([
        expect.objectContaining({ field: 'otpProof' }),
        expect.objectContaining({ field: 'ngaySinh' }),
        expect.objectContaining({ field: 'role' }),
      ]),
    });
  });
});
