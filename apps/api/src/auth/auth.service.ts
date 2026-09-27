import {
  Injectable,
  ConflictException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { RegisterDto, LoginDto } from './dto/auth.dto.js';
import * as bcrypt from 'bcrypt';
import { OtpService } from './otp/otp.service.js';
import { TokenService } from './tokens/token.service.js';
import { Prisma } from '../generated/prisma/client.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly otpService: OtpService,
    private readonly tokenService: TokenService,
  ) {}

  async register(dto: RegisterDto) {
    const hashedPassword = await bcrypt.hash(dto.matKhau, 10);
    const usedAt = new Date();

    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.otpService.consumeRegistrationProof(tx, {
          soDienThoai: dto.soDienThoai,
          otpProof: dto.otpProof,
          usedAt,
        });

        const existing = await tx.taiKhoan.findUnique({
          where: { soDienThoai: dto.soDienThoai },
          select: { taiKhoanId: true },
        });
        if (existing) this.throwPhoneAlreadyRegistered();

        const account = await tx.taiKhoan.create({
          data: {
            hoTen: dto.hoTen,
            soDienThoai: dto.soDienThoai,
            matKhau: hashedPassword,
            ngaySinh: dto.ngaySinh
              ? new Date(`${dto.ngaySinh}T00:00:00.000Z`)
              : null,
            email: dto.email ?? null,
            cccd: dto.cccd ?? null,
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
          taiKhoanId: account.taiKhoanId,
          khachHangId: customer.khachHangId,
          hoTen: account.hoTen,
          soDienThoai: account.soDienThoai,
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
      throw error;
    }
  }

  private throwPhoneAlreadyRegistered(): never {
    throw new ConflictException({
      error: 'PHONE_ALREADY_REGISTERED',
      message: 'Số điện thoại đã được đăng ký.',
    });
  }

  async login(dto: LoginDto) {
    // 1. Tìm tài khoản theo số điện thoại
    const user = await this.prisma.taiKhoan.findUnique({
      where: { soDienThoai: dto.soDienThoai },
    });

    if (!user) {
      throw new UnauthorizedException(
        'Số điện thoại hoặc mật khẩu không chính xác!',
      );
    }

    // 2. Kiểm tra mật khẩu khớp nhau không
    const isPasswordValid = await bcrypt.compare(dto.matKhau, user.matKhau);
    if (!isPasswordValid) {
      throw new UnauthorizedException(
        'Số điện thoại hoặc mật khẩu không chính xác!',
      );
    }

    const { matKhau: _matKhau, ...result } = user;
    return {
      message: 'Đăng nhập thành công',
      user: result,
    };
  }
}
