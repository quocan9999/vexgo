import { ApiProperty } from '@nestjs/swagger';
import { VehicleTypeWriteFieldsDto } from './vehicle-type-write-fields.dto.js';
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class CreateVehicleTypeDto extends VehicleTypeWriteFieldsDto {
  @ApiProperty({ description: 'ID nhà xe sở hữu loại xe này', example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  busCompanyId!: number;
}
