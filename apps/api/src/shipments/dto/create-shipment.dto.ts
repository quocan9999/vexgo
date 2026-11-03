import {
  Allow,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsDefined,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Matches,
  MaxLength,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidateNested,
  ValidateIf,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import {
  CARGO_DIMENSIONS_INVALID_MESSAGE,
  hasValidCargoDimensions,
  type CargoDimensionsInput,
} from '../../cargo-pricing/cargo-dimensions.validation.js';

@ValidatorConstraint({ name: 'cargoDimensions', async: false })
class CargoDimensionsConstraint implements ValidatorConstraintInterface {
  validate(_length: unknown, args: ValidationArguments): boolean {
    return hasValidCargoDimensions(args.object as CargoDimensionsInput);
  }

  defaultMessage(): string {
    return CARGO_DIMENSIONS_INVALID_MESSAGE;
  }
}

export class CargoItemInputDto {
  @IsString()
  @IsNotEmpty({ message: 'Tên hàng hóa không được để trống.' })
  name!: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Mã loại hàng hóa phải là số nguyên.' })
  @Min(1, { message: 'Mã loại hàng hóa không hợp lệ.' })
  loaiHangHoaId?: number;

  @IsInt()
  @Min(1, { message: 'Số lượng phải lớn hơn hoặc bằng 1.' })
  quantity!: number;

  @IsNumber()
  @Min(0.1, { message: 'Khối lượng phải lớn hơn 0.' })
  weight!: number;

  @Validate(CargoDimensionsConstraint)
  length?: number;

  @Allow()
  width?: number;

  @Allow()
  height?: number;

  @IsOptional()
  @IsIn(['NORMAL', 'FRAGILE', 'VALUABLE'])
  serviceType?: 'NORMAL' | 'FRAGILE' | 'VALUABLE';

  @IsOptional()
  @IsString()
  note?: string;
}

export class ShipmentSenderDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty({ message: 'Họ tên người gửi không được để trống.' })
  @MaxLength(100)
  fullName!: string;

  @IsString()
  @IsNotEmpty({ message: 'Số điện thoại người gửi không được để trống.' })
  @Matches(/^(?:0\d{9,10}|\+?84\d{9,10})$/, {
    message: 'Số điện thoại người gửi không hợp lệ.',
  })
  phoneNumber!: string;

  @IsOptional()
  @IsEmail({}, { message: 'Email không hợp lệ.' })
  email?: string;
}

export class ShipmentReceiverDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty({ message: 'Họ tên người nhận không được để trống.' })
  @MaxLength(100)
  fullName!: string;

  @IsString()
  @IsNotEmpty({ message: 'Số điện thoại người nhận không được để trống.' })
  @Matches(/^(?:0\d{9,10}|\+?84\d{9,10})$/, {
    message: 'Số điện thoại người nhận không hợp lệ.',
  })
  phoneNumber!: string;

  @IsOptional()
  @IsString()
  @Matches(/^(?:\d{9}|\d{12})$/, {
    message: 'CCCD/CMND phải có 9 hoặc 12 chữ số.',
  })
  cccd?: string;
}

@ValidatorConstraint({ name: 'standaloneDate', async: false })
class StandaloneDateConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value);
    if (!match) return false;
    const [, day, month, year] = match;
    const date = new Date(
      Date.UTC(Number(year), Number(month) - 1, Number(day)),
    );
    return (
      date.getUTCFullYear() === Number(year) &&
      date.getUTCMonth() + 1 === Number(month) &&
      date.getUTCDate() === Number(day)
    );
  }
  defaultMessage(): string {
    return 'Ngày gửi phải là ngày lịch hợp lệ theo DD-MM-YYYY.';
  }
}

export class CreateShipmentDto {
  @ValidateIf((_dto: CreateShipmentDto, value: unknown) => value !== undefined)
  @IsInt({ message: 'Mã chuyến xe không hợp lệ.' })
  @Min(1, { message: 'Mã chuyến xe không hợp lệ.' })
  tripId?: number;

  @ValidateIf((dto: CreateShipmentDto) => dto.tripId === undefined)
  @IsInt()
  @Min(1)
  routeId?: number;

  @ValidateIf((dto: CreateShipmentDto) => dto.tripId === undefined)
  @Validate(StandaloneDateConstraint)
  sendDate?: string;

  @IsDefined()
  @ValidateNested()
  @Type(() => ShipmentSenderDto)
  sender!: ShipmentSenderDto;

  @IsDefined()
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

  @IsOptional()
  @IsIn(['NGUOI_GUI', 'NGUOI_NHAN'], {
    message: 'Người trả cước phải là NGUOI_GUI hoặc NGUOI_NHAN.',
  })
  freightPayer?: 'NGUOI_GUI' | 'NGUOI_NHAN';

  @IsOptional()
  @IsIn(['TAI_BEN', 'ONLINE'], {
    message: 'Hình thức thanh toán phải là TAI_BEN hoặc ONLINE.',
  })
  paymentMethod?: 'TAI_BEN' | 'ONLINE';
}
