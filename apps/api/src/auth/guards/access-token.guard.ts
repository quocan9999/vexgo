import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthPrincipal } from '../tokens/auth-principal.js';

interface AccessTokenPayload {
  sub: number;
  sid: string;
  roles: string[];
}

type AuthenticatedRequest = Request & { user?: AuthPrincipal };

@Injectable()
export class AccessTokenGuard implements CanActivate {
  private readonly accessSecret: string;

  constructor(
    private readonly jwtService: JwtService,
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.accessSecret = configService.getOrThrow<string>('JWT_ACCESS_SECRET');
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.readBearerToken(request.headers.authorization);
    let payload: AccessTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        secret: this.accessSecret,
      });
    } catch {
      this.throwInvalidAccessToken();
    }
    if (
      !Number.isInteger(payload.sub) ||
      payload.sub <= 0 ||
      typeof payload.sid !== 'string' ||
      !Array.isArray(payload.roles) ||
      !payload.roles.every((role) => typeof role === 'string')
    ) {
      this.throwInvalidAccessToken();
    }

    const session = await this.prisma.phienDangNhap.findUnique({
      where: { sessionId: payload.sid },
      include: {
        taiKhoan: {
          select: {
            taiKhoanId: true,
            trangThai: true,
            taiKhoanVaiTros: {
              include: { vaiTro: { select: { tenVaiTro: true } } },
            },
          },
        },
      },
    });
    if (
      !session ||
      session.taiKhoanId !== payload.sub ||
      session.thuHoiLuc !== null ||
      session.hetHanLuc <= new Date()
    ) {
      this.throwInvalidAccessToken();
    }
    if (session.taiKhoan.trangThai !== 'HOAT_DONG') {
      throw new ForbiddenException({
        error: 'ACCOUNT_INACTIVE',
        message: 'Tài khoản không hoạt động.',
      });
    }

    request.user = {
      taiKhoanId: session.taiKhoan.taiKhoanId,
      sessionId: session.sessionId,
      roles: session.taiKhoan.taiKhoanVaiTros.map(
        ({ vaiTro }) => vaiTro.tenVaiTro,
      ),
    };
    return true;
  }

  private readBearerToken(authorization: string | undefined): string {
    const parts = authorization?.split(' ') ?? [];
    if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) {
      this.throwInvalidAccessToken();
    }
    return parts[1];
  }

  private throwInvalidAccessToken(): never {
    throw new UnauthorizedException({
      error: 'ACCESS_TOKEN_INVALID',
      message: 'Access token không hợp lệ hoặc đã hết hạn.',
    });
  }
}
