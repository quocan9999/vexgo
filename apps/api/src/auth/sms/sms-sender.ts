export const SMS_SENDER = Symbol('SMS_SENDER');

export interface SmsOtpMessage {
  soDienThoai: string;
  otp: string;
}

export interface SmsSender {
  sendOtp(message: SmsOtpMessage): Promise<void>;
}
