import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
  @ApiProperty({
    description: 'ID nhà xe cần yêu cầu hỗ trợ',
    example: 1,
    minimum: 1,
  })
  @Type(() => Number)
  @IsInt({ message: 'Mã nhà xe phải là số nguyên hợp lệ.' })
  @Min(1, { message: 'Mã nhà xe không hợp lệ.' })
  nhaXeId!: number;

  @ApiPropertyOptional({
    description: 'Tiêu đề hoặc chủ đề yêu cầu hỗ trợ',
    example: 'Tư vấn hành trình chuyến xe Sài Gòn - Đà Lạt',
    maxLength: 255,
  })
  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Tiêu đề không được vượt quá 255 ký tự.' })
  tieuDe?: string;

  @ApiPropertyOptional({
    description: 'Nội dung tin nhắn đầu tiên khi tạo cuộc trò chuyện',
    example: 'Xin chào nhà xe, chuyến đi ngày mai có đón ở trạm Suối Tiên không ạ?',
    maxLength: 2000,
  })
  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Nội dung tin nhắn đầu tiên không được vượt quá 2000 ký tự.' })
  tinNhanDauTien?: string;

  @ApiPropertyOptional({
    description: 'Client message ID (UUID hoặc chuỗi ngẫu nhiên từ client để chống trùng lặp)',
    example: 'msg-client-uuid-12345',
    maxLength: 64,
  })
  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsString()
  @MaxLength(64, { message: 'Client message ID không được vượt quá 64 ký tự.' })
  clientMessageId?: string;
}
