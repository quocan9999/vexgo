import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CancelShipmentDto {
  @ApiProperty({
    description: 'Mã vận đơn bưu kiện cần hủy',
    example: 'FUTA-VD-23102026-0001',
  })
  @IsString()
  @IsNotEmpty({ message: 'Mã vận đơn không được để trống.' })
  waybillCode!: string;

  @ApiProperty({
    description: 'Số điện thoại của người gửi hoặc người nhận để xác minh',
    example: '0901234567',
  })
  @IsString()
  @IsNotEmpty({ message: 'Số điện thoại không được để trống.' })
  phoneNumber!: string;

  @ApiPropertyOptional({
    description: 'Lý do hủy đơn gửi hàng',
    example: 'Đặt nhầm thông tin người nhận',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Lý do hủy không được vượt quá 255 ký tự.' })
  reason?: string;

  @ApiPropertyOptional({
    description: 'Danh sách ID các kiện hàng muốn hủy riêng (nếu chỉ hủy một phần kiện)',
    example: [1],
    type: [Number],
  })
  @IsOptional()
  @IsArray({ message: 'itemIds phải là danh sách số nguyên.' })
  @Type(() => Number)
  @IsInt({ each: true, message: 'Mỗi itemId phải là số nguyên hợp lệ.' })
  itemIds?: number[];

  @ApiPropertyOptional({
    description: 'Danh sách vị trí (index 0, 1...) các kiện hàng muốn hủy riêng',
    example: [0],
    type: [Number],
  })
  @IsOptional()
  @IsArray({ message: 'itemIndices phải là danh sách số nguyên.' })
  @Type(() => Number)
  @IsInt({ each: true, message: 'Mỗi itemIndex phải là số nguyên hợp lệ.' })
  itemIndices?: number[];
}
