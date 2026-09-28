import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { RegisterDto, LoginDto } from './dto/auth.dto.js';
import { RequestRegisterOtpDto } from './dto/request-register-otp.dto.js';
import { VerifyRegisterOtpDto } from './dto/verify-register-otp.dto.js';
import { OtpService } from './otp/otp.service.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly otpService: OtpService,
  ) {}

  @Post('register/request-otp')
  requestRegisterOtp(@Body() dto: RequestRegisterOtpDto) {
    return this.otpService.requestRegistrationOtp(dto.phoneNumber);
  }

  @Post('register/verify-otp')
  verifyRegisterOtp(@Body() dto: VerifyRegisterOtpDto) {
    return this.otpService.verifyRegistrationOtp({
      challengeId: dto.challengeId,
      soDienThoai: dto.phoneNumber,
      otp: dto.otp,
    });
  }

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return await this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto) {
    return await this.authService.login(dto);
  }

  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Body() dto: RefreshTokenDto): Promise<void> {
    await this.authService.logout(dto.refreshToken);
  }
}
