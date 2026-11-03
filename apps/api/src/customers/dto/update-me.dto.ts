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

export class UpdateMeDto {
  @ApiPropertyOptional({
    description: 'Họ và tên khách hàng',
    example: 'Nguyễn Văn A',
    maxLength: 100,
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  fullName?: string;

  @ApiPropertyOptional({
    description: 'Ngày sinh (định dạng YYYY-MM-DD hoặc DD-MM-YYYY)',
    example: '1995-05-20',
    nullable: true,
  })
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsDateOnly({ message: 'Ngày sinh phải là ngày hợp lệ dạng YYYY-MM-DD.' })
  dateOfBirth?: string | null;

  @ApiPropertyOptional({
    description: 'Địa chỉ email liên hệ',
    example: 'nguyenvana@gmail.com',
    nullable: true,
    maxLength: 150,
  })
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsEmail({}, { message: 'Email không hợp lệ.' })
  @MaxLength(150)
  email?: string | null;

  @ApiPropertyOptional({
    description: 'Số căn cước công dân (gồm 12 chữ số)',
    example: '079199012345',
    nullable: true,
  })
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @Matches(CCCD_PATTERN, { message: 'CCCD phải gồm đúng 12 chữ số.' })
  citizenId?: string | null;
}
