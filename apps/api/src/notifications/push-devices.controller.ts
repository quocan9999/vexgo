import {
  Body,
  Controller,
  Delete,
  Injectable,
  Post,
  ForbiddenException,
} from '@nestjs/common';
import { IsString, Length, Matches } from 'class-validator';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { CurrentPrincipal } from '../auth/decorators/current-principal.decorator.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';

export class PushDeviceDto {
  @IsString()
  @Length(22, 4096)
  @Matches(/^\S+$/)
  token!: string;
}
@Injectable()
export class PushDevicesService {
  constructor(private readonly prisma: PrismaService) {}
  async register(principal: AuthPrincipal, token: string) {
    const customer = await this.prisma.khachHang.findUnique({
      where: { taiKhoanId: principal.taiKhoanId },
    });
    if (!customer)
      throw new ForbiddenException(
        'Chỉ tài khoản khách hàng được đăng ký thông báo.',
      );
    const tokenHash = createHash('sha256').update(token).digest('hex');
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await this.prisma.$transaction(async (tx) => {
          const device = await tx.thietBiThongBao.upsert({
            where: { tokenHash },
            create: {
              tokenHash,
              token,
              khachHangId: customer.khachHangId,
              taiKhoanId: principal.taiKhoanId,
              sessionId: principal.sessionId,
            },
            update: {
              token,
              khachHangId: customer.khachHangId,
              taiKhoanId: principal.taiKhoanId,
              sessionId: principal.sessionId,
              hoatDong: true,
            },
          });
          // Refresh rotates the JWT session ID. Rebind only this customer's pending
          // deliveries; never carry a different account's notifications onto a device.
          await tx.pushThongBao.updateMany({
            where: {
              thietBiThongBaoId: device.thietBiThongBaoId,
              khachHangId: customer.khachHangId,
              tokenHash,
              trangThai: 'PENDING',
            },
            data: { sessionId: principal.sessionId },
          });
        });
        break;
      } catch (error: unknown) {
        const code = (error as { code?: string } | null)?.code;
        // Prisma's MySQL upsert may race on first registration. Only retry
        // this idempotent registration, with a fresh transaction snapshot.
        if (attempt === 2 || !['P2002', 'P2034'].includes(code || ''))
          throw error;
      }
    }
    return { data: { registered: true } };
  }
  async unregister(principal: AuthPrincipal, token: string) {
    await this.prisma.thietBiThongBao.updateMany({
      where: {
        tokenHash: createHash('sha256').update(token).digest('hex'),
        taiKhoanId: principal.taiKhoanId,
      },
      data: { hoatDong: false },
    });
    return { data: { registered: false } };
  }
}
@Controller('notifications/devices')
export class PushDevicesController {
  constructor(private readonly service: PushDevicesService) {}
  @Post() register(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body() dto: PushDeviceDto,
  ) {
    return this.service.register(principal, dto.token);
  }
  @Delete() unregister(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body() dto: PushDeviceDto,
  ) {
    return this.service.unregister(principal, dto.token);
  }
}
