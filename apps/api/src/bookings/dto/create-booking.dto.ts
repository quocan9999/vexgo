import {
  IsArray,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsNotEmptyObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BookingContactDto {
  @IsNotEmpty({ message: 'Họ tên người liên hệ không được để trống.' })
  @IsString({ message: 'Họ tên phải là chuỗi ký tự.' })
  fullName!: string;

  @IsNotEmpty({ message: 'Số điện thoại người liên hệ không được để trống.' })
  @IsString({ message: 'Số điện thoại phải là chuỗi ký tự.' })
  phone!: string;

  @IsOptional()
  @IsEmail({}, { message: 'Email không đúng định dạng.' })
  email?: string;
}

export class CreateBookingDto {
  @IsNotEmpty({ message: 'tripId không được để trống.' })
  @Type(() => Number)
  @IsInt({ message: 'tripId phải là số nguyên.' })
  @Min(1, { message: 'tripId phải lớn hơn 0.' })
  tripId!: number;

  @IsArray({ message: 'seatIds phải là mảng số nguyên.' })
  @IsNotEmpty({ message: 'seatIds không được để trống.' })
  @Type(() => Number)
  @IsInt({ each: true, message: 'Mỗi seatId phải là số nguyên.' })
  seatIds!: number[];

  @IsNotEmpty({ message: 'Điểm đón không được để trống.' })
  @IsString()
  pickupPoint!: string;

  @IsNotEmpty({ message: 'Điểm trả không được để trống.' })
  @IsString()
  dropoffPoint!: string;

  @ValidateNested()
  @IsNotEmptyObject()
  @Type(() => BookingContactDto)
  contact!: BookingContactDto;

  @IsOptional()
  @IsString()
  promotionCode?: string;

  @IsNotEmpty({ message: 'holdToken giữ chỗ là bắt buộc.' })
  @IsString()
  holdToken!: string;
}
