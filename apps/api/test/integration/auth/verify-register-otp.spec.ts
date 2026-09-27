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
import { OtpCryptoService } from '../../../src/auth/otp/otp-crypto.service.js';
import { SMS_SENDER } from '../../../src/auth/sms/sms-sender.js';
import { configureApi } from '../../../src/common/configure-api.js';
import type { YeuCauOtp } from '../../../src/generated/prisma/client.js';
import { PrismaService } from '../../../src/prisma/prisma.service.js';

const NOW = new Date('2026-09-28T10:00:00.000Z');
const CHALLENGE_ID = 'b9a4fbcb-fef7-4bc8-8601-7205df054291';
const PHONE = '+84901234567';
const OTP = '123456';

describe('POST /api/v1/auth/register/verify-otp', () => {
  let app: INestApplication;
  let cryptoService: OtpCryptoService;
  let currentChallenge: YeuCauOtp;
  const taiKhoan = { findUnique: vi.fn() };
  const yeuCauOtp = {
    findUnique: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  };

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
              OTP_PROOF_TTL_SECONDS: '600',
            }),
          ],
        }),
        AuthModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue({ taiKhoan, yeuCauOtp })
      .overrideProvider(SMS_SENDER)
      .useValue({ sendOtp: vi.fn() })
      .compile();

    cryptoService = moduleRef.get(OtpCryptoService);
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
    currentChallenge = {
      yeuCauOtpId: 1,
      challengeId: CHALLENGE_ID,
      soDienThoai: PHONE,
      mucDich: 'DANG_KY',
      maOtpHash: cryptoService.hashOtp(CHALLENGE_ID, OTP),
      soLanThu: 0,
      hetHanLuc: new Date('2026-09-28T10:05:00.000Z'),
      daXacThucLuc: null,
      proofHash: null,
      proofHetHanLuc: null,
      daSuDungLuc: null,
      createdAt: NOW,
      updatedAt: NOW,
    };
    yeuCauOtp.findUnique.mockImplementation(async () => currentChallenge);
    yeuCauOtp.updateMany.mockResolvedValue({ count: 1 });
  });

  function send(payload: Record<string, unknown>) {
    return request(app.getHttpServer())
      .post('/api/v1/auth/register/verify-otp')
      .send(payload);
  }

  it('returns a one-time proof for a valid OTP', async () => {
    const response = await send({
      challengeId: CHALLENGE_ID,
      soDienThoai: PHONE,
      otp: OTP,
    }).expect(201);

    expect(response.body).toEqual({
      data: {
        otpProof: expect.any(String),
        expiresAt: '2026-09-28T10:10:00.000Z',
      },
    });
    expect(response.body.data.otpProof).not.toBe(
      yeuCauOtp.updateMany.mock.calls[0][0].data.proofHash,
    );
  });

  it.each([
    ['missing OTP', { challengeId: CHALLENGE_ID, soDienThoai: PHONE }],
    [
      'invalid challenge',
      { challengeId: 'not-a-uuid', soDienThoai: PHONE, otp: OTP },
    ],
    [
      'invalid phone',
      { challengeId: CHALLENGE_ID, soDienThoai: '0901234567', otp: OTP },
    ],
    [
      'invalid OTP format',
      { challengeId: CHALLENGE_ID, soDienThoai: PHONE, otp: '12345' },
    ],
    [
      'unknown field',
      {
        challengeId: CHALLENGE_ID,
        soDienThoai: PHONE,
        otp: OTP,
        role: 'ADMIN',
      },
    ],
  ])('returns VALIDATION_ERROR for %s', async (_name, payload) => {
    const response = await send(payload).expect(400);

    expect(response.body).toMatchObject({
      statusCode: 400,
      error: 'VALIDATION_ERROR',
      message: 'Dữ liệu không hợp lệ.',
      details: expect.any(Array),
    });
  });

  it('returns OTP_INVALID and records a wrong attempt', async () => {
    const response = await send({
      challengeId: CHALLENGE_ID,
      soDienThoai: PHONE,
      otp: '999999',
    }).expect(400);

    expect(response.body).toEqual({
      statusCode: 400,
      error: 'OTP_INVALID',
      message: 'Mã OTP không hợp lệ.',
    });
    expect(yeuCauOtp.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { soLanThu: { increment: 1 } } }),
    );
  });

  it('returns OTP_EXPIRED for an expired challenge', async () => {
    currentChallenge.hetHanLuc = new Date('2026-09-28T09:59:59.999Z');

    const response = await send({
      challengeId: CHALLENGE_ID,
      soDienThoai: PHONE,
      otp: OTP,
    }).expect(400);

    expect(response.body.error).toBe('OTP_EXPIRED');
  });

  it('returns OTP_ATTEMPTS_EXCEEDED after five wrong attempts', async () => {
    currentChallenge.soLanThu = 5;

    const response = await send({
      challengeId: CHALLENGE_ID,
      soDienThoai: PHONE,
      otp: OTP,
    }).expect(400);

    expect(response.body.error).toBe('OTP_ATTEMPTS_EXCEEDED');
  });
});
