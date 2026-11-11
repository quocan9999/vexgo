import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { requireAuthSecret } from '../auth-secret.js';
import { assertAccountActive } from '../account-status.helper.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthPrincipal } from '../tokens/auth-principal.js';
import { EffectiveRolePermissionLoaderService } from '../permissions/effective-role-permission-loader.service.js';
import { PermissionResolverService } from '../permissions/permission-resolver.service.js';
import {
  AUTH_MODE_KEY,
  type EndpointAuthMode,
} from '../decorators/public.decorator.js';

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
    private readonly reflector: Reflector,
    private readonly permissionResolver: PermissionResolverService,
    private readonly permissionLoader: EffectiveRolePermissionLoaderService,
  ) {
    this.accessSecret = requireAuthSecret(
      configService.get<string>('JWT_ACCESS_SECRET'),
      'JWT_ACCESS_SECRET',
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Socket.IO authenticates the handshake and revalidates every command in
    // SupportChatGateway; its message context is not an Express request.
    if (context.getType() === 'ws') return true;

    const authMode = this.reflector.getAllAndOverride<EndpointAuthMode>(
      AUTH_MODE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (authMode === 'public') return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (
      authMode === 'optional' &&
      request.headers.authorization === undefined
    ) {
      return true;
    }

    const token = this.readBearerToken(request.headers.authorization);
    let payload: AccessTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        secret: this.accessSecret,
        algorithms: ['HS256'],
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
            loaiTaiKhoan: true,
            trangThai: true,
            khoaDenNgay: true,
            lyDoKhoa: true,
            nhanVien: {
              select: {
                nhanVienId: true,
                nhaXeId: true,
              },
            },
            taiKhoanVaiTros: {
              include: {
                vaiTro: {
                  select: {
                    vaiTroId: true,
                    tenVaiTro: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    if (session) {
      await assertAccountActive(this.prisma, session.taiKhoan);
    }
    if (
      !session ||
      session.taiKhoanId !== payload.sub ||
      session.thuHoiLuc !== null ||
      session.hetHanLuc <= new Date()
    ) {
      this.throwInvalidAccessToken();
    }

    const roleAssignments = session.taiKhoan.taiKhoanVaiTros;
    const roles = roleAssignments.map(({ vaiTro }) => vaiTro.tenVaiTro);
    const isTenantStaff = session.taiKhoan.nhanVien?.nhaXeId != null;
    const nhanVienId = isTenantStaff
      ? session.taiKhoan.nhanVien?.nhanVienId ?? null
      : null;
    const nhaXeId = isTenantStaff
      ? session.taiKhoan.nhanVien?.nhaXeId ?? null
      : null;
    const effectiveAssignments = await this.permissionLoader.load(
      roleAssignments.map(({ vaiTro }) => ({
        roleId: vaiTro.vaiTroId,
        roleName: vaiTro.tenVaiTro,
      })),
      nhaXeId,
    );
    request.user = {
      taiKhoanId: session.taiKhoan.taiKhoanId,
      sessionId: session.sessionId,
      roles,
      permissions: this.permissionResolver.resolve(effectiveAssignments, {
        nhanVienId,
        nhaXeId,
      }),
      nhanVienId,
      nhaXeId,
      loaiTaiKhoan: session.taiKhoan.loaiTaiKhoan,
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
