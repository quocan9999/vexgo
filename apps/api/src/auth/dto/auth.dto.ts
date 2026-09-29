import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  Validate,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Matches,
  isEmail,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { IsDateOnly } from '../../common/validators/is-date-only.validator.js';
import { VIETNAM_E164_PHONE_PATTERN } from '../otp/otp.constants.js';
import { IsPasswordByteLength } from '../validators/is-password-byte-length.validator.js';

const CCCD_PATTERN = /^[0-9]{12}$/;
const EMAIL_MAX_LENGTH = 150;
const LOGIN_PHONE_PATTERN = VIETNAM_E164_PHONE_PATTERN;

@ValidatorConstraint({ name: 'exactlyOneLoginIdentifier', async: false })
class ExactlyOneLoginIdentifierConstraint
  implements ValidatorConstraintInterface
{
  validate(_value: unknown, args: ValidationArguments): boolean {
    const dto = args.object as LoginDto;
    const identifiers = [dto.identifier, dto.phoneNumber].filter(
      (value) => typeof value === 'string' && value.trim().length > 0,
    );
    return identifiers.length === 1;
  }

  defaultMessage(): string {
    return 'Cần cung cấp đúng một số điện thoại hoặc email đăng nhập.';
  }
}

@ValidatorConstraint({ name: 'loginIdentifierFormat', async: false })
class LoginIdentifierFormatConstraint
  implements ValidatorConstraintInterface
{
  validate(value: unknown): boolean {
    return (
      typeof value === 'string' &&
      (LOGIN_PHONE_PATTERN.test(value) || isEmail(value))
    );
  }

  defaultMessage(): string {
    return 'Email hoặc số điện thoại không hợp lệ.';
  }
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
  @MaxLength(EMAIL_MAX_LENGTH)
  email?: string;

  @IsOptional()
  @Matches(CCCD_PATTERN, {
    message: 'CCCD phải gồm đúng 12 chữ số.',
  })
  citizenId?: string;
}

export class LoginDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(EMAIL_MAX_LENGTH)
  @Validate(LoginIdentifierFormatConstraint)
  identifier?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Matches(VIETNAM_E164_PHONE_PATTERN, {
    message: 'Số điện thoại không hợp lệ.',
  })
  phoneNumber?: string;

  @IsString()
  @IsNotEmpty()
  @Validate(ExactlyOneLoginIdentifierConstraint)
  @IsPasswordByteLength()
  password!: string;
}
