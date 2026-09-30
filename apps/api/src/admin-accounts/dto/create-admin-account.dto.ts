import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  IsInt,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { IsDateOnly } from '../../common/validators/is-date-only.validator.js';
import { VIETNAM_E164_PHONE_PATTERN } from '../../auth/otp/otp.constants.js';
import { IsPasswordByteLength } from '../../auth/validators/is-password-byte-length.validator.js';

const CCCD_PATTERN = /^\d{12}$/;

function strictInteger(value: unknown) {
  return typeof value === 'string' && /^\d+$/.test(value)
    ? Number(value)
    : value;
}

export class CreateAdminAccountDto {
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

  @Transform(({ value }) => strictInteger(value))
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  busCompanyId!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  employeeCode!: string;

  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsDateOnly({ message: 'Ngày sinh phải là ngày hợp lệ dạng YYYY-MM-DD.' })
  dateOfBirth?: string | null;

  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsEmail({}, { message: 'Email không hợp lệ.' })
  @MaxLength(150)
  email?: string | null;

  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @Matches(CCCD_PATTERN, { message: 'CCCD phải gồm đúng 12 chữ số.' })
  citizenId?: string | null;
}
