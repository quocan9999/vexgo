import { ApiPropertyOptional } from '@nestjs/swagger';
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
import { IsPromotionDateOnly } from './promotion-validators.js';

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
  @ApiPropertyOptional({
    description: 'Trang truy vấn',
    default: 1,
    example: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    description: 'Số lượng bản ghi trên một trang',
    default: 10,
    example: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @ApiPropertyOptional({
    description: 'Từ khóa tìm kiếm (tên hoặc mã khuyến mãi)',
    example: 'VEXGO',
    maxLength: 100,
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    description: 'Lọc theo trạng thái khuyến mãi',
    enum: ['HOAT_DONG', 'TAM_NGUNG'],
    example: 'HOAT_DONG',
  })
  @IsOptional()
  @IsIn(['HOAT_DONG', 'TAM_NGUNG'])
  status?: 'HOAT_DONG' | 'TAM_NGUNG';

  @ApiPropertyOptional({
    description: 'Lọc khuyến mãi áp dụng từ ngày',
    example: '01-05-2026',
  })
  @IsOptional()
  @IsPromotionDateOnly()
  fromDate?: string;

  @ApiPropertyOptional({
    description: 'Lọc khuyến mãi áp dụng đến ngày',
    example: '31-05-2026',
  })
  @IsOptional()
  @IsPromotionDateOnly()
  toDate?: string;

  @ApiPropertyOptional({
    description: 'Trường sắp xếp danh sách khuyến mãi',
    enum: PROMOTION_SORT_FIELDS,
    example: 'createdAt',
  })
  @IsOptional()
  @IsIn(PROMOTION_SORT_FIELDS)
  sortBy?: (typeof PROMOTION_SORT_FIELDS)[number];

  @ApiPropertyOptional({
    description: 'Chiều sắp xếp',
    enum: ['asc', 'desc'],
    default: 'desc',
    example: 'desc',
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDirection?: 'asc' | 'desc';
}
