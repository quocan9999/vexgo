import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SmsOtpMessage, SmsSender } from './sms-sender.js';

const TEXTBEE_BASE_URL = 'https://api.textbee.dev/api/v1/gateway/devices';
const DEFAULT_TIMEOUT_MS = 10000;

@Injectable()
export class TextBeeSmsSender implements SmsSender {
  private readonly logger = new Logger(TextBeeSmsSender.name);
  private readonly apiKey: string;
  private readonly deviceId: string;

  constructor(configService: ConfigService) {
    const apiKey = configService.get<string>('TEXTBEE_API_KEY');
    if (!apiKey || !apiKey.trim()) {
      throw new Error(
        'TEXTBEE_API_KEY is required when using TextBeeSmsSender',
      );
    }
    this.apiKey = apiKey.trim();

    const deviceId = configService.get<string>('TEXTBEE_DEVICE_ID');
    if (!deviceId || !deviceId.trim()) {
      throw new Error(
        'TEXTBEE_DEVICE_ID is required when using TextBeeSmsSender',
      );
    }
    this.deviceId = deviceId.trim();
  }

  async sendOtp({ soDienThoai, otp }: SmsOtpMessage): Promise<void> {
    const recipient = this.normalizePhoneNumberToE164(soDienThoai);
    const message = `Ma xac thuc OTP VexGo cua ban la: ${otp}. Ma co hieu luc trong 5 phut.`;
    const endpoint = `${TEXTBEE_BASE_URL}/${encodeURIComponent(this.deviceId)}/send-sms`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
        },
        body: JSON.stringify({
          recipients: [recipient],
          message,
        }),
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      });

      if (!response.ok) {
        let errorDetail = response.statusText;
        try {
          const errorBody = (await response.json()) as { message?: string };
          if (errorBody?.message) {
            errorDetail = errorBody.message;
          }
        } catch {
          // Ignore JSON parse failure on error body
        }
        throw new Error(`TextBee HTTP error ${response.status}: ${errorDetail}`);
      }

      this.logger.log(
        `[TextBee OTP] Sent OTP to ${recipient} via device ${this.deviceId}`,
      );
    } catch (error) {
      this.logger.error(
        `[TextBee OTP] Delivery to ${recipient} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  private normalizePhoneNumberToE164(raw: string): string {
    const digitsOnly = raw.replace(/\D/g, '');
    if (digitsOnly.startsWith('0')) {
      return `+84${digitsOnly.slice(1)}`;
    }
    if (digitsOnly.startsWith('84')) {
      return `+${digitsOnly}`;
    }
    return `+84${digitsOnly}`;
  }
}
