import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { VIETNAM_PHONE_NUMBER_REGEX } from '../../common/validation/vietnamese-phone.js';

export class PassengerInfoDto {
  @IsString()
  @IsNotEmpty({ message: 'Họ tên không được để trống.' })
  fullName!: string;

  @IsString()
  @IsNotEmpty({ message: 'Số điện thoại không được để trống.' })
  @Matches(VIETNAM_PHONE_NUMBER_REGEX, {
    message: 'Số điện thoại không hợp lệ.',
  })
  phoneNumber!: string;

  @IsOptional()
  @IsEmail({}, { message: 'Email không hợp lệ.' })
  email?: string;
}

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

export class CargoItemDto {
  @IsString()
  @IsNotEmpty({ message: 'Tên hàng hóa không được để trống.' })
  name!: string;

  @IsOptional()
  @IsString()
  type?: string;

  @Type(() => Number)
  @IsInt({ message: 'Số lượng phải là số nguyên.' })
  @Min(1, { message: 'Số lượng tối thiểu là 1.' })
  quantity!: number;

  @Type(() => Number)
  @IsNumber({}, { message: 'Khối lượng phải là số.' })
  @Min(0, { message: 'Khối lượng không được âm.' })
  weight!: number;

  @IsOptional()
  @IsString()
  category?: 'normal' | 'fragile' | 'valuable';

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Chiều dài phải là số.' })
  @Min(0)
  length?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Chiều rộng phải là số.' })
  @Min(0)
  width?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Chiều cao phải là số.' })
  @Min(0)
  height?: number;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  motorbikeModel?: string;

  @IsOptional()
  @IsString()
  bicycleType?: string;

  @IsOptional()
  @IsString()
  licensePlate?: string;
}

export class CreateBookingDto {
  @IsNotEmpty({ message: 'tripId không được để trống.' })
  @Type(() => Number)
  @IsInt({ message: 'tripId phải là số nguyên.' })
  @Min(1, { message: 'tripId phải lớn hơn 0.' })
  tripId!: number;

  @IsOptional()
  @IsArray({ message: 'seatIds phải là mảng số nguyên.' })
  @Type(() => Number)
  @IsInt({ each: true, message: 'Mỗi seatId phải là số nguyên.' })
  seatIds?: number[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  seatNumbers?: string[];

  @IsOptional()
  @IsString()
  pickupPoint?: string;

  @IsOptional()
  @IsString()
  dropoffPoint?: string;

  @IsOptional()
  @IsString()
  pickup?: string;

  @IsOptional()
  @IsString()
  dropoff?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => BookingContactDto)
  contact?: BookingContactDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PassengerInfoDto)
  passenger?: PassengerInfoDto;

  @IsOptional()
  @IsString()
  promotionCode?: string;

  @IsOptional()
  @IsString()
  holdToken?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CargoItemDto)
  cargoItems?: CargoItemDto[];
}
