import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

@Injectable()
export class OtpCryptoService {
  private readonly secret: string;

  constructor(configService: ConfigService) {
    this.secret = configService.getOrThrow<string>('OTP_HASH_SECRET');
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
