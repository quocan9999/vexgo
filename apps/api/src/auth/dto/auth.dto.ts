import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateBy,
} from 'class-validator';
import { IsDateOnly } from '../../common/validators/is-date-only.validator.js';
import { VIETNAM_E164_PHONE_PATTERN } from '../otp/otp.constants.js';

const CCCD_PATTERN = /^[0-9]{12}$/;
const PASSWORD_MIN_BYTES = 8;
const PASSWORD_MAX_BYTES = 72;

function IsPasswordByteLength() {
  return ValidateBy({
    name: 'isPasswordByteLength',
    validator: {
      validate: (value: unknown) =>
        typeof value === 'string' &&
        Buffer.byteLength(value, 'utf8') >= PASSWORD_MIN_BYTES &&
        Buffer.byteLength(value, 'utf8') <= PASSWORD_MAX_BYTES,
      defaultMessage: () =>
        `Mật khẩu phải dài từ ${PASSWORD_MIN_BYTES} đến ${PASSWORD_MAX_BYTES} byte UTF-8.`,
    },
  });
}

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  fullName!: string;

  @IsString()
  @Matches(VIETNAM_E164_PHONE_PATTERN, {
    message: 'Số điện thoại không hợp lệ.',
  })
  phoneNumber!: string;

  @IsString()
  @IsNotEmpty()
  @IsPasswordByteLength()
  password!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  otpProof!: string;

  @IsOptional()
  @IsDateOnly({ message: 'Ngày sinh phải là ngày hợp lệ dạng YYYY-MM-DD.' })
  dateOfBirth?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Email không hợp lệ.' })
  @MaxLength(150)
  email?: string;

  @IsOptional()
  @Matches(CCCD_PATTERN, {
    message: 'CCCD phải gồm đúng 12 chữ số.',
  })
  citizenId?: string;
}

export class LoginDto {
  @IsString()
  @Matches(VIETNAM_E164_PHONE_PATTERN, {
    message: 'Số điện thoại không hợp lệ.',
  })
  phoneNumber!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}
