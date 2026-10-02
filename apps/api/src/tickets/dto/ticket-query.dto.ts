import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { IsDateOnly } from '../../common/validators/is-date-only.validator.js';

export class TicketQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 10;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  route?: string;

  @IsOptional()
  @IsDateOnly({ message: 'Ngày khởi hành không hợp lệ.' })
  departureDate?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsIn(['createdAt', 'departureTime', 'price'])
  sortBy?: 'createdAt' | 'departureTime' | 'price';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDirection?: 'asc' | 'desc';
}
