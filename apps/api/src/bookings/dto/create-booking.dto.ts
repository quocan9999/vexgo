import { Type } from 'class-transformer';
import {
  ArrayMinSize,
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

  @IsEmail({}, { message: 'Email không hợp lệ.' })
  email!: string;
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
  @Type(() => Number)
  @IsInt()
  tripId!: number;

  @IsArray()
  @ArrayMinSize(1, { message: 'Vui lòng chọn ít nhất một ghế.' })
  @IsString({ each: true })
  seatNumbers!: string[];

  @ValidateNested()
  @Type(() => PassengerInfoDto)
  passenger!: PassengerInfoDto;

  @IsOptional()
  @IsString()
  pickup?: string;

  @IsOptional()
  @IsString()
  dropoff?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CargoItemDto)
  cargoItems?: CargoItemDto[];
}
