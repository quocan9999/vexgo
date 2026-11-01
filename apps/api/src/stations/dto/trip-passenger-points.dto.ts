import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class TripPassengerPointItemDto {
  @ApiProperty({ description: 'ID của bến bãi hoặc điểm đón trả', example: 5 })
  @IsInt()
  diemDonTraId!: number;

  @ApiProperty({
    description: 'Tính chất điểm trên chuyến: DON (điểm đón), TRA (điểm trả), NGHI (trạm nghỉ)',
    enum: ['DON', 'TRA', 'NGHI'],
    example: 'DON',
  })
  @IsEnum(['DON', 'TRA', 'NGHI'], {
    message: 'loaiDiem phải là một trong các giá trị: DON, TRA, NGHI',
  })
  loaiDiem!: 'DON' | 'TRA' | 'NGHI';

  @ApiPropertyOptional({
    description: 'Số phút lệch so với giờ khởi hành của chuyến (âm, 0 hoặc dương)',
    example: -30,
    default: 0,
  })
  @IsOptional()
  @IsInt()
  phutLech?: number;

  @ApiPropertyOptional({
    description: 'Giờ dự kiến đón/trả khách tại điểm này (định dạng HH:mm hoặc HH:mm:ss). Nếu không truyền sẽ tự động tính từ gioKhoiHanh + phutLech.',
    example: '08:30',
  })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, {
    message: 'thoiGianDuKien phải có định dạng HH:mm hoặc HH:mm:ss (ví dụ: 08:30 hoặc 08:30:00)',
  })
  thoiGianDuKien?: string;

  @ApiProperty({ description: 'Thứ tự đón/trả trên lộ trình chuyến đi (bắt đầu từ 1)', example: 1 })
  @IsInt()
  thuTu!: number;

  @ApiPropertyOptional({ description: 'Phụ phí phát sinh khi đón/trả tại điểm này (VNĐ)', example: 20000, default: 0 })
  @IsOptional()
  @IsNumber()
  phuPhi?: number;

  @ApiPropertyOptional({ description: 'Số phút khách cần có mặt trước', example: 15, default: 15 })
  @IsOptional()
  @IsInt()
  phutCoMatTruoc?: number;

  @ApiPropertyOptional({ description: 'Công tắc nhận khách tại điểm này', example: true, default: true })
  @IsOptional()
  @IsBoolean()
  nhanKhach?: boolean;

  @ApiPropertyOptional({ description: 'Ghi chú thêm về điểm đón trả', example: 'Đón tại cổng số 2', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  ghiChu?: string;
}

export class UpdateTripPassengerPointsDto {
  @ApiProperty({
    description: 'Danh sách các điểm đón, trả khách và trạm nghỉ cấu hình cho chuyến xe',
    type: [TripPassengerPointItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TripPassengerPointItemDto)
  points!: TripPassengerPointItemDto[];
}
