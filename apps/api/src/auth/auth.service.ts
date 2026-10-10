import {
  BadRequestException,
  Injectable,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { RegisterDto, LoginDto } from './dto/auth.dto.js';
import * as bcrypt from 'bcrypt';
import { OtpService } from './otp/otp.service.js';
import { TokenService } from './tokens/token.service.js';
import { EffectiveRolePermissionLoaderService } from './permissions/effective-role-permission-loader.service.js';
import { PermissionResolverService } from './permissions/permission-resolver.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { normalizeEmail } from '../common/normalize-email.js';

const DUMMY_PASSWORD_HASH =
  '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly otpService: OtpService,
    private readonly tokenService: TokenService,
    private readonly permissionResolver: PermissionResolverService,
    private readonly permissionLoader: EffectiveRolePermissionLoaderService,
  ) {}

  async register(dto: RegisterDto) {
    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const usedAt = new Date();

    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.otpService.consumeRegistrationProof(tx, {
          soDienThoai: dto.phoneNumber,
          otpProof: dto.otpProof,
          usedAt,
        });

        const existing = await tx.taiKhoan.findUnique({
          where: { soDienThoai: dto.phoneNumber },
          select: { taiKhoanId: true },
        });
        if (existing) this.throwPhoneAlreadyRegistered();

        const account = await tx.taiKhoan.create({
          data: {
            hoTen: dto.fullName,
            soDienThoai: dto.phoneNumber,
            matKhau: hashedPassword,
            ngaySinh: dto.dateOfBirth
              ? new Date(`${dto.dateOfBirth}T00:00:00.000Z`)
              : null,
            email: normalizeEmail(dto.email),
            cccd: dto.citizenId ?? null,
            daXacThucSoDienThoai: true,
            trangThai: 'HOAT_DONG',
          },
        });
        const customerRole = await tx.vaiTro.findUnique({
          where: { tenVaiTro: 'KHACH_HANG' },
        });
        if (!customerRole) {
          throw new InternalServerErrorException({
            error: 'AUTH_ROLE_NOT_CONFIGURED',
            message: 'Vai trò khách hàng chưa được cấu hình.',
          });
        }
        const customer = await tx.khachHang.create({
          data: {
            maKhachHang: `KH${account.taiKhoanId.toString().padStart(8, '0')}`,
            diemTichLuy: 0,
            taiKhoanId: account.taiKhoanId,
          },
        });
        await tx.taiKhoanVaiTro.create({
          data: {
            taiKhoanId: account.taiKhoanId,
            vaiTroId: customerRole.vaiTroId,
          },
        });

        return this.tokenService.createSession(tx, {
          accountId: account.taiKhoanId,
          customerId: customer.khachHangId,
          fullName: account.hoTen,
          phoneNumber: account.soDienThoai,
          roles: [customerRole.tenVaiTro],
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        JSON.stringify(error.meta?.target ?? '').includes('soDienThoai')
      ) {
        this.throwPhoneAlreadyRegistered();
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        JSON.stringify(error.meta?.target ?? '').includes('email')
      ) {
        this.throwEmailAlreadyRegistered();
      }
      throw error;
    }
  }

  private throwPhoneAlreadyRegistered(): never {
    throw new ConflictException({
      error: 'PHONE_ALREADY_REGISTERED',
      message: 'Số điện thoại đã được đăng ký.',
    });
  }

  private throwEmailAlreadyRegistered(): never {
    throw new ConflictException({
      error: 'EMAIL_ALREADY_REGISTERED',
      message: 'Email đã được đăng ký.',
    });
  }

  async login(dto: LoginDto) {
    const identifier = (dto.identifier ?? dto.phoneNumber ?? '').trim();
    const isPhoneNumber = /^\+84\d{9}$/.test(identifier);
    const where = isPhoneNumber
      ? { soDienThoai: identifier }
      : { email: identifier.toLowerCase() };
    const account = await this.prisma.taiKhoan.findUnique({
      where,
      include: {
        khachHang: { select: { khachHangId: true } },
        taiKhoanVaiTros: {
          include: { vaiTro: { select: { tenVaiTro: true } } },
        },
      },
    });
    const isPasswordValid = await bcrypt.compare(
      dto.password,
      account?.matKhau ?? DUMMY_PASSWORD_HASH,
    );
    if (!account || !isPasswordValid) {
      throw new UnauthorizedException({
        error: 'INVALID_CREDENTIALS',
        message: 'Thông tin đăng nhập không chính xác.',
      });
    }
    if (account.trangThai !== 'HOAT_DONG') {
      throw new ForbiddenException({
        error: 'ACCOUNT_INACTIVE',
        message: 'Tài khoản không hoạt động.',
      });
    }

    return this.prisma.$transaction((tx) =>
      this.tokenService.createSession(tx, {
        accountId: account.taiKhoanId,
        customerId: account.khachHang?.khachHangId ?? null,
        fullName: account.hoTen,
        phoneNumber: account.soDienThoai,
        roles: account.taiKhoanVaiTros.map(({ vaiTro }) => vaiTro.tenVaiTro),
      }),
    );
  }

  async getCurrentSession(accountId: number) {
    const account = await this.prisma.taiKhoan.findUnique({
      where: { taiKhoanId: accountId },
      select: {
        taiKhoanId: true,
        hoTen: true,
        soDienThoai: true,
        email: true,
        trangThai: true,
        taiKhoanVaiTros: {
          select: {
            vaiTro: {
              select: {
                vaiTroId: true,
                tenVaiTro: true,
              },
            },
          },
        },
        nhanVien: {
          select: {
            nhanVienId: true,
            nhaXeId: true,
            nhaXe: {
              select: { maNhaXe: true, tenNhaXe: true },
            },
          },
        },
      },
    });
    if (!account) {
      throw new UnauthorizedException({
        error: 'ACCESS_TOKEN_INVALID',
        message: 'Phiên đăng nhập không còn hợp lệ.',
      });
    }
    if (account.trangThai !== 'HOAT_DONG') {
      throw new ForbiddenException({
        error: 'ACCOUNT_INACTIVE',
        message: 'Tài khoản không hoạt động.',
      });
    }

    const roles = account.taiKhoanVaiTros.map(({ vaiTro }) => vaiTro.tenVaiTro);
    const employee = account.nhanVien;
    const effectiveAssignments = await this.permissionLoader.load(
      account.taiKhoanVaiTros.map(({ vaiTro }) => ({
        roleId: vaiTro.vaiTroId,
        roleName: vaiTro.tenVaiTro,
      })),
      employee?.nhaXeId ?? null,
    );
    return {
      accountId: account.taiKhoanId,
      fullName: account.hoTen,
      phoneNumber: account.soDienThoai,
      email: account.email,
      roles,
      permissions: this.permissionResolver.resolve(effectiveAssignments, {
        nhanVienId: employee?.nhanVienId ?? null,
        nhaXeId: employee?.nhaXeId ?? null,
      }),
      employee: employee
        ? {
            employeeId: employee.nhanVienId,
            busCompanyId: employee.nhaXeId,
            busCompanyCode: employee.nhaXe.maNhaXe,
            busCompanyName: employee.nhaXe.tenNhaXe,
          }
        : null,
      busCompanyId: employee?.nhaXeId ?? null,
    };
  }

  refresh(refreshToken: string) {
    return this.tokenService.rotateRefreshToken(refreshToken);
  }

  logout(refreshToken: string) {
    return this.tokenService.revokeRefreshToken(refreshToken);
  }

  async changePassword(
    accountId: number,
    oldPassword: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const account = await this.prisma.taiKhoan.findUnique({
      where: { taiKhoanId: accountId },
      select: { taiKhoanId: true, matKhau: true, trangThai: true },
    });

    if (!account) {
      throw new UnauthorizedException({
        error: 'ACCESS_TOKEN_INVALID',
        message: 'Phiên đăng nhập không còn hợp lệ.',
      });
    }

    if (account.trangThai !== 'HOAT_DONG') {
      throw new ForbiddenException({
        error: 'ACCOUNT_INACTIVE',
        message: 'Tài khoản không hoạt động.',
      });
    }

    const isMatch = await bcrypt.compare(
      oldPassword,
      account.matKhau ?? DUMMY_PASSWORD_HASH,
    );

    if (!isMatch) {
      throw new BadRequestException({
        error: 'INVALID_OLD_PASSWORD',
        message: 'Mật khẩu cũ không chính xác.',
      });
    }

    const isSamePassword = await bcrypt.compare(newPassword, account.matKhau);
    if (isSamePassword) {
      throw new BadRequestException({
        error: 'SAME_PASSWORD',
        message: 'Mật khẩu mới không được trùng với mật khẩu cũ.',
      });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.taiKhoan.update({
      where: { taiKhoanId: accountId },
      data: { matKhau: hashedNewPassword },
    });

    return { message: 'Đổi mật khẩu thành công.' };
  }
}

