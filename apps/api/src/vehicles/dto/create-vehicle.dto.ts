import { IsDefined, IsIn } from 'class-validator';
import { VEHICLE_STATUSES, type VehicleStatus } from './vehicle-query.dto.js';
import { VehicleEditableFieldsDto } from './vehicle-editable-fields.dto.js';

export class CreateVehicleDto extends VehicleEditableFieldsDto {
  @IsDefined()
  @IsIn(VEHICLE_STATUSES)
  status!: VehicleStatus;
}
