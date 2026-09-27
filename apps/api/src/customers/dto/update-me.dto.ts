import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { IsDateOnly } from '../../common/validators/is-date-only.validator.js';

const CCCD_PATTERN = /^\d{12}$/;

export class UpdateMeDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  hoTen?: string;

  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsDateOnly({ message: 'Ngày sinh phải là ngày hợp lệ dạng YYYY-MM-DD.' })
  ngaySinh?: string | null;

  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsEmail({}, { message: 'Email không hợp lệ.' })
  @MaxLength(150)
  email?: string | null;

  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @Matches(CCCD_PATTERN, { message: 'CCCD phải gồm đúng 12 chữ số.' })
  cccd?: string | null;
}
