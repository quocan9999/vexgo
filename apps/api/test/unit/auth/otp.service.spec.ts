import { ConfigService } from '@nestjs/config';
import { ConflictException } from '@nestjs/common';
import { Prisma } from '../../../src/generated/prisma/client.js';
import { PrismaService } from '../../../src/prisma/prisma.service.js';
import { OtpCryptoService } from '../../../src/auth/otp/otp-crypto.service.js';
import { OtpService } from '../../../src/auth/otp/otp.service.js';
import type { SmsSender } from '../../../src/auth/sms/sms-sender.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-28T00:00:00.000Z');

const prismaMock = {
  taiKhoan: {
    findUnique: vi.fn(),
  },
  yeuCauOtp: {
    findUnique: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  },
};
const prisma = prismaMock as unknown as PrismaService;

const sentMessages: Array<{ soDienThoai: string; otp: string }> = [];
const smsSender: SmsSender = {
  sendOtp: vi.fn(async (input) => {
    sentMessages.push(input);
  }),
};

const config = new ConfigService({
  OTP_HASH_SECRET: 'test-otp-secret-with-enough-entropy',
  OTP_TTL_SECONDS: '300',
  OTP_RESEND_COOLDOWN_SECONDS: '60',
});

const cryptoService = new OtpCryptoService(config);
const service = new OtpService(prisma, cryptoService, smsSender, config);

function uniqueConstraintError() {
  return new Prisma.PrismaClientKnownRequestError('duplicate challenge', {
    code: 'P2002',
    clientVersion: '7.10.0',
    meta: { target: ['soDienThoai', 'mucDich'] },
  });
}

describe('OtpCryptoService', () => {
  it('generates a six-digit OTP and stores only a verifiable hash', () => {
    const otp = cryptoService.generateOtp();
    const hash = cryptoService.hashOtp('challenge-1', otp);

    expect(otp).toMatch(/^\d{6}$/);
    expect(hash).not.toContain(otp);
    expect(cryptoService.matchesOtp('challenge-1', otp, hash)).toBe(true);
    expect(cryptoService.matchesOtp('challenge-1', '000000', hash)).toBe(
      otp === '000000',
    );
  });
});

describe('OtpService requestRegistrationOtp', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.clearAllMocks();
    sentMessages.length = 0;
    prismaMock.taiKhoan.findUnique.mockResolvedValue(null);
    prismaMock.yeuCauOtp.findUnique.mockResolvedValue(null);
    prismaMock.yeuCauOtp.create.mockImplementation(async ({ data }) => ({
      yeuCauOtpId: 1,
      ...data,
    }));
    prismaMock.yeuCauOtp.updateMany.mockResolvedValue({ count: 1 });
  });

  it('persists a challenge and sends exactly one OTP', async () => {
    const result = await service.requestRegistrationOtp('+84901234567');

    expect(result).toEqual({
      challengeId: expect.any(String),
      expiresAt: '2026-09-28T00:05:00.000Z',
      resendAfter: '2026-09-28T00:01:00.000Z',
    });
    expect(sentMessages).toHaveLength(1);
    expect(sentMessages[0]).toMatchObject({
      soDienThoai: '+84901234567',
      otp: expect.stringMatching(/^\d{6}$/),
    });
    const createInput = prismaMock.yeuCauOtp.create.mock.calls[0][0];
    expect(createInput.data.maOtpHash).not.toBe(sentMessages[0].otp);
  });

  it('rejects a phone number that already has an account', async () => {
    prismaMock.taiKhoan.findUnique.mockResolvedValue({ taiKhoanId: 43 });

    await expect(
      service.requestRegistrationOtp('+84901234567'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(sentMessages).toEqual([]);
  });

  it('rejects resend during the 60-second cooldown', async () => {
    prismaMock.yeuCauOtp.findUnique.mockResolvedValue({
      yeuCauOtpId: 1,
      challengeId: 'existing-challenge',
      soDienThoai: '+84901234567',
      mucDich: 'DANG_KY',
      maOtpHash: 'hash',
      soLanThu: 0,
      hetHanLuc: new Date('2026-09-28T00:05:00.000Z'),
      daXacThucLuc: null,
      proofHash: null,
      proofHetHanLuc: null,
      daSuDungLuc: null,
      createdAt: new Date('2026-09-28T00:00:00.000Z'),
      updatedAt: new Date('2026-09-28T00:00:00.000Z'),
    });

    await expect(
      service.requestRegistrationOtp('+84901234567'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(sentMessages).toEqual([]);
  });

  it('allows only one of two concurrent first requests to send an OTP', async () => {
    prismaMock.yeuCauOtp.create
      .mockImplementationOnce(async ({ data }) => ({
        yeuCauOtpId: 1,
        ...data,
      }))
      .mockRejectedValueOnce(uniqueConstraintError());

    const results = await Promise.allSettled([
      service.requestRegistrationOtp('+84901234567'),
      service.requestRegistrationOtp('+84901234567'),
    ]);

    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(
      1,
    );
    expect(results.filter(({ status }) => status === 'rejected')).toHaveLength(
      1,
    );
    expect(sentMessages).toHaveLength(1);
  });
});
