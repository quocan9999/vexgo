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
import { ThrottlerGuard } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { RegisterDto, LoginDto } from './dto/auth.dto.js';
import { RequestRegisterOtpDto } from './dto/request-register-otp.dto.js';
import { VerifyRegisterOtpDto } from './dto/verify-register-otp.dto.js';
import { OtpService } from './otp/otp.service.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { Public } from './decorators/public.decorator.js';
import { AllowRoleScopeConflict } from './decorators/allow-role-scope-conflict.decorator.js';
import type { AuthPrincipal } from './tokens/auth-principal.js';
import {
  assertTrustedCookieOrigin,
  clearRefreshTokenCookie,
  readRefreshTokenCookie,
  setRefreshTokenCookie,
  usesRefreshCookie,
} from './tokens/refresh-cookie.js';

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

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly otpService: OtpService,
    private readonly config: ConfigService,
  ) {}

  @Post('register/request-otp')
  @Public()
  requestRegisterOtp(@Body() dto: RequestRegisterOtpDto) {
    return this.otpService.requestRegistrationOtp(dto.phoneNumber);
  }

  @Post('register/verify-otp')
  @Public()
  verifyRegisterOtp(@Body() dto: VerifyRegisterOtpDto) {
    return this.otpService.verifyRegistrationOtp({
      challengeId: dto.challengeId,
      soDienThoai: dto.phoneNumber,
      otp: dto.otp,
    });
  }

  @Post('register')
  @Public()
  async register(@Body() dto: RegisterDto) {
    return await this.authService.register(dto);
  }

  @Post('login')
  @Public()
  @UseGuards(ThrottlerGuard)
  @HttpCode(200)
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
  async currentSession(@Req() request: AuthenticatedRequest) {
    if (!request.user) throw invalidAccessToken();
    return this.authService.getCurrentSession(request.user.taiKhoanId);
  }
}
