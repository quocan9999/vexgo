import { type INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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
import {
  SMS_SENDER,
  type SmsSender,
} from '../../../src/auth/sms/sms-sender.js';
import { configureApi } from '../../../src/common/configure-api.js';
import { PrismaService } from '../../../src/prisma/prisma.service.js';

describe('POST /api/v1/auth/register/request-otp', () => {
  let app: INestApplication;
  const taiKhoan = { findUnique: vi.fn() };
  const yeuCauOtp = {
    findUnique: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  };
  const smsSender: SmsSender = { sendOtp: vi.fn() };

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
              OTP_TTL_SECONDS: '300',
              OTP_RESEND_COOLDOWN_SECONDS: '60',
            }),
          ],
        }),
        AuthModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue({ taiKhoan, yeuCauOtp })
      .overrideProvider(SMS_SENDER)
      .useValue(smsSender)
      .compile();

    app = moduleRef.createNestApplication();
    configureApi(app);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    taiKhoan.findUnique.mockResolvedValue(null);
    yeuCauOtp.findUnique.mockResolvedValue(null);
    yeuCauOtp.create.mockImplementation(async ({ data }) => ({
      yeuCauOtpId: 1,
      ...data,
    }));
    yeuCauOtp.updateMany.mockResolvedValue({ count: 1 });
    vi.mocked(smsSender.sendOtp).mockResolvedValue(undefined);
  });

  it('creates an OTP challenge through the public API', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register/request-otp')
      .send({ phoneNumber: '+84901234567' })
      .expect(201);

    expect(response.body).toEqual({
      data: {
        challengeId: expect.any(String),
        expiresAt: expect.any(String),
        resendAfter: expect.any(String),
      },
    });
    expect(smsSender.sendOtp).toHaveBeenCalledWith({
      soDienThoai: '+84901234567',
      otp: expect.stringMatching(/^\d{6}$/),
    });
  });

  it.each([
    ['missing phone number', {}],
    ['local phone format', { phoneNumber: '0901234567' }],
    ['non-string phone number', { phoneNumber: 84901234567 }],
    ['legacy Vietnamese field', { soDienThoai: '+84901234567' }],
    ['unknown input', { phoneNumber: '+84901234567', role: 'ADMIN' }],
  ])('returns a validation envelope for %s', async (_name, payload) => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register/request-otp')
      .send(payload)
      .expect(400);

    expect(response.body).toMatchObject({
      statusCode: 400,
      error: 'VALIDATION_ERROR',
      message: 'Dữ liệu không hợp lệ.',
      details: expect.any(Array),
    });
    expect(smsSender.sendOtp).not.toHaveBeenCalled();
  });

  it('returns a stable conflict when the phone already has an account', async () => {
    taiKhoan.findUnique.mockResolvedValueOnce({ taiKhoanId: 9 });

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register/request-otp')
      .send({ phoneNumber: '+84901234567' })
      .expect(409);

    expect(response.body).toEqual({
      statusCode: 409,
      error: 'PHONE_ALREADY_REGISTERED',
      message: 'Số điện thoại đã được đăng ký.',
    });
    expect(smsSender.sendOtp).not.toHaveBeenCalled();
  });
});
