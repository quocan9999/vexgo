import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { requireAuthSecret } from '../auth-secret.js';
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
    private readonly prisma: PrismaService,
  ) {
    this.accessSecret = requireAuthSecret(
      configService.get<string>('JWT_ACCESS_SECRET'),
      'JWT_ACCESS_SECRET',
    );

    this.accessTtlSeconds = this.readPositiveInteger(
      configService.get<string>('JWT_ACCESS_TTL_SECONDS'),
      DEFAULT_ACCESS_TOKEN_TTL_SECONDS,
    );
    this.refreshTtlSeconds = this.readPositiveInteger(
      configService.get<string>('REFRESH_TOKEN_TTL_SECONDS'),
      DEFAULT_REFRESH_TOKEN_TTL_SECONDS,
    );

  }

  async createSession(
    tx: Prisma.TransactionClient,
    user: AuthUserSummary,
  ): Promise<AuthTokenResponse> {
    const issued = await this.issueSession(tx, user);
    return issued.response;
  }

  async rotateRefreshToken(refreshToken: string): Promise<AuthTokenResponse> {
    const refreshTokenHash = this.hashRefreshToken(refreshToken);
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const current = await tx.phienDangNhap.findUnique({
        where: { refreshTokenHash },
        include: {
          taiKhoan: {
            include: {
              khachHang: { select: { khachHangId: true } },
              taiKhoanVaiTros: {
                include: { vaiTro: { select: { tenVaiTro: true } } },
              },
            },
          },
        },
      });
      if (!current || current.thuHoiLuc || current.hetHanLuc <= now) {
        this.throwInvalidRefreshToken();
      }
      if (current.taiKhoan.trangThai !== 'HOAT_DONG') {
        throw new ForbiddenException({
          error: 'ACCOUNT_INACTIVE',
          message: 'Tài khoản không hoạt động.',
        });
      }

      const claimed = await tx.phienDangNhap.updateMany({
        where: {
          phienDangNhapId: current.phienDangNhapId,
          thuHoiLuc: null,
          hetHanLuc: { gt: now },
        },
        data: { thuHoiLuc: now },
      });
      if (claimed.count !== 1) this.throwInvalidRefreshToken();

      const issued = await this.issueSession(
        tx,
        this.mapAccountToUser(current.taiKhoan),
      );
      await tx.phienDangNhap.update({
        where: { phienDangNhapId: current.phienDangNhapId },
        data: { tokenThayTheId: issued.phienDangNhapId },
      });
      return issued.response;
    });
  }

  async revokeRefreshToken(refreshToken: string): Promise<void> {
    const refreshTokenHash = this.hashRefreshToken(refreshToken);
    const session = await this.prisma.phienDangNhap.findUnique({
      where: { refreshTokenHash },
      select: { phienDangNhapId: true, thuHoiLuc: true },
    });
    if (!session) this.throwInvalidRefreshToken();
    if (session.thuHoiLuc) return;

    await this.prisma.phienDangNhap.updateMany({
      where: { phienDangNhapId: session.phienDangNhapId, thuHoiLuc: null },
      data: { thuHoiLuc: new Date() },
    });
  }

  private async issueSession(
    tx: Prisma.TransactionClient,
    user: AuthUserSummary,
  ): Promise<{ response: AuthTokenResponse; phienDangNhapId: number }> {
    const sessionId = randomUUID();
    const refreshToken = randomBytes(48).toString('base64url');
    const session = await tx.phienDangNhap.create({
      data: {
        sessionId,
        taiKhoanId: user.accountId,
        refreshTokenHash: this.hashRefreshToken(refreshToken),
        hetHanLuc: new Date(Date.now() + this.refreshTtlSeconds * 1000),
      },
    });
    const accessToken = await this.jwtService.signAsync(
      {
        sub: user.accountId,
        sid: sessionId,
        roles: user.roles,
      },
      {
        secret: this.accessSecret,
        expiresIn: this.accessTtlSeconds,
        algorithm: 'HS256',
      },
    );

    return {
      phienDangNhapId: session.phienDangNhapId,
      response: {
        accessToken,
        refreshToken,
        tokenType: 'Bearer',
        expiresIn: this.accessTtlSeconds,
        user,
      },
    };
  }

  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private mapAccountToUser(account: {
    taiKhoanId: number;
    hoTen: string;
    soDienThoai: string;
    khachHang: { khachHangId: number } | null;
    taiKhoanVaiTros: Array<{ vaiTro: { tenVaiTro: string } }>;
  }): AuthUserSummary {
    return {
      accountId: account.taiKhoanId,
      customerId: account.khachHang?.khachHangId ?? null,
      fullName: account.hoTen,
      phoneNumber: account.soDienThoai,
      roles: account.taiKhoanVaiTros.map(({ vaiTro }) => vaiTro.tenVaiTro),
    };
  }

  private throwInvalidRefreshToken(): never {
    throw new UnauthorizedException({
      error: 'REFRESH_TOKEN_INVALID',
      message: 'Refresh token không hợp lệ hoặc đã hết hạn.',
    });
  }

  private readPositiveInteger(value: string | undefined, fallback: number) {
    const parsed = Number(value ?? fallback);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
  }
}
