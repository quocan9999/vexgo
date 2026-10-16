import { IsPromotionDateOnly } from './promotion-validators.js';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const PROMOTION_SORT_FIELDS = [
  'name',
  'code',
  'startsOn',
  'endsOn',
  'usageCount',
  'status',
  'createdAt',
] as const;

export class PromotionListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsIn(['HOAT_DONG', 'TAM_NGUNG'])
  status?: 'HOAT_DONG' | 'TAM_NGUNG';

  @IsOptional()
  @IsPromotionDateOnly()
  fromDate?: string;

  @IsOptional()
  @IsPromotionDateOnly()
  toDate?: string;

  @IsOptional()
  @IsIn(PROMOTION_SORT_FIELDS)
  sortBy?: (typeof PROMOTION_SORT_FIELDS)[number];

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDirection?: 'asc' | 'desc';
}
