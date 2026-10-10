import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CargoItemInputDto {
  @IsString()
  @IsNotEmpty({ message: 'Tên hàng hóa không được để trống.' })
  name!: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsInt()
  @Min(1, { message: 'Số lượng phải lớn hơn hoặc bằng 1.' })
  quantity!: number;

  @IsNumber()
  @Min(0.1, { message: 'Khối lượng phải lớn hơn 0.' })
  weight!: number;

  @IsOptional()
  @IsNumber()
  length?: number;

  @IsOptional()
  @IsNumber()
  width?: number;

  @IsOptional()
  @IsNumber()
  height?: number;

  @IsOptional()
  @IsString()
  note?: string;
}

export class ShipmentSenderDto {
  @IsString()
  @IsNotEmpty({ message: 'Họ tên người gửi không được để trống.' })
  fullName!: string;

  @IsString()
  @IsNotEmpty({ message: 'Số điện thoại người gửi không được để trống.' })
  phoneNumber!: string;

  @IsOptional()
  @IsEmail({}, { message: 'Email không hợp lệ.' })
  email?: string;
}

export class ShipmentReceiverDto {
  @IsString()
  @IsNotEmpty({ message: 'Họ tên người nhận không được để trống.' })
  fullName!: string;

  @IsString()
  @IsNotEmpty({ message: 'Số điện thoại người nhận không được để trống.' })
  phoneNumber!: string;
}

export class CreateShipmentDto {
  @IsInt({ message: 'Mã chuyến xe không hợp lệ.' })
  tripId!: number;

  @ValidateNested()
  @Type(() => ShipmentSenderDto)
  sender!: ShipmentSenderDto;

  @ValidateNested()
  @Type(() => ShipmentReceiverDto)
  receiver!: ShipmentReceiverDto;

  @IsArray({ message: 'Danh sách hàng hóa phải là mảng.' })
  @ValidateNested({ each: true })
  @Type(() => CargoItemInputDto)
  items!: CargoItemInputDto[];

  @IsOptional()
  @IsBoolean()
  isFragile?: boolean;

  @IsOptional()
  @IsBoolean()
  isValuable?: boolean;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsInt()
  senderPointId?: number;

  @IsOptional()
  @IsInt()
  receiverPointId?: number;
}
