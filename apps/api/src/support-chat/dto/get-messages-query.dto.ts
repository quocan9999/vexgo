import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class GetMessagesQueryDto {
  @ApiPropertyOptional({
    description: 'Trang truy vấn',
    default: 1,
    example: 1,
    minimum: 1,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({
    description: 'Số lượng tin nhắn trên mỗi trang',
    default: 30,
    example: 30,
    minimum: 1,
    maximum: 100,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 30;

  @ApiPropertyOptional({
    description: 'ID tin nhắn làm mốc để tải tin nhắn cũ hơn (cursor-based)',
    example: 150,
    minimum: 1,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  beforeId?: number;
}
