import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  BUS_COMPANY_STATUSES,
  type BusCompanyStatus,
} from './bus-company-query.dto.js';

export class CreateBusCompanyDto {
  @ApiProperty({ description: 'Mã định danh viết tắt của nhà xe (duy nhất)', example: 'FUTA' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code!: string;

  @ApiProperty({ description: 'Tên thương hiệu nhà xe', example: 'Công ty Cổ phần Xe khách Phương Trang' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @ApiPropertyOptional({
    description: 'Thông tin liên hệ (hotline, email, địa chỉ trụ sở)',
    example: 'Hotline: 1900 6067 - Email: hotro@futabus.vn',
  })
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const contactInfo = value.trim();
    return contactInfo || null;
  })
  @IsOptional()
  @IsString()
  contactInfo?: string | null;

  @ApiProperty({
    description: 'Trạng thái hoạt động ban đầu của nhà xe',
    enum: BUS_COMPANY_STATUSES,
    example: 'HOAT_DONG',
  })
  @IsIn(BUS_COMPANY_STATUSES)
  status!: BusCompanyStatus;
}
