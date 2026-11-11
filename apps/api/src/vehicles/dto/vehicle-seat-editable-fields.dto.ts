import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDefined,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class VehicleSeatEditableFieldsDto {
  @ApiProperty({ description: 'Mã số / Tên ghế (ví dụ: A01, B02, 12)', example: 'A01' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  seatNumber!: string;

  @ApiPropertyOptional({ description: 'Vị trí mô tả của ghế (ví dụ: Gần cửa sổ, Cạnh lối đi)', example: 'Cửa sổ bên trái' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() || null : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(50)
  position?: string | null;

  @ApiPropertyOptional({ description: 'Tầng của ghế (1: Tầng dưới, 2: Tầng trên)', example: 1, minimum: 1, maximum: 2 })
  @ValidateIf((value: VehicleSeatEditableFieldsDto) =>
    value.floor !== undefined || value.x !== undefined || value.y !== undefined,
  )
  @IsDefined()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2)
  floor?: number;

  @ApiPropertyOptional({ description: 'Tọa độ X trên sơ đồ bố trí ghế (110 - 890)', example: 150 })
  @ValidateIf((value: VehicleSeatEditableFieldsDto) =>
    value.floor !== undefined || value.x !== undefined || value.y !== undefined,
  )
  @IsDefined()
  @Type(() => Number)
  @IsInt()
  @Min(110)
  @Max(890)
  x?: number;

  @ApiPropertyOptional({ description: 'Tọa độ Y trên sơ đồ bố trí ghế (1000 - 30000)', example: 2000 })
  @ValidateIf((value: VehicleSeatEditableFieldsDto) =>
    value.floor !== undefined || value.x !== undefined || value.y !== undefined,
  )
  @IsDefined()
  @Type(() => Number)
  @IsInt()
  @Min(1000)
  @Max(30000)
  y?: number;
}
