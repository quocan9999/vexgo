import { IsDefined, IsIn } from 'class-validator';
import { VEHICLE_STATUSES, type VehicleStatus } from './vehicle-query.dto.js';

export class UpdateVehicleStatusDto {
  @IsDefined()
  @IsIn(VEHICLE_STATUSES)
  status!: VehicleStatus;
}
