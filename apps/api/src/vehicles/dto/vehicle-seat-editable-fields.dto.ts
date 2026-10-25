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
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  seatNumber!: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() || null : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(50)
  position?: string | null;

  @ValidateIf((value: VehicleSeatEditableFieldsDto) =>
    value.floor !== undefined || value.x !== undefined || value.y !== undefined,
  )
  @IsDefined()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2)
  floor?: number;

  @ValidateIf((value: VehicleSeatEditableFieldsDto) =>
    value.floor !== undefined || value.x !== undefined || value.y !== undefined,
  )
  @IsDefined()
  @Type(() => Number)
  @IsInt()
  @Min(110)
  @Max(890)
  x?: number;

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
