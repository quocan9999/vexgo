import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
  @ApiProperty({ description: 'Họ và tên đầy đủ của khách hàng', example: 'Nguyễn Văn A' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  fullName!: string;

  @ApiProperty({
    description: 'Số điện thoại Việt Nam chuẩn E.164 (đã xác thực OTP)',
    example: '+84912345678',
  })
  @IsString()
  @Matches(VIETNAM_E164_PHONE_PATTERN, {
    message: 'Số điện thoại không hợp lệ.',
  })
  phoneNumber!: string;

  @ApiProperty({
    description: 'Mật khẩu bảo mật của tài khoản (tối thiểu 6 ký tự, tối đa 72 bytes)',
    example: 'MatKhau@123',
  })
  @IsString()
  @IsNotEmpty()
  @IsPasswordByteLength()
  password!: string;

  @ApiProperty({
    description: 'Mã bằng chứng xác thực OTP nhận được sau khi verify OTP thành công',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  otpProof!: string;

  @ApiPropertyOptional({
    description: 'Ngày sinh (định dạng DD-MM-YYYY hoặc YYYY-MM-DD)',
    example: '15-08-1995',
  })
  @IsOptional()
  @IsDateOnly({ message: 'Ngày sinh phải là ngày hợp lệ dạng YYYY-MM-DD.' })
  dateOfBirth?: string;

  @ApiPropertyOptional({
    description: 'Địa chỉ email liên hệ',
    example: 'nguyenvana@gmail.com',
  })
  @IsOptional()
  @IsEmail({}, { message: 'Email không hợp lệ.' })
  @MaxLength(EMAIL_MAX_LENGTH)
  email?: string;

  @ApiPropertyOptional({
    description: 'Số Căn cước công dân (gồm đúng 12 chữ số)',
    example: '079195001234',
  })
  @IsOptional()
  @Matches(CCCD_PATTERN, {
    message: 'CCCD phải gồm đúng 12 chữ số.',
  })
  citizenId?: string;
}

export class LoginDto {
  @ApiPropertyOptional({
    description: 'Email hoặc số điện thoại định danh để đăng nhập (áp dụng cho tài khoản Admin/Nhân viên)',
    example: 'admin@vexgo.vn',
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(EMAIL_MAX_LENGTH)
  @Validate(LoginIdentifierFormatConstraint)
  identifier?: string;

  @ApiPropertyOptional({
    description: 'Số điện thoại chuẩn E.164 để đăng nhập (áp dụng cho Khách hàng)',
    example: '+84912345678',
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Matches(VIETNAM_E164_PHONE_PATTERN, {
    message: 'Số điện thoại không hợp lệ.',
  })
  phoneNumber?: string;

  @ApiProperty({
    description: 'Mật khẩu đăng nhập',
    example: 'MatKhau@123',
  })
  @IsString()
  @IsNotEmpty()
  @Validate(ExactlyOneLoginIdentifierConstraint)
  @IsPasswordByteLength()
  password!: string;
}
