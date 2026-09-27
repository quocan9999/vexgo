import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { UpdateMeDto } from './dto/update-me.dto.js';

const customerProfileInclude = {
  khachHang: true,
  taiKhoanVaiTros: {
    include: { vaiTro: { select: { tenVaiTro: true } } },
  },
} satisfies Prisma.TaiKhoanInclude;

type CustomerAccount = Prisma.TaiKhoanGetPayload<{
  include: typeof customerProfileInclude;
}>;

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(taiKhoanId: number) {
    const account = await this.findCustomerAccount(taiKhoanId);
    return this.mapProfile(account);
  }

  async updateMe(taiKhoanId: number, dto: UpdateMeDto) {
    await this.findCustomerAccount(taiKhoanId);
    const account = await this.prisma.taiKhoan.update({
      where: { taiKhoanId },
      data: {
        ...(dto.hoTen !== undefined ? { hoTen: dto.hoTen } : {}),
        ...(dto.ngaySinh !== undefined
          ? {
              ngaySinh: dto.ngaySinh
                ? new Date(`${dto.ngaySinh}T00:00:00.000Z`)
                : null,
            }
          : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.cccd !== undefined ? { cccd: dto.cccd } : {}),
      },
      include: customerProfileInclude,
    });
    return this.mapProfile(account);
  }

  private async findCustomerAccount(taiKhoanId: number) {
    const account = await this.prisma.taiKhoan.findUnique({
      where: { taiKhoanId },
      include: customerProfileInclude,
    });
    if (!account) {
      throw new NotFoundException({
        error: 'CUSTOMER_PROFILE_NOT_FOUND',
        message: 'Không tìm thấy hồ sơ khách hàng.',
      });
    }
    const roles = account.taiKhoanVaiTros.map(({ vaiTro }) => vaiTro.tenVaiTro);
    if (!roles.includes('KHACH_HANG')) {
      throw new ForbiddenException({
        error: 'CUSTOMER_ROLE_REQUIRED',
        message: 'Tài khoản không có quyền khách hàng.',
      });
    }
    if (!account.khachHang) {
      throw new NotFoundException({
        error: 'CUSTOMER_PROFILE_NOT_FOUND',
        message: 'Không tìm thấy hồ sơ khách hàng.',
      });
    }
    return account;
  }

  private mapProfile(account: CustomerAccount) {
    const customer = account.khachHang;
    if (!customer) {
      throw new NotFoundException({
        error: 'CUSTOMER_PROFILE_NOT_FOUND',
        message: 'Không tìm thấy hồ sơ khách hàng.',
      });
    }
    return {
      taiKhoanId: account.taiKhoanId,
      khachHangId: customer.khachHangId,
      maKhachHang: customer.maKhachHang,
      diemTichLuy: customer.diemTichLuy,
      hoTen: account.hoTen,
      soDienThoai: account.soDienThoai,
      ngaySinh: account.ngaySinh?.toISOString().slice(0, 10) ?? null,
      cccd: account.cccd,
      email: account.email,
      daXacThucSoDienThoai: account.daXacThucSoDienThoai,
      trangThai: account.trangThai,
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString(),
    };
  }
}
