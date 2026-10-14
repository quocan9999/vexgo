import { Type } from 'class-transformer';
import {
  IsArray,
  ArrayNotEmpty,
  ArrayUnique,
  IsDefined,
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

export class BookingContactDto {
  @IsNotEmpty({ message: 'Họ tên người liên hệ không được để trống.' })
  @IsString({ message: 'Họ tên phải là chuỗi ký tự.' })
  fullName!: string;

  @IsNotEmpty({ message: 'Số điện thoại người liên hệ không được để trống.' })
  @IsString({ message: 'Số điện thoại phải là chuỗi ký tự.' })
  @Matches(VIETNAM_PHONE_NUMBER_REGEX, {
    message: 'Số điện thoại không hợp lệ.',
  })
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

  @IsArray({ message: 'seatIds phải là mảng số nguyên.' })
  @ArrayNotEmpty({ message: 'Phải chọn ít nhất một ghế.' })
  @ArrayUnique({ message: 'Danh sách ghế không được trùng.' })
  @Type(() => Number)
  @IsInt({ each: true, message: 'Mỗi seatId phải là số nguyên.' })
  seatIds!: number[];

  @IsString()
  @IsNotEmpty({ message: 'Điểm đón không được để trống.' })
  pickupPoint!: string;

  @IsString()
  @IsNotEmpty({ message: 'Điểm trả không được để trống.' })
  dropoffPoint!: string;

  @IsDefined({ message: 'Thông tin liên hệ là bắt buộc.' })
  @ValidateNested()
  @Type(() => BookingContactDto)
  contact!: BookingContactDto;

  @IsOptional()
  @IsString()
  promotionCode?: string;

  @IsString()
  @IsNotEmpty({ message: 'holdToken không được để trống.' })
  holdToken!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CargoItemDto)
  cargoItems?: CargoItemDto[];
}
