import { Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, Min } from 'class-validator';

export class MarkReadDto {
  @IsOptional()
  @IsArray({ message: 'Danh sách mã tin nhắn phải là một mảng.' })
  @Type(() => Number)
  @IsInt({ each: true, message: 'Mỗi mã tin nhắn phải là số nguyên.' })
  @Min(1, { each: true, message: 'Mỗi mã tin nhắn phải lớn hơn 0.' })
  tinNhanIds?: number[];
}
