import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDefined,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateVehicleSeatLayoutItemDto {
  @ApiProperty({ description: 'Mã số ghế', example: 'A01' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  seatNumber!: string;

  @ApiProperty({ description: 'Tầng (1 hoặc 2)', example: 1, minimum: 1, maximum: 2 })
  @IsDefined()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2)
  floor!: number;

  @ApiProperty({ description: 'Tọa độ X (110 - 890)', example: 150 })
  @IsDefined()
  @Type(() => Number)
  @IsInt()
  @Min(110)
  @Max(890)
  x!: number;

  @ApiProperty({ description: 'Tọa độ Y (1000 - 30000)', example: 2000 })
  @IsDefined()
  @Type(() => Number)
  @IsInt()
  @Min(1000)
  @Max(30000)
  y!: number;

  @ApiPropertyOptional({ description: 'Vị trí mô tả', example: 'Tầng dưới, dãy trái' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() || null : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(50)
  position?: string | null;
}

export class UpdateVehicleSeatLayoutItemDto {
  @ApiProperty({ description: 'ID định danh ghế trong cơ sở dữ liệu', example: 12 })
  @IsDefined()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  seatId!: number;

  @ApiProperty({ description: 'Tầng (1 hoặc 2)', example: 1, minimum: 1, maximum: 2 })
  @IsDefined()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2)
  floor!: number;

  @ApiProperty({ description: 'Tọa độ X', example: 150 })
  @IsDefined()
  @Type(() => Number)
  @IsInt()
  @Min(110)
  @Max(890)
  x!: number;

  @ApiProperty({ description: 'Tọa độ Y', example: 2000 })
  @IsDefined()
  @Type(() => Number)
  @IsInt()
  @Min(1000)
  @Max(30000)
  y!: number;
}

export class UpdateVehicleSeatLayoutDto {
  @ApiProperty({
    description: 'Danh sách tọa độ và tầng cập nhật cho các ghế trên xe',
    type: [UpdateVehicleSeatLayoutItemDto],
  })
  @IsDefined()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(120)
  @ValidateNested({ each: true })
  @Type(() => UpdateVehicleSeatLayoutItemDto)
  seats!: UpdateVehicleSeatLayoutItemDto[];
}
