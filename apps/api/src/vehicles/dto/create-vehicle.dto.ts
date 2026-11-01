import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
  @ApiProperty({
    description: 'Trạng thái ban đầu của xe',
    enum: VEHICLE_STATUSES,
    example: 'HOAT_DONG',
  })
  @IsDefined()
  @IsIn(VEHICLE_STATUSES)
  status!: VehicleStatus;

  @ApiPropertyOptional({
    description: 'Danh sách cấu hình sơ đồ ghế khởi tạo cùng lúc với xe (tối đa 120 ghế)',
    type: [CreateVehicleSeatLayoutItemDto],
  })
  @ValidateIf((_input, value: unknown) => value !== undefined)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(120)
  @ValidateNested({ each: true })
  @Type(() => CreateVehicleSeatLayoutItemDto)
  seats?: CreateVehicleSeatLayoutItemDto[];
}
