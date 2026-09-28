import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  DEFAULT_OTP_RESEND_COOLDOWN_SECONDS,
  DEFAULT_OTP_PROOF_TTL_SECONDS,
  DEFAULT_OTP_TTL_SECONDS,
  MAX_OTP_ATTEMPTS,
  REGISTRATION_OTP_PURPOSE,
} from './otp.constants.js';
import { OtpCryptoService } from './otp-crypto.service.js';
import { SMS_SENDER, type SmsSender } from '../sms/sms-sender.js';

export interface RegistrationOtpChallenge {
  challengeId: string;
  expiresAt: string;
  resendAfter: string;
}

export interface VerifyRegistrationOtpInput {
  challengeId: string;
  soDienThoai: string;
  otp: string;
}

export interface RegistrationOtpProof {
  otpProof: string;
  expiresAt: string;
}

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private readonly ttlSeconds: number;
  private readonly resendCooldownSeconds: number;
  private readonly proofTtlSeconds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: OtpCryptoService,
    @Inject(SMS_SENDER) private readonly smsSender: SmsSender,
    configService: ConfigService,
  ) {
    this.ttlSeconds = this.readPositiveInteger(
      configService.get<string>('OTP_TTL_SECONDS'),
      DEFAULT_OTP_TTL_SECONDS,
    );
    this.resendCooldownSeconds = this.readPositiveInteger(
      configService.get<string>('OTP_RESEND_COOLDOWN_SECONDS'),
      DEFAULT_OTP_RESEND_COOLDOWN_SECONDS,
    );
    this.proofTtlSeconds = this.readPositiveInteger(
      configService.get<string>('OTP_PROOF_TTL_SECONDS'),
      DEFAULT_OTP_PROOF_TTL_SECONDS,
    );
  }

  async verifyRegistrationOtp(
    input: VerifyRegistrationOtpInput,
  ): Promise<RegistrationOtpProof> {
    const challenge = await this.prisma.yeuCauOtp.findUnique({
      where: { challengeId: input.challengeId },
    });
    const now = new Date();

    if (
      !challenge ||
      challenge.soDienThoai !== input.soDienThoai ||
      challenge.mucDich !== REGISTRATION_OTP_PURPOSE ||
      challenge.daXacThucLuc !== null
    ) {
      this.throwOtpInvalid();
    }
    if (challenge.hetHanLuc <= now) {
      throw new BadRequestException({
        error: 'OTP_EXPIRED',
        message: 'Mã OTP đã hết hạn.',
      });
    }
    if (challenge.soLanThu >= MAX_OTP_ATTEMPTS) {
      this.throwAttemptsExceeded();
    }

    if (
      !this.cryptoService.matchesOtp(
        challenge.challengeId,
        input.otp,
        challenge.maOtpHash,
      )
    ) {
      const incremented = await this.prisma.yeuCauOtp.updateMany({
        where: {
          yeuCauOtpId: challenge.yeuCauOtpId,
          daXacThucLuc: null,
          soLanThu: { lt: MAX_OTP_ATTEMPTS },
          hetHanLuc: { gt: now },
        },
        data: { soLanThu: { increment: 1 } },
      });
      if (incremented.count !== 1) {
        await this.throwCurrentOtpState(input.challengeId, now);
      }
      this.throwOtpInvalid();
    }

    const otpProof = randomBytes(32).toString('base64url');
    const proofExpiresAt = new Date(
      now.getTime() + this.proofTtlSeconds * 1000,
    );
    const verified = await this.prisma.yeuCauOtp.updateMany({
      where: {
        yeuCauOtpId: challenge.yeuCauOtpId,
        daXacThucLuc: null,
        soLanThu: { lt: MAX_OTP_ATTEMPTS },
        hetHanLuc: { gt: now },
      },
      data: {
        daXacThucLuc: now,
        proofHash: this.hashProof(otpProof),
        proofHetHanLuc: proofExpiresAt,
      },
    });
    if (verified.count !== 1) {
      await this.throwCurrentOtpState(input.challengeId, now);
    }

    return {
      otpProof,
      expiresAt: proofExpiresAt.toISOString(),
    };
  }

  async consumeRegistrationProof(
    tx: Prisma.TransactionClient,
    input: { soDienThoai: string; otpProof: string; usedAt: Date },
  ): Promise<void> {
    const claimed = await tx.yeuCauOtp.updateMany({
      where: {
        soDienThoai: input.soDienThoai,
        mucDich: REGISTRATION_OTP_PURPOSE,
        proofHash: this.hashProof(input.otpProof),
        daXacThucLuc: { not: null },
        proofHetHanLuc: { gt: input.usedAt },
        daSuDungLuc: null,
      },
      data: { daSuDungLuc: input.usedAt },
    });
    if (claimed.count !== 1) {
      throw new BadRequestException({
        error: 'OTP_PROOF_INVALID',
        message: 'Bằng chứng xác thực OTP không hợp lệ hoặc đã hết hạn.',
      });
    }
  }

  async requestRegistrationOtp(
    soDienThoai: string,
  ): Promise<RegistrationOtpChallenge> {
    const account = await this.prisma.taiKhoan.findUnique({
      where: { soDienThoai },
      select: { taiKhoanId: true },
    });
    if (account) {
      throw new ConflictException({
        error: 'PHONE_ALREADY_REGISTERED',
        message: 'Số điện thoại đã được đăng ký.',
      });
    }

    const now = new Date();
    const cooldownCutoff = new Date(
      now.getTime() - this.resendCooldownSeconds * 1000,
    );
    const current = await this.prisma.yeuCauOtp.findUnique({
      where: {
        soDienThoai_mucDich: {
          soDienThoai,
          mucDich: REGISTRATION_OTP_PURPOSE,
        },
      },
    });

    if (current && current.updatedAt > cooldownCutoff) {
      this.throwResendTooSoon();
    }

    const challengeId = randomUUID();
    const otp = this.cryptoService.generateOtp();
    const expiresAt = new Date(now.getTime() + this.ttlSeconds * 1000);
    const resendAfter = new Date(
      now.getTime() + this.resendCooldownSeconds * 1000,
    );
    const challengeData = {
      challengeId,
      maOtpHash: this.cryptoService.hashOtp(challengeId, otp),
      soLanThu: 0,
      hetHanLuc: expiresAt,
      daXacThucLuc: null,
      proofHash: null,
      proofHetHanLuc: null,
      daSuDungLuc: null,
    };

    try {
      if (current) {
        const claimed = await this.prisma.yeuCauOtp.updateMany({
          where: {
            yeuCauOtpId: current.yeuCauOtpId,
            updatedAt: { equals: current.updatedAt, lte: cooldownCutoff },
          },
          data: challengeData,
        });
        if (claimed.count !== 1) {
          this.throwResendTooSoon();
        }
      } else {
        await this.prisma.yeuCauOtp.create({
          data: {
            ...challengeData,
            soDienThoai,
            mucDich: REGISTRATION_OTP_PURPOSE,
          },
        });
      }
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        this.throwResendTooSoon();
      }
      throw error;
    }

    try {
      await this.smsSender.sendOtp({ soDienThoai, otp });
    } catch {
      try {
        if (current) {
          await this.prisma.yeuCauOtp.updateMany({
            where: {
              yeuCauOtpId: current.yeuCauOtpId,
              challengeId,
              daXacThucLuc: null,
            },
            data: {
              challengeId: current.challengeId,
              maOtpHash: current.maOtpHash,
              soLanThu: current.soLanThu,
              hetHanLuc: current.hetHanLuc,
              daXacThucLuc: current.daXacThucLuc,
              proofHash: current.proofHash,
              proofHetHanLuc: current.proofHetHanLuc,
              daSuDungLuc: current.daSuDungLuc,
              updatedAt: current.updatedAt,
            },
          });
        } else {
          await this.prisma.yeuCauOtp.deleteMany({ where: { challengeId } });
        }
      } catch (cleanupError) {
        this.logger.error(
          'Could not roll back OTP challenge after SMS delivery failed',
          cleanupError instanceof Error ? cleanupError.stack : undefined,
        );
      }

      throw new ServiceUnavailableException({
        error: 'OTP_DELIVERY_FAILED',
        message: 'Không thể gửi mã OTP. Vui lòng thử lại.',
      });
    }

    return {
      challengeId,
      expiresAt: expiresAt.toISOString(),
      resendAfter: resendAfter.toISOString(),
    };
  }

  private throwResendTooSoon(): never {
    throw new ConflictException({
      error: 'OTP_RESEND_TOO_SOON',
      message: 'Vui lòng chờ trước khi yêu cầu gửi lại OTP.',
    });
  }

  private throwOtpInvalid(): never {
    throw new BadRequestException({
      error: 'OTP_INVALID',
      message: 'Mã OTP không hợp lệ.',
    });
  }

  private throwAttemptsExceeded(): never {
    throw new BadRequestException({
      error: 'OTP_ATTEMPTS_EXCEEDED',
      message: 'Đã vượt quá số lần nhập OTP cho phép.',
    });
  }

  private async throwCurrentOtpState(
    challengeId: string,
    now: Date,
  ): Promise<never> {
    const current = await this.prisma.yeuCauOtp.findUnique({
      where: { challengeId },
    });
    if (current && current.hetHanLuc <= now) {
      throw new BadRequestException({
        error: 'OTP_EXPIRED',
        message: 'Mã OTP đã hết hạn.',
      });
    }
    if (current && current.soLanThu >= MAX_OTP_ATTEMPTS) {
      this.throwAttemptsExceeded();
    }
    this.throwOtpInvalid();
  }

  private hashProof(proof: string): string {
    return createHash('sha256').update(proof).digest('hex');
  }

  private readPositiveInteger(value: string | undefined, fallback: number) {
    const parsed = Number(value ?? fallback);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
  }
}
