import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { LoaiTinNhan } from './send-message.dto.js';

function trimString(value: unknown) {
  return typeof value === 'string' ? value.trim() : value;
}

export class SendChatMessageBodyDto {
  @ApiProperty({
    description: 'Nội dung văn bản tin nhắn gửi đi',
    example: 'Tôi muốn đổi điểm đón sang bến xe Miền Đông mới được không ạ?',
    maxLength: 2000,
  })
  @Transform(({ value }) => trimString(value))
  @IsString({ message: 'Nội dung tin nhắn phải là chuỗi.' })
  @IsNotEmpty({ message: 'Nội dung tin nhắn không được để trống.' })
  @MaxLength(2000, { message: 'Nội dung tin nhắn không được vượt quá 2000 ký tự.' })
  noiDung!: string;

  @ApiPropertyOptional({
    description: 'Loại tin nhắn (VAN_BAN hoặc HINH_ANH)',
    enum: LoaiTinNhan,
    default: LoaiTinNhan.VAN_BAN,
    example: LoaiTinNhan.VAN_BAN,
  })
  @IsOptional()
  @IsEnum(LoaiTinNhan, { message: 'Loại tin nhắn không hợp lệ (chỉ chấp nhận VAN_BAN hoặc HINH_ANH).' })
  loaiTinNhan?: LoaiTinNhan = LoaiTinNhan.VAN_BAN;

  @ApiPropertyOptional({
    description: 'Đường dẫn tệp/ảnh đính kèm nếu có',
    example: 'https://example.com/uploads/photo.jpg',
    maxLength: 500,
  })
  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Đường dẫn tệp đính kèm không được vượt quá 500 ký tự.' })
  tepDinhKemUrl?: string;

  @ApiPropertyOptional({
    description: 'Client message ID hỗ trợ idempotency và cập nhật trạng thái UI',
    example: 'client-msg-uuid-999',
    maxLength: 64,
  })
  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsString()
  @MaxLength(64, { message: 'Client message ID không được vượt quá 64 ký tự.' })
  clientMessageId?: string;
}
