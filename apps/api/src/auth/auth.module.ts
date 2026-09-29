import { Module } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { OtpCryptoService } from './otp/otp-crypto.service.js';
import { OtpService } from './otp/otp.service.js';
import { ConsoleSmsSender } from './sms/console-sms.sender.js';
import { SMS_SENDER } from './sms/sms-sender.js';
import { JwtModule } from '@nestjs/jwt';
import { TokenService } from './tokens/token.service.js';
import { AccessTokenGuard } from './guards/access-token.guard.js';

@Module({
  imports: [PrismaModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    OtpCryptoService,
    OtpService,
    TokenService,
    Reflector,
    AccessTokenGuard,
    { provide: APP_GUARD, useExisting: AccessTokenGuard },
    ConsoleSmsSender,
    { provide: SMS_SENDER, useExisting: ConsoleSmsSender },
  ],
  exports: [TokenService, AccessTokenGuard, JwtModule],
})
export class AuthModule {}
