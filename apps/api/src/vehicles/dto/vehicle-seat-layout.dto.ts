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
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  seatNumber!: string;

  @IsDefined()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2)
  floor!: number;

  @IsDefined()
  @Type(() => Number)
  @IsInt()
  @Min(110)
  @Max(890)
  x!: number;

  @IsDefined()
  @Type(() => Number)
  @IsInt()
  @Min(1000)
  @Max(30000)
  y!: number;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() || null : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(50)
  position?: string | null;
}

export class UpdateVehicleSeatLayoutItemDto {
  @IsDefined()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  seatId!: number;

  @IsDefined()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2)
  floor!: number;

  @IsDefined()
  @Type(() => Number)
  @IsInt()
  @Min(110)
  @Max(890)
  x!: number;

  @IsDefined()
  @Type(() => Number)
  @IsInt()
  @Min(1000)
  @Max(30000)
  y!: number;
}

export class UpdateVehicleSeatLayoutDto {
  @IsDefined()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(120)
  @ValidateNested({ each: true })
  @Type(() => UpdateVehicleSeatLayoutItemDto)
  seats!: UpdateVehicleSeatLayoutItemDto[];
}
