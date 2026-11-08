import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';

export class QueryKnowledgeDocumentsDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Từ khóa tìm kiếm theo tiêu đề hoặc mã quy chế (alias của search)',
    example: 'hành lý',
  })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({
    description: 'Danh mục tài liệu',
    example: 'CHINH_SACH_HOAN_HUY',
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    description: 'Phạm vi áp dụng',
    enum: ['GLOBAL', 'TENANT'],
    example: 'GLOBAL',
  })
  @IsOptional()
  @IsIn(['GLOBAL', 'TENANT'])
  scope?: 'GLOBAL' | 'TENANT';

  @ApiPropertyOptional({
    description: 'ID nhà xe nếu lọc theo nhà xe cụ thể',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  nhaXeId?: number;

  @ApiPropertyOptional({
    description: 'Lọc theo trạng thái kích hoạt',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true || value === 1 || value === '1') return true;
    if (value === 'false' || value === false || value === 0 || value === '0') return false;
    return undefined;
  })
  @IsBoolean()
  isActive?: boolean;
}
