import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class SendMessageDto {
  @ApiProperty({
    description: 'Nội dung câu hỏi hoặc yêu cầu gửi tới Trợ lý ảo AI',
    example: 'Chính sách hoàn hủy vé trước 24 giờ như thế nào?',
  })
  @IsString({ message: 'Nội dung tin nhắn phải là chuỗi ký tự.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(2000)
  @IsNotEmpty({ message: 'Nội dung tin nhắn không được để trống.' })
  message!: string;

  @ApiPropertyOptional({
    description: 'Mã định danh phiên hội thoại (UUID) để lưu giữ ngữ cảnh',
    example: 'c2e4293e-2b5d-4f1a-8c65-0d2d3e9501a2',
  })
  @IsOptional()
  @IsUUID()
  sessionToken?: string;

  @ApiPropertyOptional({
    description:
      'ID nhà xe nếu khách hàng đang tương tác trong trang của nhà xe cụ thể',
    example: 1,
  })
  @IsOptional()
  @Transform(({ value }) =>
    value !== undefined && value !== '' ? Number(value) : undefined,
  )
  @IsInt({ message: 'nhaXeId phải là số nguyên dương.' })
  @Min(1)
  nhaXeId?: number;

  @ApiPropertyOptional({
    description:
      'Client-generated UUID v4 định danh yêu cầu chống gửi trùng và phục hồi kết quả khi mất mạng',
    example: 'b7c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
  })
  @IsOptional()
  @IsUUID('4', { message: 'requestId phải là định dạng UUID v4 hợp lệ.' })
  requestId?: string;

  @ApiPropertyOptional({
    description:
      'Mã bí mật dùng để khôi phục yêu cầu cho khách vãng lai ở lượt gửi đầu',
    example: 'rcv_9f8e7d6c5b4a3210',
  })
  @IsOptional()
  @IsString({ message: 'recoveryKey phải là chuỗi ký tự.' })
  @MaxLength(64, { message: 'recoveryKey tối đa 64 ký tự.' })
  recoveryKey?: string;
}
