import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class WsClaimConversationDto {
  @Type(() => Number)
  @IsInt({ message: 'Mã cuộc trò chuyện phải là số nguyên.' })
  @Min(1, { message: 'Mã cuộc trò chuyện không hợp lệ.' })
  cuocTroChuyenId!: number;
}
