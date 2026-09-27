import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SmsOtpMessage, SmsSender } from './sms-sender.js';

@Injectable()
export class ConsoleSmsSender implements SmsSender {
  private readonly logger = new Logger(ConsoleSmsSender.name);

  constructor(configService: ConfigService) {
    const provider = configService.get<string>('OTP_PROVIDER', 'console');
    const environment = configService.get<string>('NODE_ENV', 'development');
    if (provider !== 'console' || environment === 'production') {
      throw new Error(
        'ConsoleSmsSender is only available locally with OTP_PROVIDER=console',
      );
    }
  }

  async sendOtp({ soDienThoai, otp }: SmsOtpMessage): Promise<void> {
    this.logger.log(`[LOCAL OTP] ${soDienThoai}: ${otp}`);
  }
}
