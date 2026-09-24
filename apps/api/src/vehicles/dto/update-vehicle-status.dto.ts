import { IsIn } from 'class-validator';
import { VEHICLE_STATUSES, type VehicleStatus } from './vehicle-status.js';

export class UpdateVehicleStatusDto {
  @IsIn(VEHICLE_STATUSES)
  status!: VehicleStatus;
}
