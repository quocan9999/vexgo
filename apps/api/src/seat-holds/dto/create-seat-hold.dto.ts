import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { VIETNAM_PHONE_NUMBER_REGEX } from '../../common/validation/vietnamese-phone.js';

export class CreateSeatHoldDto {
  @ApiProperty({ description: 'ID chuyến xe cần giữ chỗ', example: 101 })
  @IsNotEmpty({ message: 'tripId không được để trống.' })
  @Type(() => Number)
  @IsInt({ message: 'tripId phải là số nguyên.' })
  @Min(1, { message: 'tripId phải lớn hơn 0.' })
  tripId!: number;

  @ApiProperty({
    description: 'Danh sách ID các ghế cần giữ chỗ (tối đa 5 ghế trong một lượt)',
    example: [12, 13],
    type: [Number],
  })
  @IsArray({ message: 'seatIds phải là danh sách.' })
  @IsNotEmpty({ message: 'seatIds không được rỗng.' })
  @ArrayMaxSize(5, { message: 'Mỗi chuyến xe chỉ được giữ tối đa 5 ghế.' })
  @Type(() => Number)
  @IsInt({ each: true, message: 'Mỗi seatId phải là số nguyên.' })
  seatIds!: number[];

  @ApiPropertyOptional({
    description: 'Số điện thoại liên hệ giữ chỗ (nếu có)',
    example: '0912345678',
  })
  @IsOptional()
  @IsString({ message: 'Số điện thoại phải là chuỗi ký tự.' })
  @Matches(VIETNAM_PHONE_NUMBER_REGEX, {
    message: 'Số điện thoại không hợp lệ.',
  })
  phone?: string;
}
