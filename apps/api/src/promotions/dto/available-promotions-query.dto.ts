import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class AvailablePromotionsQueryDto {
  @ApiPropertyOptional({
    description: 'ID chuyến xe cần tra cứu khuyến mãi phù hợp',
    example: 10,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'tripId phải là số nguyên.' })
  @Min(1, { message: 'tripId phải lớn hơn 0.' })
  tripId?: number;

  @ApiPropertyOptional({
    description: 'ID nhà xe cần lọc khuyến mãi áp dụng',
    example: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'nhaXeId phải là số nguyên.' })
  @Min(1, { message: 'nhaXeId phải lớn hơn 0.' })
  nhaXeId?: number;
}
