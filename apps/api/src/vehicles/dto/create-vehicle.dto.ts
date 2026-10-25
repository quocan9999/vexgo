import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDefined,
  IsIn,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { VEHICLE_STATUSES, type VehicleStatus } from './vehicle-query.dto.js';
import { VehicleEditableFieldsDto } from './vehicle-editable-fields.dto.js';
import { CreateVehicleSeatLayoutItemDto } from './vehicle-seat-layout.dto.js';

export class CreateVehicleDto extends VehicleEditableFieldsDto {
  @IsDefined()
  @IsIn(VEHICLE_STATUSES)
  status!: VehicleStatus;

  @ValidateIf((_input, value: unknown) => value !== undefined)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(120)
  @ValidateNested({ each: true })
  @Type(() => CreateVehicleSeatLayoutItemDto)
  seats?: CreateVehicleSeatLayoutItemDto[];
}
