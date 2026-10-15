import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';

export class ShipmentQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  status?: string;
}
