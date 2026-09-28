import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Prisma,
  YeuCauOtp,
} from '../../../src/generated/prisma/client.js';
import { OtpCryptoService } from '../../../src/auth/otp/otp-crypto.service.js';
import { OtpService } from '../../../src/auth/otp/otp.service.js';
import type { SmsSender } from '../../../src/auth/sms/sms-sender.js';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';

const NOW = new Date('2026-09-28T10:00:00.000Z');
const CHALLENGE_ID = 'b9a4fbcb-fef7-4bc8-8601-7205df054291';
const PHONE = '+84901234567';
const OTP = '123456';

const prismaMock = {
  taiKhoan: { findUnique: vi.fn() },
  yeuCauOtp: {
    findUnique: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  },
};
const config = new ConfigService({
  OTP_HASH_SECRET: 'test-only-otp-secret-for-vexgo-unit-tests-2026',
  OTP_PROOF_TTL_SECONDS: '600',
});
const cryptoService = new OtpCryptoService(config);
const smsSender: SmsSender = { sendOtp: vi.fn() };
const service = new OtpService(
  prismaMock as unknown as PrismaService,
  cryptoService,
  smsSender,
  config,
);

function challenge(overrides: Partial<YeuCauOtp> = {}): YeuCauOtp {
  return {
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
    ...overrides,
  };
}

function verificationInput(
  overrides: Partial<{
    challengeId: string;
    soDienThoai: string;
    otp: string;
  }> = {},
) {
  return {
    challengeId: CHALLENGE_ID,
    soDienThoai: PHONE,
    otp: OTP,
    ...overrides,
  };
}

describe('OtpService verifyRegistrationOtp', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.clearAllMocks();
    prismaMock.yeuCauOtp.findUnique.mockResolvedValue(challenge());
    prismaMock.yeuCauOtp.updateMany.mockResolvedValue({ count: 1 });
  });

  it('atomically verifies a valid OTP and returns a raw proof only once', async () => {
    const result = await service.verifyRegistrationOtp(verificationInput());

    expect(result).toEqual({
      otpProof: expect.any(String),
      expiresAt: '2026-09-28T10:10:00.000Z',
    });
    const update = prismaMock.yeuCauOtp.updateMany.mock.calls[0][0];
    expect(update.where).toMatchObject({
      yeuCauOtpId: 1,
      daXacThucLuc: null,
      soLanThu: { lt: 5 },
    });
    expect(update.data).toMatchObject({
      daXacThucLuc: NOW,
      proofHetHanLuc: new Date('2026-09-28T10:10:00.000Z'),
    });
    expect(update.data.proofHash).toBe(
      createHash('sha256').update(result.otpProof).digest('hex'),
    );
    expect(update.data.proofHash).not.toBe(result.otpProof);
  });

  it('rejects a challenge requested for a different phone', async () => {
    await expect(
      service.verifyRegistrationOtp(
        verificationInput({ soDienThoai: '+84909999999' }),
      ),
    ).rejects.toMatchObject({
      response: { error: 'OTP_INVALID' },
    });
    expect(prismaMock.yeuCauOtp.updateMany).not.toHaveBeenCalled();
  });

  it('returns OTP_EXPIRED for an expired challenge', async () => {
    prismaMock.yeuCauOtp.findUnique.mockResolvedValueOnce(
      challenge({ hetHanLuc: new Date('2026-09-28T09:59:59.999Z') }),
    );

    await expect(
      service.verifyRegistrationOtp(verificationInput()),
    ).rejects.toMatchObject({ response: { error: 'OTP_EXPIRED' } });
    expect(prismaMock.yeuCauOtp.updateMany).not.toHaveBeenCalled();
  });

  it('increments the attempt counter when the OTP is wrong', async () => {
    await expect(
      service.verifyRegistrationOtp(verificationInput({ otp: '999999' })),
    ).rejects.toMatchObject({ response: { error: 'OTP_INVALID' } });

    expect(prismaMock.yeuCauOtp.updateMany).toHaveBeenCalledWith({
      where: {
        yeuCauOtpId: 1,
        daXacThucLuc: null,
        soLanThu: { lt: 5 },
        hetHanLuc: { gt: NOW },
      },
      data: { soLanThu: { increment: 1 } },
    });
  });

  it('rejects the sixth attempt without comparing or updating the OTP', async () => {
    prismaMock.yeuCauOtp.findUnique.mockResolvedValueOnce(
      challenge({ soLanThu: 5 }),
    );

    await expect(
      service.verifyRegistrationOtp(verificationInput()),
    ).rejects.toMatchObject({
      response: { error: 'OTP_ATTEMPTS_EXCEEDED' },
    });
    expect(prismaMock.yeuCauOtp.updateMany).not.toHaveBeenCalled();
  });

  it('allows only one concurrent verification to receive the raw proof', async () => {
    prismaMock.yeuCauOtp.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    const results = await Promise.allSettled([
      service.verifyRegistrationOtp(verificationInput()),
      service.verifyRegistrationOtp(verificationInput()),
    ]);

    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(
      1,
    );
    expect(results.filter(({ status }) => status === 'rejected')).toHaveLength(
      1,
    );
  });
});

describe('OtpService consumeRegistrationProof', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.yeuCauOtp.updateMany.mockResolvedValue({ count: 1 });
  });

  it('atomically consumes a matching unexpired proof', async () => {
    const tx = prismaMock as unknown as Prisma.TransactionClient;

    await service.consumeRegistrationProof(tx, {
      soDienThoai: PHONE,
      otpProof: 'raw-proof',
      usedAt: NOW,
    });

    expect(prismaMock.yeuCauOtp.updateMany).toHaveBeenCalledWith({
      where: {
        soDienThoai: PHONE,
        mucDich: 'DANG_KY',
        proofHash: createHash('sha256').update('raw-proof').digest('hex'),
        daXacThucLuc: { not: null },
        proofHetHanLuc: { gt: NOW },
        daSuDungLuc: null,
      },
      data: { daSuDungLuc: NOW },
    });
  });

  it('returns OTP_PROOF_INVALID when the proof cannot be claimed', async () => {
    prismaMock.yeuCauOtp.updateMany.mockResolvedValueOnce({ count: 0 });

    const claim = service.consumeRegistrationProof(
      prismaMock as unknown as Prisma.TransactionClient,
      { soDienThoai: PHONE, otpProof: 'replayed-proof', usedAt: NOW },
    );

    await expect(claim).rejects.toBeInstanceOf(BadRequestException);
    await expect(claim).rejects.toMatchObject({
      response: { error: 'OTP_PROOF_INVALID' },
    });
  });
});
