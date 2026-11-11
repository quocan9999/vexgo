import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

function trimString(value: unknown) {
  return typeof value === 'string' ? value.trim() : value;
}

export class CloseConversationDto {
  @ApiPropertyOptional({
    description: 'Lý do kết thúc hoặc đóng cuộc hỗ trợ',
    example: 'Đã giải đáp xong thắc mắc cho hành khách.',
    maxLength: 255,
  })
  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Lý do kết thúc không được vượt quá 255 ký tự.' })
  lyDo?: string;
}
