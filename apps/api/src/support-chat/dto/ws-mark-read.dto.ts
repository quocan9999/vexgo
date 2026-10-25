import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, IsOptional, Min } from 'class-validator';

export class WsMarkReadDto {
  @Type(() => Number)
  @IsInt({ message: 'Mã cuộc trò chuyện phải là số nguyên.' })
  @Min(1, { message: 'Mã cuộc trò chuyện không hợp lệ.' })
  cuocTroChuyenId!: number;

  @IsOptional()
  @IsArray({ message: 'Danh sách tin nhắn phải là mảng.' })
  @IsInt({ each: true, message: 'ID tin nhắn phải là số nguyên.' })
  @Min(1, { each: true, message: 'ID tin nhắn không hợp lệ.' })
  @ArrayMaxSize(100, { message: 'Không thể đánh dấu quá 100 tin nhắn cùng lúc.' })
  tinNhanIds?: number[];
}
