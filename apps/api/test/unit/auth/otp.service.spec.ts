import { ConfigService } from '@nestjs/config';
import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
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
    deleteMany: vi.fn(),
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
  OTP_HASH_SECRET: 'test-only-otp-secret-for-vexgo-unit-tests-2026',
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
  it('fails closed when the OTP hash secret is missing or unsafe', () => {
    expect(
      () => new OtpCryptoService(new ConfigService({ OTP_HASH_SECRET: '' })),
    ).toThrow('OTP_HASH_SECRET must contain at least 32 characters');
  });

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

  it('removes a newly-created challenge when SMS delivery fails', async () => {
    vi.mocked(smsSender.sendOtp).mockRejectedValueOnce(
      new Error('SMS provider unavailable'),
    );

    const deliveryError = await service
      .requestRegistrationOtp('+84901234567')
      .then(() => null, (error: unknown) => error);
    expect(deliveryError).toBeInstanceOf(ServiceUnavailableException);
    expect(
      (deliveryError as ServiceUnavailableException).getResponse(),
    ).toEqual({
      error: 'OTP_DELIVERY_FAILED',
      message: 'Không thể gửi mã OTP. Vui lòng thử lại.',
    });

    const created = prismaMock.yeuCauOtp.create.mock.calls[0][0];
    expect(prismaMock.yeuCauOtp.deleteMany).toHaveBeenCalledWith({
      where: { challengeId: created.data.challengeId },
    });

    await expect(
      service.requestRegistrationOtp('+84901234567'),
    ).resolves.toMatchObject({ challengeId: expect.any(String) });
    expect(sentMessages).toHaveLength(1);
  });

  it('restores the previous challenge when a resend delivery fails', async () => {
    const previousChallenge = {
      yeuCauOtpId: 7,
      challengeId: 'previous-challenge',
      soDienThoai: '+84901234567',
      mucDich: 'DANG_KY',
      maOtpHash: 'previous-hash',
      soLanThu: 1,
      hetHanLuc: new Date('2026-09-28T00:05:00.000Z'),
      daXacThucLuc: null,
      proofHash: null,
      proofHetHanLuc: null,
      daSuDungLuc: null,
      createdAt: new Date('2026-09-28T00:00:00.000Z'),
      updatedAt: new Date('2026-09-27T23:58:00.000Z'),
    };
    prismaMock.yeuCauOtp.findUnique.mockResolvedValueOnce(previousChallenge);
    vi.mocked(smsSender.sendOtp).mockRejectedValueOnce(
      new Error('SMS provider unavailable'),
    );

    await expect(
      service.requestRegistrationOtp('+84901234567'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(prismaMock.yeuCauOtp.updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        yeuCauOtpId: previousChallenge.yeuCauOtpId,
        challengeId: expect.any(String),
        daXacThucLuc: null,
      },
      data: {
        challengeId: previousChallenge.challengeId,
        maOtpHash: previousChallenge.maOtpHash,
        soLanThu: previousChallenge.soLanThu,
        hetHanLuc: previousChallenge.hetHanLuc,
        daXacThucLuc: null,
        proofHash: null,
        proofHetHanLuc: null,
        daSuDungLuc: null,
        updatedAt: previousChallenge.updatedAt,
      },
    });
    expect(prismaMock.yeuCauOtp.deleteMany).not.toHaveBeenCalled();
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
