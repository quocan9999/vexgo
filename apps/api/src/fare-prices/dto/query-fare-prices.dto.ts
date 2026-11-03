import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import {
  FARE_PRICE_EFFECTIVE_STATES,
  FARE_PRICE_STATUSES,
} from '../fare-price.domain.js';

export const FARE_PRICE_SORT_FIELDS = [
  'listedPrice',
  'validFrom',
  'validTo',
  'status',
] as const;

export type FarePriceSortField = (typeof FARE_PRICE_SORT_FIELDS)[number];

export class QueryFarePricesDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Trường sắp xếp danh sách bảng giá',
    enum: FARE_PRICE_SORT_FIELDS,
    default: 'validFrom',
    example: 'validFrom',
  })
  @IsIn(FARE_PRICE_SORT_FIELDS)
  sortBy: FarePriceSortField = 'validFrom';

  @ApiPropertyOptional({ description: 'Lọc theo ID tuyến xe', example: 1 })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && /^\d+$/.test(value)
      ? Number(value)
      : Number.NaN,
  )
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  routeId?: number;

  @ApiPropertyOptional({ description: 'Lọc theo ID loại phương tiện', example: 1 })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && /^\d+$/.test(value)
      ? Number(value)
      : Number.NaN,
  )
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  vehicleTypeId?: number;

  @ApiPropertyOptional({
    description: 'Lọc theo trạng thái',
    enum: FARE_PRICE_STATUSES,
    example: 'HOAT_DONG',
  })
  @IsOptional()
  @IsIn(FARE_PRICE_STATUSES)
  status?: (typeof FARE_PRICE_STATUSES)[number];

  @ApiPropertyOptional({
    description: 'Lọc theo trạng thái hiệu lực thời gian',
    enum: FARE_PRICE_EFFECTIVE_STATES,
    example: 'EFFECTIVE',
  })
  @IsOptional()
  @IsIn(FARE_PRICE_EFFECTIVE_STATES)
  effectiveState?: (typeof FARE_PRICE_EFFECTIVE_STATES)[number];
}
