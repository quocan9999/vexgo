import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

function trimString(value: unknown) {
  return typeof value === 'string' ? value.trim() : value;
}

export class WsCloseConversationDto {
  @Type(() => Number)
  @IsInt({ message: 'Mã cuộc trò chuyện phải là số nguyên.' })
  @Min(1, { message: 'Mã cuộc trò chuyện không hợp lệ.' })
  cuocTroChuyenId!: number;

  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Lý do kết thúc không được vượt quá 500 ký tự.' })
  lyDo?: string;
}
