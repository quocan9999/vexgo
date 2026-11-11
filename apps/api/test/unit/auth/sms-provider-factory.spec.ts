import { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';
import { createSmsSender } from '../../../src/auth/sms/sms-sender.factory.js';
import { ConsoleSmsSender } from '../../../src/auth/sms/console-sms.sender.js';
import { TextBeeSmsSender } from '../../../src/auth/sms/textbee-sms.sender.js';

describe('createSmsSender factory', () => {
  it('instantiates TextBeeSmsSender when SMS_PROVIDER is textbee', () => {
    const config = new ConfigService({
      SMS_PROVIDER: 'textbee',
      TEXTBEE_API_KEY: 'valid_api_key',
      TEXTBEE_DEVICE_ID: 'valid_device_id',
    });

    const sender = createSmsSender(config);
    expect(sender).toBeInstanceOf(TextBeeSmsSender);
  });

  it('instantiates ConsoleSmsSender when SMS_PROVIDER is console', () => {
    const config = new ConfigService({
      SMS_PROVIDER: 'console',
      NODE_ENV: 'development',
    });

    const sender = createSmsSender(config);
    expect(sender).toBeInstanceOf(ConsoleSmsSender);
  });

  it('defaults to ConsoleSmsSender when SMS_PROVIDER is omitted', () => {
    const config = new ConfigService({
      NODE_ENV: 'development',
    });

    const sender = createSmsSender(config);
    expect(sender).toBeInstanceOf(ConsoleSmsSender);
  });

  it('throws an error when SMS_PROVIDER is unknown', () => {
    const config = new ConfigService({
      SMS_PROVIDER: 'invalid_provider',
    });

    expect(() => createSmsSender(config)).toThrow(
      'Unsupported SMS_PROVIDER: invalid_provider',
    );
  });
});
