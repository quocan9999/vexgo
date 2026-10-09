import { IsIn, IsInt, IsNotEmpty, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePaymentDto {
  @Type(() => Number)
  @IsInt({ message: 'bookingId phải là số nguyên.' })
  @Min(1, { message: 'bookingId phải lớn hơn 0.' })
  bookingId!: number;

  @IsNotEmpty({ message: 'provider không được để trống.' })
  @IsString({ message: 'provider phải là chuỗi ký tự.' })
  @IsIn(['MOMO', 'VNPAY', 'ZALOPAY'], {
    message: 'provider phải là MOMO, VNPAY hoặc ZALOPAY.',
  })
  provider!: string;
}
