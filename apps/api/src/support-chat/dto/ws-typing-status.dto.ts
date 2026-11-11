import { Type } from 'class-transformer';
import { IsBoolean, IsInt, Min } from 'class-validator';

export class WsTypingStatusDto {
  @Type(() => Number)
  @IsInt({ message: 'Mã cuộc trò chuyện phải là số nguyên.' })
  @Min(1, { message: 'Mã cuộc trò chuyện không hợp lệ.' })
  cuocTroChuyenId!: number;

  @IsBoolean({ message: 'Trạng thái typing phải là boolean.' })
  isTyping!: boolean;
}
