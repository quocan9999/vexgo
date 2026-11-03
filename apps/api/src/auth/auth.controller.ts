import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { RegisterDto, LoginDto } from './dto/auth.dto.js';
import { RequestRegisterOtpDto } from './dto/request-register-otp.dto.js';
import { VerifyRegisterOtpDto } from './dto/verify-register-otp.dto.js';
import { OtpService } from './otp/otp.service.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { Public } from './decorators/public.decorator.js';
import { AllowRoleScopeConflict } from './decorators/allow-role-scope-conflict.decorator.js';
import { CurrentPrincipal } from './decorators/current-principal.decorator.js';
import type { AuthPrincipal } from './tokens/auth-principal.js';
import {
  assertTrustedCookieOrigin,
  clearRefreshTokenCookie,
  readRefreshTokenCookie,
  setRefreshTokenCookie,
  usesRefreshCookie,
} from './tokens/refresh-cookie.js';
import { ApiErrorResponseDto } from '../common/swagger/api-response-envelope.dto.js';

type AuthenticatedRequest = Request & { user?: AuthPrincipal };

function invalidRefreshToken(): UnauthorizedException {
  return new UnauthorizedException({
    error: 'REFRESH_TOKEN_INVALID',
    message: 'Refresh token không hợp lệ hoặc đã hết hạn.',
  });
}

function invalidAccessToken(): UnauthorizedException {
  return new UnauthorizedException({
    error: 'ACCESS_TOKEN_INVALID',
    message: 'Access token không hợp lệ hoặc đã hết hạn.',
  });
}

function resolveRefreshToken(request: Request, dto: RefreshTokenDto): string {
  if (usesRefreshCookie(request)) {
    if (dto.refreshToken !== undefined) {
      throw new BadRequestException({
        error: 'VALIDATION_ERROR',
        message: 'Không gửi refresh token ở cả cookie và request body.',
        details: [
          {
            field: 'refreshToken',
            message: 'Bỏ field này khi dùng cookie transport.',
          },
        ],
      });
    }
    const cookieToken = readRefreshTokenCookie(request);
    if (!cookieToken) throw invalidRefreshToken();
    return cookieToken;
  }

  if (!dto.refreshToken) {
    throw new BadRequestException({
      error: 'VALIDATION_ERROR',
      message: 'Cần cung cấp refresh token.',
      details: [
        {
          field: 'refreshToken',
          message: 'Refresh token không được để trống.',
        },
      ],
    });
  }
  return dto.refreshToken;
}

function isInvalidRefreshToken(error: unknown): boolean {
  if (!(error instanceof UnauthorizedException)) return false;
  const response = error.getResponse();
  return (
    typeof response === 'object' &&
    response !== null &&
    'error' in response &&
    response.error === 'REFRESH_TOKEN_INVALID'
  );
}

