import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export abstract class VehicleTypeWriteFieldsDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
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
}
