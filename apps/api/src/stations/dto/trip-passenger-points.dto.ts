import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsInt, IsNumber, IsOptional, IsString, Matches, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class TripPassengerPointItemDto {
  @ApiProperty({ description: 'ID của bến bãi hoặc điểm đón trả', example: 5 })
  @IsInt()
  diemDonTraId!: number;

  @ApiProperty({
    description: 'Tính chất điểm trên chuyến: DON (điểm đón) hoặc TRA (điểm trả)',
    enum: ['DON', 'TRA'],
    example: 'DON',
  })
  @IsEnum(['DON', 'TRA'])
  loaiDiem!: 'DON' | 'TRA';

  @ApiPropertyOptional({
    description: 'Giờ dự kiến đón/trả khách tại điểm này (định dạng HH:mm hoặc HH:mm:ss)',
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
}

export class UpdateTripPassengerPointsDto {
  @ApiProperty({
    description: 'Danh sách các điểm đón và trả khách cấu hình cho chuyến xe',
    type: [TripPassengerPointItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TripPassengerPointItemDto)
  points!: TripPassengerPointItemDto[];
}