@ApiTags('Xác thực & Phiên làm việc (Auth)')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly otpService: OtpService,
    private readonly config: ConfigService,
  ) {}

  @Post('register/request-otp')
  @Public()
  @ApiOperation({
    summary: 'Yêu cầu gửi mã OTP để đăng ký tài khoản',
    description:
      'Gửi mã xác thực OTP 6 chữ số tới số điện thoại người dùng để chuẩn bị đăng ký tài khoản. Mã OTP có hiệu lực trong 5 phút.\n\n- **Quyền truy cập**: Công khai (Public).',
  })
  @ApiResponse({
    status: 201,
    description: 'Yêu cầu thành công. Trả về `challengeId` để dùng cho bước xác thực OTP tiếp theo.',
  })
  @ApiResponse({
    status: 400,
    description: 'Số điện thoại không hợp lệ hoặc đã được đăng ký tài khoản.',
    type: ApiErrorResponseDto,
  })
  requestRegisterOtp(@Body() dto: RequestRegisterOtpDto) {
    return this.otpService.requestRegistrationOtp(dto.phoneNumber);
  }

  @Post('register/verify-otp')
  @Public()
  @ApiOperation({
    summary: 'Xác thực mã OTP đăng ký',
    description:
      'Kiểm tra mã OTP 6 chữ số người dùng nhập cùng `challengeId`. Khi hợp lệ, hệ thống sẽ cấp mã bằng chứng `otpProof` để gửi kèm thông tin đăng ký.\n\n- **Quyền truy cập**: Công khai (Public).',
  })
  @ApiResponse({
    status: 201,
    description: 'Xác thực thành công. Trả về `otpProof` có thời hạn 10 phút.',
  })
  @ApiResponse({
    status: 400,
    description: 'Mã OTP sai, hết hạn hoặc challengeId không tồn tại.',
    type: ApiErrorResponseDto,
  })
  verifyRegisterOtp(@Body() dto: VerifyRegisterOtpDto) {
    return this.otpService.verifyRegistrationOtp({
      challengeId: dto.challengeId,
      soDienThoai: dto.phoneNumber,
      otp: dto.otp,
    });
  }

  @Post('register')
  @Public()
  @ApiOperation({
    summary: 'Đăng ký tài khoản khách hàng mới',
    description:
      'Tạo tài khoản khách hàng với số điện thoại đã xác minh OTP, họ tên, mật khẩu và mã `otpProof`.\n\n- **Quyền truy cập**: Công khai (Public).',
  })
  @ApiResponse({
    status: 201,
    description: 'Đăng ký thành công. Trả về thông tin tài khoản và tokens đăng nhập.',
  })
  @ApiResponse({
    status: 400,
    description: 'Bằng chứng OTP không hợp lệ hoặc dữ liệu không đúng chuẩn.',
    type: ApiErrorResponseDto,
  })
  async register(@Body() dto: RegisterDto) {
    return await this.authService.register(dto);
  }

  @Post('login')
  @Public()
  @UseGuards(ThrottlerGuard)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Đăng nhập hệ thống',
    description:
      'Đăng nhập bằng số điện thoại (khách hàng) hoặc email/username (quản trị viên) kèm mật khẩu. Hệ thống tự động phân loại vai trò và hỗ trợ trả về refresh token qua HTTP-only cookie hoặc response body.\n\n- **Quyền truy cập**: Công khai (Public).',
  })
  @ApiResponse({
    status: 200,
    description: 'Đăng nhập thành công. Trả về Access Token (JWT), vai trò và thông tin cá nhân.',
  })
  @ApiResponse({
    status: 400,
    description: 'Dữ liệu đầu vào không hợp lệ.',
    type: ApiErrorResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Thông tin tài khoản hoặc mật khẩu không chính xác.',
    type: ApiErrorResponseDto,
  })
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const cookieTransport = usesRefreshCookie(request);
    if (cookieTransport) assertTrustedCookieOrigin(request, this.config);

    const result = await this.authService.login(dto);
    if (!cookieTransport) return result;

    setRefreshTokenCookie(response, this.config, result.refreshToken);
    const { refreshToken: _refreshToken, ...body } = result;
    return body;
  }

  @Post('refresh')
  @Public()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Làm mới Access Token',
    description:
      'Cấp lại Access Token mới khi token hiện tại hết hạn thông qua Refresh Token hợp lệ (tự động đọc từ HTTP-only cookie hoặc request body).\n\n- **Quyền truy cập**: Người dùng có refresh token hợp lệ.',
  })
  @ApiResponse({
    status: 200,
    description: 'Cấp token mới thành công.',
  })
  @ApiResponse({
    status: 401,
    description: 'Refresh token không hợp lệ hoặc đã bị thu hồi.',
    type: ApiErrorResponseDto,
  })
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const cookieTransport = usesRefreshCookie(request);
    if (cookieTransport) assertTrustedCookieOrigin(request, this.config);

    try {
      const refreshToken = resolveRefreshToken(request, dto);
      const result = await this.authService.refresh(refreshToken);
      if (!cookieTransport) return result;

      setRefreshTokenCookie(response, this.config, result.refreshToken);
      const { refreshToken: _rotatedToken, ...body } = result;
      return body;
    } catch (error) {
      if (cookieTransport && error instanceof ForbiddenException) {
        clearRefreshTokenCookie(response, this.config);
      }
      throw error;
    }
  }

  @Post('logout')
  @Public()
  @HttpCode(204)
  @ApiOperation({
    summary: 'Đăng xuất khỏi hệ thống',
    description:
      'Hủy bỏ phiên làm việc, xóa HTTP-only cookie refresh token và thu hồi token trong hệ cơ sở dữ liệu.\n\n- **Quyền truy cập**: Người dùng đang đăng nhập.',
  })
  @ApiResponse({
    status: 204,
    description: 'Đăng xuất thành công, không có nội dung trả về.',
  })
  async logout(
    @Body() dto: RefreshTokenDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const cookieTransport = usesRefreshCookie(request);
    if (cookieTransport) assertTrustedCookieOrigin(request, this.config);

    if (cookieTransport) {
      const cookieToken = readRefreshTokenCookie(request);
      if (!cookieToken) {
        clearRefreshTokenCookie(response, this.config);
        return;
      }
      try {
        await this.authService.logout(cookieToken);
      } catch (error) {
        if (!isInvalidRefreshToken(error)) throw error;
      }
      clearRefreshTokenCookie(response, this.config);
      return;
    }

    const refreshToken = resolveRefreshToken(request, dto);
    await this.authService.logout(refreshToken);
  }

  @Get('session')
  @AllowRoleScopeConflict()
  @HttpCode(200)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Lấy thông tin phiên đăng nhập hiện tại',
    description:
      'Truy vấn danh tính tài khoản, vai trò và phạm vi quyền hạn tương ứng của người dùng từ Access Token.\n\n- **Quyền truy cập**: Người dùng đã đăng nhập (Customer, Admin, Super Admin).',
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy thông tin phiên làm việc thành công.',
  })
  @ApiResponse({
    status: 401,
    description: 'Chưa đăng nhập hoặc token không hợp lệ.',
    type: ApiErrorResponseDto,
  })
  async currentSession(@Req() request: AuthenticatedRequest) {
    if (!request.user) throw invalidAccessToken();
    return this.authService.getCurrentSession(request.user.taiKhoanId);
  }

  @Post('change-password')
  @HttpCode(200)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Đổi mật khẩu tài khoản cá nhân',
    description:
      'Cập nhật mật khẩu mới cho tài khoản hiện đang đăng nhập sau khi xác thực đúng mật khẩu cũ.\n\n- **Quyền truy cập**: Người dùng đã đăng nhập.',
  })
  @ApiResponse({
    status: 200,
    description: 'Đổi mật khẩu thành công.',
  })
  @ApiResponse({
    status: 400,
    description: 'Mật khẩu cũ không chính xác hoặc mật khẩu mới không hợp lệ.',
    type: ApiErrorResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Chưa đăng nhập hoặc token đã hết hạn.',
    type: ApiErrorResponseDto,
  })
  async changePassword(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(
      principal.taiKhoanId,
      dto.oldPassword,
      dto.newPassword,
    );
  }
}
