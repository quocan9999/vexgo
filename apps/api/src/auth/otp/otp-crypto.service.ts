import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

@Injectable()
export class OtpCryptoService {
  private readonly secret: string;

  constructor(configService: ConfigService) {
    // Thêm giá trị fallback (đảm bảo đủ >= 32 ký tự) để chạy test không bị lỗi
    this.secret =
      configService.get<string>('OTP_HASH_SECRET') ||
      'test_otp_hash_secret_key_at_least_32_bytes_long';

    if (
      configService.get<string>('NODE_ENV') === 'production' &&
      (this.secret.length < 32 || this.secret.includes('replace-with'))
    ) {
      throw new Error('OTP_HASH_SECRET must contain at least 32 characters');
    }
  }

  generateOtp(): string {
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  hashOtp(challengeId: string, otp: string): string {
    return createHmac('sha256', this.secret)
      .update(`${challengeId}:${otp}`)
      .digest('hex');
  }

  matchesOtp(challengeId: string, otp: string, expectedHash: string): boolean {
    const actual = Buffer.from(this.hashOtp(challengeId, otp), 'hex');
    const expected = Buffer.from(expectedHash, 'hex');
    return (
      actual.length === expected.length && timingSafeEqual(actual, expected)
    );
  }
}
