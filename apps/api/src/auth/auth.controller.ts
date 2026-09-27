import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { RegisterDto, LoginDto } from './dto/auth.dto.js';
import { RequestRegisterOtpDto } from './dto/request-register-otp.dto.js';
import { OtpService } from './otp/otp.service.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly otpService: OtpService,
  ) {}

  @Post('register/request-otp')
  requestRegisterOtp(@Body() dto: RequestRegisterOtpDto) {
    return this.otpService.requestRegistrationOtp(dto.soDienThoai);
  }

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return await this.authService.register(dto);
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return await this.authService.login(dto);
  }
}
