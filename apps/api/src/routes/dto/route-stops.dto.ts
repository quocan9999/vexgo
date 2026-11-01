import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class RouteStopItemDto {
  @ApiProperty({ description: 'ID bến bãi hoặc điểm đón trả', example: 10 })
  @IsInt()
  @Min(1)
  diemDonTraId!: number;

  @ApiProperty({
    description: 'Vai trò của điểm trong khuôn lộ trình: DON (đón), TRA (trả), NGHI (trạm nghỉ)',
    enum: ['DON', 'TRA', 'NGHI'],
    example: 'DON',
  })
  @IsEnum(['DON', 'TRA', 'NGHI'], {
    message: 'loaiDiem phải là một trong các giá trị: DON, TRA, NGHI',
  })
  loaiDiem!: 'DON' | 'TRA' | 'NGHI';

  @ApiProperty({
    description: 'Số phút lệch so với giờ khởi hành của chuyến (có thể là số âm, 0 hoặc dương)',
    example: -15,
  })
  @IsInt()
  phutLech!: number;

  @ApiPropertyOptional({
    description: 'Thứ tự ưu tiên sắp xếp khi cùng phút lệch',
    example: 1,
    default: 1,
  })
  @IsOptional()
  @IsInt()
  thuTu?: number;

  @ApiPropertyOptional({
    description: 'Phụ phí phát sinh khi đón/trả tại điểm này (VNĐ)',
    example: 20000,
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  phuPhi?: number;

  @ApiPropertyOptional({
    description: 'Số phút khách cần có mặt trước giờ đón/trả',
    example: 15,
    default: 15,
  })
  @IsOptional()
  @IsInt()
  phutCoMatTruoc?: number;

  @ApiPropertyOptional({
    description: 'Công tắc bật/tắt nhận khách tại điểm dừng này',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  nhanKhach?: boolean;

  @ApiPropertyOptional({
    description: 'Ghi chú thêm về điểm dừng trên lộ trình',
    example: 'Chỉ dừng đón khách đã đặt vé trước',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  ghiChu?: string;
}

export class UpdateRouteStopsDto {
  @ApiProperty({
    description: 'Danh sách các điểm dừng cấu hình cho khuôn lộ trình của tuyến xe',
    type: [RouteStopItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RouteStopItemDto)
  stops!: RouteStopItemDto[];
}
