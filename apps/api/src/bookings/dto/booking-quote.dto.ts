import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { VIETNAM_PHONE_NUMBER_REGEX } from '../../common/validation/vietnamese-phone.js';

export class BookingQuoteDto {
  @ApiProperty({ description: 'ID chuyến xe cần tính giá', example: 101 })
  @IsNotEmpty({ message: 'tripId không được để trống.' })
  @Type(() => Number)
  @IsInt({ message: 'tripId phải là số nguyên.' })
  @Min(1, { message: 'tripId phải lớn hơn 0.' })
  tripId!: number;

  @ApiProperty({
    description: 'Danh sách ID các ghế cần tính báo giá (tối đa 5 ghế)',
    example: [12, 13],
    type: [Number],
  })
  @IsArray({ message: 'seatIds phải là danh sách.' })
  @ArrayNotEmpty({ message: 'seatIds không được rỗng.' })
  @ArrayMaxSize(5, { message: 'Mỗi chuyến xe chỉ được đặt tối đa 5 ghế.' })
  @ArrayUnique({ message: 'Danh sách ghế không được trùng.' })
  @Type(() => Number)
  @IsInt({ each: true, message: 'Mỗi seatId phải là số nguyên.' })
  @Min(1, { each: true, message: 'Mỗi seatId phải lớn hơn 0.' })
  seatIds!: number[];

  @ApiPropertyOptional({ description: 'Mã khuyến mãi nếu muốn áp dụng giảm giá', example: 'HE2026' })
  @IsOptional()
  @IsString({ message: 'promotionCode phải là chuỗi ký tự.' })
  promotionCode?: string;

  @ApiPropertyOptional({ description: 'Số điện thoại hành khách để kiểm tra điều kiện mã giảm giá', example: '0912345678' })
  @IsOptional()
  @IsString({ message: 'contactPhone phải là chuỗi ký tự.' })
  @Matches(VIETNAM_PHONE_NUMBER_REGEX, {
    message: 'Số điện thoại không hợp lệ.',
  })
  contactPhone?: string;

  @ApiPropertyOptional({
    description: 'Mã định danh điểm đón chuyến xe (DiemDonTraChuyenXeId)',
    example: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'diemDonChuyenXeId phải là số nguyên.' })
  @Min(1)
  diemDonChuyenXeId?: number;

  @ApiPropertyOptional({
    description: 'Mã định danh điểm trả chuyến xe (DiemDonTraChuyenXeId)',
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'diemTraChuyenXeId phải là số nguyên.' })
  @Min(1)
  diemTraChuyenXeId?: number;
}
