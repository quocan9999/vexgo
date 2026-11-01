import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export abstract class VehicleTypeWriteFieldsDto {
  @ApiProperty({ description: 'Tên loại xe', example: 'Giường nằm 36 chỗ VIP' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ description: 'Mô tả tiện ích của loại xe', example: 'Wifi, cổng sạc, khăn lạnh, nước uống' })
  @Transform(({ value }) => {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'string') return value;
    return value.trim() || null;
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @ApiPropertyOptional({ description: 'Sức chứa xe máy mặc định trong cốp xe', example: 4, default: 0 })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(2_147_483_647)
  motorbikeCapacityDefault?: number;

  @ApiPropertyOptional({ description: 'Sức chứa hàng cồng kềnh mặc định (kiện)', example: 10, default: 0 })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(2_147_483_647)
  bulkyCargoCapacityDefault?: number;

  @ApiPropertyOptional({ description: 'Sức chứa hàng thông thường/nhẹ mặc định (kiện)', example: 30, default: 0 })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(2_147_483_647)
  lightCargoCapacityDefault?: number;
}
