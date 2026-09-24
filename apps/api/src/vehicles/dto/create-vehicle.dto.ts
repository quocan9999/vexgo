import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { transformStrictPositiveInteger } from './strict-positive-integer.transformer.js';
import { VEHICLE_STATUSES, type VehicleStatus } from './vehicle-status.js';

export class CreateVehicleDto {
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

  @IsIn(VEHICLE_STATUSES)
  status!: VehicleStatus;
}
