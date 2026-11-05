import { generateBusinessUuid } from '../common/business-uuid.js';
import {
  BadRequestException,
  Injectable,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { RegisterDto, LoginDto } from './dto/auth.dto.js';
import { ResetForgotPasswordDto } from './dto/forgot-password.dto.js';
import * as bcrypt from 'bcrypt';
import { OtpService } from './otp/otp.service.js';
import { TokenService } from './tokens/token.service.js';
import { EffectiveRolePermissionLoaderService } from './permissions/effective-role-permission-loader.service.js';
import { PermissionResolverService } from './permissions/permission-resolver.service.js';
import { RealtimeSessionInvalidatorService } from './realtime-session-invalidator.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { normalizeEmail } from '../common/normalize-email.js';
import { assertAccountActive } from './account-status.helper.js';

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
    @Optional()
    private readonly sessionInvalidator?: RealtimeSessionInvalidatorService,
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
          where: {
            soDienThoai_loaiTaiKhoan: {
              soDienThoai: dto.phoneNumber,
              loaiTaiKhoan: 'KHACH_HANG',
            },
          },
          select: { taiKhoanId: true },
        });
        if (existing) this.throwPhoneAlreadyRegistered();

        const account = await tx.taiKhoan.create({
          data: {
            soDienThoai: dto.phoneNumber,
            matKhau: hashedPassword,
            email: normalizeEmail(dto.email),
            loaiTaiKhoan: 'KHACH_HANG',
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
            maKhachHang: generateBusinessUuid(),
            hoTen: dto.fullName,
            ngaySinh: dto.dateOfBirth
              ? new Date(`${dto.dateOfBirth}T00:00:00.000Z`)
              : null,
            cccd: dto.citizenId ?? null,
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
          fullName: customer.hoTen ?? dto.fullName,
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
    let identifier = (dto.identifier ?? dto.phoneNumber ?? '').trim();
    if (/^0\d{9}$/.test(identifier)) {
      identifier = `+84${identifier.slice(1)}`;
    } else if (/^84\d{9}$/.test(identifier)) {
      identifier = `+${identifier}`;
    }
    const isPhoneNumber = /^\+84\d{9}$/.test(identifier);

    if (dto.accountType === 'KHACH_HANG' && !isPhoneNumber) {
      throw new BadRequestException({
        error: 'VALIDATION_ERROR',
        message: 'Tài khoản khách hàng chỉ hỗ trợ đăng nhập bằng số điện thoại.',
      });
    }

    const operatorAliases: Record<string, string> = {
      'futa@vexgo.test': 'admin.futa@vexgo.test',
      'tb@vexgo.test': 'admin.tb@vexgo.test',
      'hm@vexgo.test': 'admin.hm@vexgo.test',
    };
    const lookupEmail =
      operatorAliases[identifier.toLowerCase()] ?? identifier.toLowerCase();
    const where = isPhoneNumber
      ? {
          soDienThoai_loaiTaiKhoan: {
            soDienThoai: identifier,
            loaiTaiKhoan: dto.accountType,
          },
        }
      : {
          email_loaiTaiKhoan: {
            email: lookupEmail,
            loaiTaiKhoan: dto.accountType,
          },
        };
    const account = await this.prisma.taiKhoan.findUnique({
      where,
      include: {
        khachHang: { select: { khachHangId: true, hoTen: true } },
        nhanVien: { select: { nhanVienId: true, hoTen: true } },
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

    const roles = account.taiKhoanVaiTros.map(({ vaiTro }) => vaiTro.tenVaiTro);
    if (dto.accountType === 'KHACH_HANG') {
      if (!roles.includes('KHACH_HANG') || roles.some((r) => r !== 'KHACH_HANG')) {
        throw new UnauthorizedException({
          error: 'INVALID_CREDENTIALS',
          message: 'Thông tin đăng nhập không chính xác.',
        });
      }
    } else if (dto.accountType === 'QUAN_TRI') {
      if (roles.includes('KHACH_HANG')) {
        throw new UnauthorizedException({
          error: 'INVALID_CREDENTIALS',
          message: 'Thông tin đăng nhập không chính xác.',
        });
      }
    }

    await assertAccountActive(this.prisma, account);

    return this.prisma.$transaction((tx) =>
      this.tokenService.createSession(tx, {
        accountId: account.taiKhoanId,
        customerId: account.khachHang?.khachHangId ?? null,
        fullName: account.nhanVien?.hoTen ?? account.khachHang?.hoTen ?? '',
        phoneNumber: account.soDienThoai,
        roles,
      }),
    );
  }

  async getCurrentSession(accountId: number) {
    const account = await this.prisma.taiKhoan.findUnique({
      where: { taiKhoanId: accountId },
      select: {
        taiKhoanId: true,
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
        khachHang: {
          select: {
            khachHangId: true,
            hoTen: true,
          },
        },
        nhanVien: {
          select: {
            nhanVienId: true,
            hoTen: true,
            chucVu: true,
            ngayVaoLam: true,
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
      fullName: employee?.hoTen ?? account.khachHang?.hoTen ?? '',
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
            busCompanyId: employee.nhaXeId ?? null,
            busCompanyCode: employee.nhaXe?.maNhaXe ?? null,
            busCompanyName: employee.nhaXe?.tenNhaXe ?? null,
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
    currentSessionId?: string,
  ): Promise<{ message: string }> {
    const account = await this.prisma.taiKhoan.findUnique({
      where: { taiKhoanId: accountId },
      select: {
        taiKhoanId: true,
        matKhau: true,
        trangThai: true,
        khoaDenNgay: true,
        lyDoKhoa: true,
      },
    });

    if (!account) {
      throw new UnauthorizedException({
        error: 'ACCESS_TOKEN_INVALID',
        message: 'Phiên đăng nhập không còn hợp lệ.',
      });
    }

    await assertAccountActive(this.prisma, account);

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
    const now = new Date();

    const otherSessions = await this.prisma.$transaction(async (tx) => {
      await tx.taiKhoan.update({
        where: { taiKhoanId: accountId },
        data: { matKhau: hashedNewPassword },
      });

      const sessionsToRevoke =
        (await tx.phienDangNhap.findMany({
          where: {
            taiKhoanId: accountId,
            thuHoiLuc: null,
            ...(currentSessionId
              ? { sessionId: { not: currentSessionId } }
              : {}),
          },
          select: { sessionId: true },
        })) ?? [];

      if (sessionsToRevoke.length > 0) {
        await tx.phienDangNhap.updateMany({
          where: {
            taiKhoanId: accountId,
            thuHoiLuc: null,
            ...(currentSessionId
              ? { sessionId: { not: currentSessionId } }
              : {}),
          },
          data: { thuHoiLuc: now },
        });
      }

      return sessionsToRevoke;
    });

    for (const session of otherSessions ?? []) {
      this.sessionInvalidator?.invalidateSession(session.sessionId);
    }

    return { message: 'Đổi mật khẩu thành công.' };
  }

  async resetForgotPassword(
    dto: ResetForgotPasswordDto,
  ): Promise<{ message: string }> {
    const hashedNewPassword = await bcrypt.hash(dto.newPassword, 10);
    const usedAt = new Date();

    const revokedSessions = await this.prisma.$transaction(async (tx) => {
      await this.otpService.consumeForgotPasswordProof(tx, {
        soDienThoai: dto.phoneNumber,
        otpProof: dto.otpProof,
        usedAt,
      });

      const account = await tx.taiKhoan.findUnique({
        where: {
          soDienThoai_loaiTaiKhoan: {
            soDienThoai: dto.phoneNumber,
            loaiTaiKhoan: 'KHACH_HANG',
          },
        },
        select: {
          taiKhoanId: true,
          trangThai: true,
          khoaDenNgay: true,
          lyDoKhoa: true,
        },
      });

      if (!account) {
        throw new NotFoundException({
          error: 'PHONE_NOT_REGISTERED',
          message: 'Số điện thoại chưa được đăng ký tài khoản.',
        });
      }

      await assertAccountActive(tx, account);

      await tx.taiKhoan.update({
        where: { taiKhoanId: account.taiKhoanId },
        data: { matKhau: hashedNewPassword },
      });

      const activeSessions =
        (await tx.phienDangNhap.findMany({
          where: {
            taiKhoanId: account.taiKhoanId,
            thuHoiLuc: null,
          },
          select: { sessionId: true },
        })) ?? [];

      if (activeSessions.length > 0) {
        await tx.phienDangNhap.updateMany({
          where: {
            taiKhoanId: account.taiKhoanId,
            thuHoiLuc: null,
          },
          data: { thuHoiLuc: usedAt },
        });
      }

      return activeSessions;
    });

    for (const session of revokedSessions ?? []) {
      this.sessionInvalidator?.invalidateSession(session.sessionId);
    }

    return { message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.' };
  }
}

