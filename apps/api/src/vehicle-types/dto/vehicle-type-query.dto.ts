import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';

export const VEHICLE_TYPE_SORT_FIELDS = [
  'name',
  'createdAt',
  'updatedAt',
] as const;

export type VehicleTypeSortField = (typeof VEHICLE_TYPE_SORT_FIELDS)[number];

export class VehicleTypeQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Trường sắp xếp danh sách loại xe',
    enum: VEHICLE_TYPE_SORT_FIELDS,
    default: 'name',
    example: 'name',
  })
  @IsIn(VEHICLE_TYPE_SORT_FIELDS)
  sortBy: VehicleTypeSortField = 'name';
}
