import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, Min } from 'class-validator';

export class MarkReadDto {
  @ApiPropertyOptional({
    description: 'Danh sách các ID tin nhắn cần đánh dấu đã đọc (bỏ trống nếu muốn đọc tất cả)',
    type: [Number],
    example: [1, 2, 3],
  })
  @IsOptional()
  @IsArray({ message: 'Danh sách mã tin nhắn phải là một mảng.' })
  @Type(() => Number)
  @IsInt({ each: true, message: 'Mỗi mã tin nhắn phải là số nguyên.' })
  @Min(1, { each: true, message: 'Mỗi mã tin nhắn phải lớn hơn 0.' })
  tinNhanIds?: number[];
}
