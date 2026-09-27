import { IsString, IsUUID, Matches } from 'class-validator';
import {
  SIX_DIGIT_OTP_PATTERN,
  VIETNAM_E164_PHONE_PATTERN,
} from '../otp/otp.constants.js';

export class VerifyRegisterOtpDto {
  @IsUUID('4', { message: 'challengeId must be a UUID' })
  challengeId!: string;

  @IsString({ message: 'soDienThoai must be a string' })
  @Matches(VIETNAM_E164_PHONE_PATTERN, {
    message: 'soDienThoai must be a valid Vietnamese E.164 phone number',
  })
  soDienThoai!: string;

  @IsString({ message: 'otp must be a string' })
  @Matches(SIX_DIGIT_OTP_PATTERN, { message: 'otp must contain six digits' })
  otp!: string;
}
