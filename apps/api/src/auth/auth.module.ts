import { Module } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { OtpCryptoService } from './otp/otp-crypto.service.js';
import { OtpService } from './otp/otp.service.js';
import { ConsoleSmsSender } from './sms/console-sms.sender.js';
import { SMS_SENDER } from './sms/sms-sender.js';
import { JwtModule } from '@nestjs/jwt';
import { TokenService } from './tokens/token.service.js';

@Module({
  imports: [PrismaModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    OtpCryptoService,
    OtpService,
    TokenService,
    ConsoleSmsSender,
    { provide: SMS_SENDER, useExisting: ConsoleSmsSender },
  ],
  exports: [TokenService, JwtModule],
})
export class AuthModule {}
