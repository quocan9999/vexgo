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
  @IsNotEmpty({ message: 'tripId không được để trống.' })
  @Type(() => Number)
  @IsInt({ message: 'tripId phải là số nguyên.' })
  @Min(1, { message: 'tripId phải lớn hơn 0.' })
  tripId!: number;

  @IsArray({ message: 'seatIds phải là danh sách.' })
  @ArrayNotEmpty({ message: 'seatIds không được rỗng.' })
  @ArrayMaxSize(5, { message: 'Mỗi chuyến xe chỉ được đặt tối đa 5 ghế.' })
  @ArrayUnique({ message: 'Danh sách ghế không được trùng.' })
  @Type(() => Number)
  @IsInt({ each: true, message: 'Mỗi seatId phải là số nguyên.' })
  @Min(1, { each: true, message: 'Mỗi seatId phải lớn hơn 0.' })
  seatIds!: number[];

  @IsOptional()
  @IsString({ message: 'promotionCode phải là chuỗi ký tự.' })
  promotionCode?: string;

  @IsOptional()
  @IsString({ message: 'contactPhone phải là chuỗi ký tự.' })
  @Matches(VIETNAM_PHONE_NUMBER_REGEX, {
    message: 'Số điện thoại không hợp lệ.',
  })
  contactPhone?: string;
}
