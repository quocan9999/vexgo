import { IsArray, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class BookingQuoteDto {
  @IsNotEmpty({ message: 'tripId không được để trống.' })
  @Type(() => Number)
  @IsInt({ message: 'tripId phải là số nguyên.' })
  @Min(1, { message: 'tripId phải lớn hơn 0.' })
  tripId!: number;

  @IsArray({ message: 'seatIds phải là danh sách.' })
  @IsNotEmpty({ message: 'seatIds không được rỗng.' })
  @Type(() => Number)
  @IsInt({ each: true, message: 'Mỗi seatId phải là số nguyên.' })
  seatIds!: number[];

  @IsOptional()
  @IsString({ message: 'promotionCode phải là chuỗi ký tự.' })
  promotionCode?: string;
}
