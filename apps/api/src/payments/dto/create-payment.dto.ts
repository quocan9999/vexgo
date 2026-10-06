import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePaymentDto {
  @IsNotEmpty({ message: 'bookingId không được để trống.' })
  @Type(() => Number)
  @IsInt({ message: 'bookingId phải là số nguyên hợp lệ.' })
  bookingId!: number;

  @IsOptional()
  @IsString({ message: 'provider phải là chuỗi ký tự.' })
  @IsIn(['MOMO', 'VNPAY', 'ZALOPAY', 'momo', 'vnpay', 'zalopay'], {
    message: 'provider chỉ hỗ trợ MOMO, VNPAY hoặc ZALOPAY.',
  })
  provider?: string;

  @IsOptional()
  @IsString({ message: 'returnUrl phải là chuỗi hợp lệ.' })
  returnUrl?: string;

  @IsOptional()
  @IsString({ message: 'extraData phải là chuỗi hợp lệ.' })
  extraData?: string;
}
