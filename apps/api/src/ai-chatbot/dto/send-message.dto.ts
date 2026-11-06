import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class SendMessageDto {
  @ApiProperty({
    description: 'Nội dung câu hỏi hoặc yêu cầu gửi tới Trợ lý ảo AI',
    example: 'Chính sách hoàn hủy vé trước 24 giờ như thế nào?',
  })
  @IsString({ message: 'Nội dung tin nhắn phải là chuỗi ký tự.' })
  @IsNotEmpty({ message: 'Nội dung tin nhắn không được để trống.' })
  message!: string;

  @ApiPropertyOptional({
    description: 'Mã định danh phiên hội thoại (UUID) để lưu giữ ngữ cảnh',
    example: 'c2e4293e-2b5d-4f1a-8c65-0d2d3e9501a2',
  })
  @IsOptional()
  @IsString()
  sessionToken?: string;

  @ApiPropertyOptional({
    description: 'ID nhà xe nếu khách hàng đang tương tác trong trang của nhà xe cụ thể',
    example: 1,
  })
  @IsOptional()
  @Transform(({ value }) => (value !== undefined && value !== '' ? Number(value) : undefined))
  @IsInt({ message: 'nhaXeId phải là số nguyên dương.' })
  @Min(1)
  nhaXeId?: number;
}
