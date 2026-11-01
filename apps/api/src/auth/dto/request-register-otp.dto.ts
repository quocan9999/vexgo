import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';
import { VIETNAM_E164_PHONE_PATTERN } from '../otp/otp.constants.js';

export class RequestRegisterOtpDto {
  @ApiProperty({
    description: 'Số điện thoại Việt Nam chuẩn E.164 (bắt đầu bằng +84 hoặc 0)',
    example: '+84912345678',
  })
  @IsString({ message: 'phoneNumber must be a string' })
  @Matches(VIETNAM_E164_PHONE_PATTERN, {
    message: 'phoneNumber must be a valid Vietnamese E.164 phone number',
  })
  phoneNumber!: string;
}
