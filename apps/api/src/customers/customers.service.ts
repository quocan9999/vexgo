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
        ...(dto.fullName !== undefined ? { hoTen: dto.fullName } : {}),
        ...(dto.dateOfBirth !== undefined
          ? {
              ngaySinh: dto.dateOfBirth
                ? new Date(`${dto.dateOfBirth}T00:00:00.000Z`)
                : null,
            }
          : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.citizenId !== undefined ? { cccd: dto.citizenId } : {}),
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
      accountId: account.taiKhoanId,
      customerId: customer.khachHangId,
      customerCode: customer.maKhachHang,
      loyaltyPoints: customer.diemTichLuy,
      fullName: account.hoTen,
      phoneNumber: account.soDienThoai,
      dateOfBirth: account.ngaySinh?.toISOString().slice(0, 10) ?? null,
      citizenId: account.cccd,
      email: account.email,
      phoneVerified: account.daXacThucSoDienThoai,
      status: account.trangThai,
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString(),
    };
  }
}
