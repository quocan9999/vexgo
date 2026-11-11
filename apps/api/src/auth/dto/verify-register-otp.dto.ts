import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, Matches } from 'class-validator';
import {
  SIX_DIGIT_OTP_PATTERN,
  VIETNAM_E164_PHONE_PATTERN,
} from '../otp/otp.constants.js';

export class VerifyRegisterOtpDto {
  @ApiProperty({
    description: 'Mã định danh thử thách OTP nhận được từ bước yêu cầu gửi OTP',
    example: 'c2b4e876-0f8d-4f19-b69c-9c7db3e29f8a',
  })
  @IsUUID('4', { message: 'challengeId must be a UUID' })
  challengeId!: string;

  @ApiProperty({
    description: 'Số điện thoại nhận mã OTP (chuẩn E.164)',
    example: '+84912345678',
  })
  @IsString({ message: 'phoneNumber must be a string' })
  @Matches(VIETNAM_E164_PHONE_PATTERN, {
    message: 'phoneNumber must be a valid Vietnamese E.164 phone number',
  })
  phoneNumber!: string;

  @ApiProperty({
    description: 'Mã xác thực OTP gồm đúng 6 chữ số',
    example: '123456',
  })
  @IsString({ message: 'otp must be a string' })
  @Matches(SIX_DIGIT_OTP_PATTERN, { message: 'otp must contain six digits' })
  otp!: string;
}
