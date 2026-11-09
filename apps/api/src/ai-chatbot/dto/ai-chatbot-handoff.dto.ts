import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class AiChatbotHandoffDto {
  @ApiProperty({
    description: 'ID nhà xe cần kết nối CSKH',
    example: 1,
  })
  @IsInt({ message: 'nhaXeId phải là số nguyên' })
  @IsPositive({ message: 'nhaXeId phải là số nguyên dương' })
  nhaXeId: number;

  @ApiProperty({
    description: 'Client-generated UUID v4 chống gửi trùng và khôi phục request',
    example: 'b7c7b8e1-512a-43c2-a3fd-98c460bfa7d1',
  })
  @IsUUID('4', { message: 'requestId phải là định dạng UUID v4' })
  requestId: string;

  @ApiPropertyOptional({
    description: 'Ghi chú hoặc lời nhắn ban đầu của khách hàng khi chuyển giao',
    example: 'Tôi cần hỗ trợ đổi chuyến gấp',
  })
  @IsOptional()
  @IsString({ message: 'clientNote phải là chuỗi ký tự' })
  @MaxLength(500, { message: 'clientNote tối đa 500 ký tự' })
  clientNote?: string;
}
