import { VehicleTypeWriteFieldsDto } from './vehicle-type-write-fields.dto.js';
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class CreateVehicleTypeDto extends VehicleTypeWriteFieldsDto {
  // Resource ownership assignment for platform CRUD; this is not an authenticated tenant identity.
  @Type(() => Number)
  @IsInt()
  @Min(1)
  busCompanyId!: number;
}
