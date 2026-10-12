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
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @Transform(({ value }) => {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'string') return value;
    return value.trim() || null;
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(2_147_483_647)
  motorbikeCapacityDefault?: number;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(2_147_483_647)
  bulkyCargoCapacityDefault?: number;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(2_147_483_647)
  lightCargoCapacityDefault?: number;
}
