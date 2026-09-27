import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  DEFAULT_OTP_RESEND_COOLDOWN_SECONDS,
  DEFAULT_OTP_TTL_SECONDS,
  REGISTRATION_OTP_PURPOSE,
} from './otp.constants.js';
import { OtpCryptoService } from './otp-crypto.service.js';
import { SMS_SENDER, type SmsSender } from '../sms/sms-sender.js';

export interface RegistrationOtpChallenge {
  challengeId: string;
  expiresAt: string;
  resendAfter: string;
}

@Injectable()
export class OtpService {
  private readonly ttlSeconds: number;
  private readonly resendCooldownSeconds: number;

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

    await this.smsSender.sendOtp({ soDienThoai, otp });
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

  private readPositiveInteger(value: string | undefined, fallback: number) {
    const parsed = Number(value ?? fallback);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
  }
}
