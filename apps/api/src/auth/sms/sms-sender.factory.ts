import { ConfigService } from '@nestjs/config';
import type { SmsSender } from './sms-sender.js';
import { ConsoleSmsSender } from './console-sms.sender.js';
import { TextBeeSmsSender } from './textbee-sms.sender.js';

export function createSmsSender(configService: ConfigService): SmsSender {
  const provider = configService.get<string>('SMS_PROVIDER', 'console');

  if (provider === 'textbee') {
    return new TextBeeSmsSender(configService);
  }

  if (provider === 'console') {
    return new ConsoleSmsSender(configService);
  }

  throw new Error(`Unsupported SMS_PROVIDER: ${provider}`);
}
