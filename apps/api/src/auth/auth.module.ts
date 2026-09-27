import { Module } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { OtpCryptoService } from './otp/otp-crypto.service.js';
import { OtpService } from './otp/otp.service.js';
import { ConsoleSmsSender } from './sms/console-sms.sender.js';
import { SMS_SENDER } from './sms/sms-sender.js';

@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    OtpCryptoService,
    OtpService,
    ConsoleSmsSender,
    { provide: SMS_SENDER, useExisting: ConsoleSmsSender },
  ],
})
export class AuthModule {}
