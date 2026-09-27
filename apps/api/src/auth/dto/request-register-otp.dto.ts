import { IsString, Matches } from 'class-validator';
import { VIETNAM_E164_PHONE_PATTERN } from '../otp/otp.constants.js';

export class RequestRegisterOtpDto {
  @IsString({ message: 'soDienThoai must be a string' })
  @Matches(VIETNAM_E164_PHONE_PATTERN, {
    message: 'soDienThoai must be a valid Vietnamese E.164 phone number',
  })
  soDienThoai!: string;
}
