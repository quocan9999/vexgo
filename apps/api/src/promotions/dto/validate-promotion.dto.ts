import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ValidatePromotionDto {
  @IsNotEmpty({ message: 'Mã khuyến mãi không được để trống.' })
  @IsString({ message: 'Mã khuyến mãi phải là chuỗi ký tự.' })
  code!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'tripId phải là số nguyên.' })
  @Min(1, { message: 'tripId phải lớn hơn 0.' })
  tripId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'nhaXeId phải là số nguyên.' })
  @Min(1, { message: 'nhaXeId phải lớn hơn 0.' })
  nhaXeId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'seatCount phải là số nguyên.' })
  @Min(1, { message: 'seatCount phải lớn hơn 0.' })
  seatCount?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0, { message: 'totalAmount phải không âm.' })
  totalAmount?: number;
}
