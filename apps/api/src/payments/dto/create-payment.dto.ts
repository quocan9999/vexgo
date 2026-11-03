import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class CreatePaymentDto {
  @ApiProperty({
    description: 'ID đơn đặt vé cần tạo giao dịch thanh toán',
    example: 45,
    minimum: 1,
  })
  @Type(() => Number)
  @IsInt({ message: 'bookingId phải là số nguyên.' })
  @Min(1, { message: 'bookingId phải lớn hơn 0.' })
  bookingId!: number;

  @ApiProperty({
    description: 'Cổng thanh toán lựa chọn: MOMO, VNPAY hoặc ZALOPAY',
    enum: ['MOMO', 'VNPAY', 'ZALOPAY'],
    example: 'VNPAY',
  })
  @IsNotEmpty({ message: 'provider không được để trống.' })
  @IsString({ message: 'provider phải là chuỗi ký tự.' })
  @IsIn(['MOMO', 'VNPAY', 'ZALOPAY'], {
    message: 'provider phải là MOMO, VNPAY hoặc ZALOPAY.',
  })
  provider!: string;
}
