import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import {
  SIX_DIGIT_OTP_PATTERN,
  VIETNAM_E164_PHONE_PATTERN,
} from '../otp/otp.constants.js';
import { IsPasswordByteLength } from '../validators/is-password-byte-length.validator.js';

export class RequestForgotPasswordOtpDto {
  @ApiProperty({
    description: 'Số điện thoại tài khoản Khách hàng cần đặt lại mật khẩu (chuẩn E.164)',
    example: '+84912345678',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Matches(VIETNAM_E164_PHONE_PATTERN, {
    message: 'Số điện thoại không hợp lệ.',
  })
  phoneNumber!: string;
}

export class VerifyForgotPasswordOtpDto {
  @ApiProperty({
    description: 'Mã challenge OTP nhận được khi yêu cầu OTP',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsNotEmpty()
  @IsUUID('4', { message: 'Mã challenge OTP không hợp lệ.' })
  challengeId!: string;

  @ApiProperty({
    description: 'Số điện thoại nhận OTP (chuẩn E.164)',
    example: '+84912345678',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Matches(VIETNAM_E164_PHONE_PATTERN, {
    message: 'Số điện thoại không hợp lệ.',
  })
  phoneNumber!: string;

  @ApiProperty({
    description: 'Mã xác thực OTP gồm đúng 6 chữ số',
    example: '123456',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Matches(SIX_DIGIT_OTP_PATTERN, {
    message: 'Mã OTP phải gồm đúng 6 chữ số.',
  })
  otp!: string;
}

export class ResetForgotPasswordDto {
  @ApiProperty({
    description: 'Số điện thoại tài khoản Khách hàng (chuẩn E.164)',
    example: '+84912345678',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Matches(VIETNAM_E164_PHONE_PATTERN, {
    message: 'Số điện thoại không hợp lệ.',
  })
  phoneNumber!: string;

  @ApiProperty({
    description: 'Bằng chứng xác thực OTP nhận được sau khi verify OTP thành công',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  otpProof!: string;

  @ApiProperty({
    description: 'Mật khẩu mới (tối thiểu 8 ký tự, tối đa 72 bytes UTF-8)',
    example: 'MatKhauMoi@123',
  })
  @IsString()
  @IsNotEmpty()
  @IsPasswordByteLength()
  newPassword!: string;
}
