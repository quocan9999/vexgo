import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class AvailablePromotionsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'tripId phải là số nguyên.' })
  @Min(1, { message: 'tripId phải lớn hơn 0.' })
  tripId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'nhaXeId phải là số nguyên.' })
  @Min(1, { message: 'nhaXeId phải lớn hơn 0.' })
  nhaXeId?: number;
}
