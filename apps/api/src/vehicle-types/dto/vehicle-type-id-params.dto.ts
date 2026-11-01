import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class VehicleTypeIdParamsDto {
  @ApiProperty({ description: 'ID định danh loại xe', example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id!: number;
}
