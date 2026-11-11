import { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TextBeeSmsSender } from '../../../src/auth/sms/textbee-sms.sender.js';

describe('TextBeeSmsSender', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('Configuration validation', () => {
    it('throws an error if TEXTBEE_API_KEY is missing or empty', () => {
      const config = new ConfigService({
        TEXTBEE_DEVICE_ID: 'device_123',
      });
      expect(() => new TextBeeSmsSender(config)).toThrow(
        'TEXTBEE_API_KEY is required when using TextBeeSmsSender',
      );
    });

    it('throws an error if TEXTBEE_DEVICE_ID is missing or empty', () => {
      const config = new ConfigService({
        TEXTBEE_API_KEY: 'api_key_123',
      });
      expect(() => new TextBeeSmsSender(config)).toThrow(
        'TEXTBEE_DEVICE_ID is required when using TextBeeSmsSender',
      );
    });
  });

  describe('Phone number normalization', () => {
    it('normalizes Vietnamese phone numbers to E.164 +84 format', async () => {
      let capturedBody: { recipients: string[]; message: string } | null = null;
      globalThis.fetch = vi.fn().mockImplementation(async (_url, options) => {
        capturedBody = JSON.parse(options.body as string);
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: { success: true } }),
        } as Response;
      });

      const config = new ConfigService({
        TEXTBEE_API_KEY: 'mock_key',
        TEXTBEE_DEVICE_ID: 'mock_device',
      });
      const sender = new TextBeeSmsSender(config);

      await sender.sendOtp({ soDienThoai: '0987654321', otp: '123456' });
      expect(capturedBody?.recipients).toEqual(['+84987654321']);

      await sender.sendOtp({ soDienThoai: '84987654321', otp: '123456' });
      expect(capturedBody?.recipients).toEqual(['+84987654321']);

      await sender.sendOtp({ soDienThoai: '+84987654321', otp: '123456' });
      expect(capturedBody?.recipients).toEqual(['+84987654321']);

      await sender.sendOtp({ soDienThoai: '098 765 4321', otp: '123456' });
      expect(capturedBody?.recipients).toEqual(['+84987654321']);
    });
  });

  describe('Sending SMS via TextBee API', () => {
    it('sends POST request with x-api-key header and correct payload to device endpoint', async () => {
      let capturedUrl = '';
      let capturedOptions: RequestInit | undefined;

      globalThis.fetch = vi.fn().mockImplementation(async (url, options) => {
        capturedUrl = url.toString();
        capturedOptions = options;
        return {
          ok: true,
          status: 201,
          json: async () => ({ data: { success: true } }),
        } as Response;
      });

      const config = new ConfigService({
        TEXTBEE_API_KEY: 'tb_live_key_abc',
        TEXTBEE_DEVICE_ID: '65f1a2b3c4d5e6f7a8b9c0d1',
      });
      const sender = new TextBeeSmsSender(config);

      await sender.sendOtp({ soDienThoai: '0912345678', otp: '654321' });

      expect(capturedUrl).toBe(
        'https://api.textbee.dev/api/v1/gateway/devices/65f1a2b3c4d5e6f7a8b9c0d1/send-sms',
      );
      expect(capturedOptions?.method).toBe('POST');
      expect(capturedOptions?.headers).toEqual({
        'Content-Type': 'application/json',
        'x-api-key': 'tb_live_key_abc',
      });

      const parsedBody = JSON.parse(capturedOptions?.body as string);
      expect(parsedBody).toEqual({
        recipients: ['+84912345678'],
        message:
          'Ma xac thuc OTP VexGo cua ban la: 654321. Ma co hieu luc trong 5 phut.',
      });
    });
  });

  describe('Error handling', () => {
    it('throws error when TextBee API returns HTTP non-2xx status', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ message: 'Invalid API key' }),
      } as Response);

      const config = new ConfigService({
        TEXTBEE_API_KEY: 'bad_key',
        TEXTBEE_DEVICE_ID: 'dev_1',
      });
      const sender = new TextBeeSmsSender(config);

      await expect(
        sender.sendOtp({ soDienThoai: '0912345678', otp: '123456' }),
      ).rejects.toThrow('TextBee HTTP error 401: Invalid API key');
    });

    it('throws error on network failure or abort timeout', async () => {
      globalThis.fetch = vi
        .fn()
        .mockRejectedValue(new Error('The operation was aborted due to timeout'));

      const config = new ConfigService({
        TEXTBEE_API_KEY: 'key',
        TEXTBEE_DEVICE_ID: 'dev_1',
      });
      const sender = new TextBeeSmsSender(config);

      await expect(
        sender.sendOtp({ soDienThoai: '0912345678', otp: '123456' }),
      ).rejects.toThrow('The operation was aborted due to timeout');
    });
  });
});
