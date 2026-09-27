import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Prisma } from '../../generated/prisma/client.js';
import type { AuthTokenResponse, AuthUserSummary } from './auth-principal.js';

const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 900;
const DEFAULT_REFRESH_TOKEN_TTL_SECONDS = 2_592_000;

@Injectable()
export class TokenService {
  private readonly accessSecret: string;
  private readonly accessTtlSeconds: number;
  private readonly refreshTtlSeconds: number;

  constructor(
    private readonly jwtService: JwtService,
    configService: ConfigService,
  ) {
    this.accessSecret = configService.getOrThrow<string>('JWT_ACCESS_SECRET');
    this.accessTtlSeconds = this.readPositiveInteger(
      configService.get<string>('JWT_ACCESS_TTL_SECONDS'),
      DEFAULT_ACCESS_TOKEN_TTL_SECONDS,
    );
    this.refreshTtlSeconds = this.readPositiveInteger(
      configService.get<string>('REFRESH_TOKEN_TTL_SECONDS'),
      DEFAULT_REFRESH_TOKEN_TTL_SECONDS,
    );

    if (
      configService.get<string>('NODE_ENV') === 'production' &&
      (this.accessSecret.length < 32 ||
        this.accessSecret.includes('replace-with'))
    ) {
      throw new Error('JWT_ACCESS_SECRET must contain at least 32 characters');
    }
  }

  async createSession(
    tx: Prisma.TransactionClient,
    user: AuthUserSummary,
  ): Promise<AuthTokenResponse> {
    const sessionId = randomUUID();
    const refreshToken = randomBytes(48).toString('base64url');
    await tx.phienDangNhap.create({
      data: {
        sessionId,
        taiKhoanId: user.taiKhoanId,
        refreshTokenHash: this.hashRefreshToken(refreshToken),
        hetHanLuc: new Date(Date.now() + this.refreshTtlSeconds * 1000),
      },
    });
    const accessToken = await this.jwtService.signAsync(
      {
        sub: user.taiKhoanId,
        sid: sessionId,
        roles: user.roles,
      },
      {
        secret: this.accessSecret,
        expiresIn: this.accessTtlSeconds,
      },
    );

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.accessTtlSeconds,
      user,
    };
  }

  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private readPositiveInteger(value: string | undefined, fallback: number) {
    const parsed = Number(value ?? fallback);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
  }
}
