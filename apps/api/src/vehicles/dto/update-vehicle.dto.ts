import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { transformStrictPositiveInteger } from './strict-positive-integer.transformer.js';

export class UpdateVehicleDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(15)
  licensePlate!: string;

  @Transform(({ value }) => transformStrictPositiveInteger(value))
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  busCompanyId!: number;

  @Transform(({ value }) => transformStrictPositiveInteger(value))
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  vehicleTypeId!: number;
}
