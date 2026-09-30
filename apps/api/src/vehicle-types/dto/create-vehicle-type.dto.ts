import { VehicleTypeWriteFieldsDto } from './vehicle-type-write-fields.dto.js';
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class CreateVehicleTypeDto extends VehicleTypeWriteFieldsDto {
  // Compatibility field; tenant authorization is derived from the authenticated principal.
  @Type(() => Number)
  @IsInt()
  @Min(1)
  busCompanyId!: number;
}
