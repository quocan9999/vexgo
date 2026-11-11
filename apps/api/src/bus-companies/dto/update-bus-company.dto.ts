import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateBusCompanyDto {
  @ApiProperty({ description: 'Mã định danh viết tắt của nhà xe', example: 'FUTA' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code!: string;

  @ApiProperty({ description: 'Tên nhà xe', example: 'Phương Trang FUTA Bus Lines' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @ApiPropertyOptional({
    description: 'Thông tin liên hệ (hotline, email, địa chỉ)',
    example: 'Hotline: 1900 6067',
  })
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const contactInfo = value.trim();
    return contactInfo || null;
  })
  @IsOptional()
  @IsString()
  contactInfo?: string | null;
}
