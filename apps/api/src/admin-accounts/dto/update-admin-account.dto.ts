import { ApiPropertyOptional } from '@nestjs/swagger';
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

export class UpdateAdminAccountDto {
  @ApiPropertyOptional({ description: 'Họ và tên nhân viên', example: 'Trần Văn B' })
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  fullName?: string;

  @ApiPropertyOptional({ description: 'Ngày sinh (DD-MM-YYYY hoặc YYYY-MM-DD)', example: '20-10-1990' })
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsDateOnly({ message: 'Ngày sinh phải là ngày hợp lệ dạng YYYY-MM-DD.' })
  dateOfBirth?: string | null;

  @ApiPropertyOptional({ description: 'Địa chỉ email liên hệ', example: 'b.tran@phuongtrang.vn' })
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsEmail({}, { message: 'Email không hợp lệ.' })
  @MaxLength(150)
  email?: string | null;

  @ApiPropertyOptional({ description: 'Số CCCD (12 chữ số)', example: '079190001234' })
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @Matches(CCCD_PATTERN, { message: 'CCCD phải gồm đúng 12 chữ số.' })
  citizenId?: string | null;
}
