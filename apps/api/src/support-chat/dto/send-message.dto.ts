import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export enum LoaiTinNhan {
  VAN_BAN = 'VAN_BAN',
  HINH_ANH = 'HINH_ANH',
}

function trimString(value: unknown) {
  return typeof value === 'string' ? value.trim() : value;
}

export class SendMessageDto {
  @Type(() => Number)
  @IsInt({ message: 'Mã cuộc trò chuyện phải là số nguyên.' })
  @Min(1, { message: 'Mã cuộc trò chuyện không hợp lệ.' })
  cuocTroChuyenId!: number;

  @Transform(({ value }) => trimString(value))
  @IsString({ message: 'Nội dung tin nhắn phải là chuỗi.' })
  @IsNotEmpty({ message: 'Nội dung tin nhắn không được để trống.' })
  @MaxLength(2000, { message: 'Nội dung tin nhắn không được vượt quá 2000 ký tự.' })
  noiDung!: string;

  @IsOptional()
  @IsEnum(LoaiTinNhan, { message: 'Loại tin nhắn không hợp lệ (chỉ chấp nhận VAN_BAN hoặc HINH_ANH).' })
  loaiTinNhan?: LoaiTinNhan = LoaiTinNhan.VAN_BAN;

  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Đường dẫn tệp đính kèm không được vượt quá 500 ký tự.' })
  tepDinhKemUrl?: string;

  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsString()
  @MaxLength(64, { message: 'Client message ID không được vượt quá 64 ký tự.' })
  clientMessageId?: string;
}
