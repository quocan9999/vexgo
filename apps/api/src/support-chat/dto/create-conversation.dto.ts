import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

function trimString(value: unknown) {
  return typeof value === 'string' ? value.trim() : value;
}

export class CreateConversationDto {
  @Type(() => Number)
  @IsInt({ message: 'Mã nhà xe phải là số nguyên hợp lệ.' })
  @Min(1, { message: 'Mã nhà xe không hợp lệ.' })
  nhaXeId!: number;

  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Tiêu đề không được vượt quá 255 ký tự.' })
  tieuDe?: string;

  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Nội dung tin nhắn đầu tiên không được vượt quá 2000 ký tự.' })
  tinNhanDauTien?: string;

  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsString()
  @MaxLength(64, { message: 'Client message ID không được vượt quá 64 ký tự.' })
  clientMessageId?: string;
}
