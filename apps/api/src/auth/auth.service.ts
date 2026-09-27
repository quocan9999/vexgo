import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { RegisterDto, LoginDto } from './dto/auth.dto.js';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  async register(dto: RegisterDto) {
    // 1. Kiểm tra xem số điện thoại đã tồn tại chưa
    const existingUser = await this.prisma.taiKhoan.findUnique({
      where: { soDienThoai: dto.soDienThoai },
    });

    if (existingUser) {
      throw new BadRequestException('Số điện thoại này đã được đăng ký!');
    }

    // 2. Mã hóa mật khẩu bảo mật bằng bcrypt
    const hashedPassword = await bcrypt.hash(dto.matKhau, 10);

    // 3. Tạo bản ghi mới vào bảng TaiKhoan
    const newUser = await this.prisma.taiKhoan.create({
      data: {
        hoTen: dto.hoTen,
        soDienThoai: dto.soDienThoai,
        matKhau: hashedPassword,
        email: dto.email || null,
        cccd: dto.cccd || null,
        daXacThucSoDienThoai: false,
        trangThai: 'HOAT_DONG',
      },
    });

    // Ẩn mật khẩu trước khi trả về kết quả cho client
    const { matKhau: _matKhau, ...result } = newUser;
    return result;
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
