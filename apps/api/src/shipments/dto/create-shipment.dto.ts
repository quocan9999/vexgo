import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
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
  @ApiProperty({
    description: 'Tên hoặc mô tả ngắn gọn kiện hàng',
    example: 'Thùng hoa quả tươi',
  })
  @IsString()
  @IsNotEmpty({ message: 'Tên hàng hóa không được để trống.' })
  name!: string;

  @ApiPropertyOptional({
    description: 'Tên phân loại hàng hóa (text)',
    example: 'Nông sản',
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    description: 'ID danh mục loại hàng hóa',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Mã loại hàng hóa phải là số nguyên.' })
  @Min(1, { message: 'Mã loại hàng hóa không hợp lệ.' })
  loaiHangHoaId?: number;

  @ApiProperty({
    description: 'Số lượng kiện',
    example: 1,
    minimum: 1,
  })
  @IsInt()
  @Min(1, { message: 'Số lượng phải lớn hơn hoặc bằng 1.' })
  quantity!: number;

  @ApiProperty({
    description: 'Khối lượng kiện hàng (kg)',
    example: 5.5,
    minimum: 0.1,
  })
  @IsNumber()
  @Min(0.1, { message: 'Khối lượng phải lớn hơn 0.' })
  weight!: number;

  @ApiPropertyOptional({
    description: 'Chiều dài kiện hàng (cm)',
    example: 40,
  })
  @Validate(CargoDimensionsConstraint)
  length?: number;

  @ApiPropertyOptional({
    description: 'Chiều rộng kiện hàng (cm)',
    example: 30,
  })
  @Allow()
  width?: number;

  @ApiPropertyOptional({
    description: 'Chiều cao kiện hàng (cm)',
    example: 25,
  })
  @Allow()
  height?: number;

  @ApiPropertyOptional({
    description: 'Tính chất đặc biệt của hàng hóa',
    enum: ['NORMAL', 'FRAGILE', 'VALUABLE'],
    example: 'NORMAL',
  })
  @IsOptional()
  @IsIn(['NORMAL', 'FRAGILE', 'VALUABLE'])
  serviceType?: 'NORMAL' | 'FRAGILE' | 'VALUABLE';

  @ApiPropertyOptional({
    description: 'Ghi chú cho kiện hàng',
    example: 'Nhẹ tay, hàng dễ dập',
  })
  @IsOptional()
  @IsString()
  note?: string;
}

export class ShipmentSenderDto {
  @ApiProperty({
    description: 'Họ và tên người gửi hàng',
    example: 'Nguyễn Văn A',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty({ message: 'Họ tên người gửi không được để trống.' })
  @MaxLength(100)
  fullName!: string;

  @ApiProperty({
    description: 'Số điện thoại người gửi hàng',
    example: '0901234567',
  })
  @IsString()
  @IsNotEmpty({ message: 'Số điện thoại người gửi không được để trống.' })
  @Matches(/^(?:0\d{9,10}|\+?84\d{9,10})$/, {
    message: 'Số điện thoại người gửi không hợp lệ.',
  })
  phoneNumber!: string;

  @ApiPropertyOptional({
    description: 'Email người gửi hàng',
    example: 'nguyenvana@gmail.com',
  })
  @IsOptional()
  @IsEmail({}, { message: 'Email không hợp lệ.' })
  email?: string;
}

export class ShipmentReceiverDto {
  @ApiProperty({
    description: 'Họ và tên người nhận hàng',
    example: 'Trần Thị B',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty({ message: 'Họ tên người nhận không được để trống.' })
  @MaxLength(100)
  fullName!: string;

  @ApiProperty({
    description: 'Số điện thoại người nhận hàng',
    example: '0987654321',
  })
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
  @ApiPropertyOptional({
    description: 'ID chuyến xe vận chuyển hàng hóa',
    example: 10,
    minimum: 1,
  })
  @ValidateIf((_dto: CreateShipmentDto, value: unknown) => value !== undefined)
  @IsInt({ message: 'Mã chuyến xe không hợp lệ.' })
  @Min(1, { message: 'Mã chuyến xe không hợp lệ.' })
  tripId?: number;

  @ApiPropertyOptional({
    description: 'ID tuyến xe (cho vận đơn độc lập chưa gán chuyến)',
    example: 1,
    minimum: 1,
  })
  @ValidateIf((dto: CreateShipmentDto) => dto.tripId === undefined)
  @IsInt()
  @Min(1)
  routeId?: number;

  @ApiPropertyOptional({
    description: 'Ngày dự kiến gửi (DD-MM-YYYY, cho vận đơn độc lập)',
    example: '15-11-2026',
  })
  @IsOptional()
  @Validate(StandaloneDateConstraint)
  sendDate?: string;

  @ApiProperty({
    description: 'Thông tin người gửi hàng',
    type: ShipmentSenderDto,
  })
  @IsDefined()
  @ValidateNested()
  @Type(() => ShipmentSenderDto)
  sender!: ShipmentSenderDto;

  @ApiProperty({
    description: 'Thông tin người nhận hàng',
    type: ShipmentReceiverDto,
  })
  @IsDefined()
  @ValidateNested()
  @Type(() => ShipmentReceiverDto)
  receiver!: ShipmentReceiverDto;

  @ApiProperty({
    description: 'Danh sách các kiện hàng gửi',
    type: [CargoItemInputDto],
  })
  @IsArray({ message: 'Danh sách hàng hóa phải là mảng.' })
  @ValidateNested({ each: true })
  @Type(() => CargoItemInputDto)
  items!: CargoItemInputDto[];

  @ApiPropertyOptional({
    description: 'Đánh dấu hàng dễ vỡ',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isFragile?: boolean;

  @ApiPropertyOptional({
    description: 'Đánh dấu hàng có giá trị cao',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isValuable?: boolean;

  @ApiPropertyOptional({
    description: 'Ghi chú đơn vận chuyển hàng',
    example: 'Gọi trước khi giao 30 phút',
  })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({
    description: 'ID điểm gửi hàng (bến xe/trạm đón)',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  senderPointId?: number;

  @ApiPropertyOptional({
    description: 'ID điểm nhận hàng (bến xe/trạm trả)',
    example: 2,
  })
  @IsOptional()
  @IsInt()
  receiverPointId?: number;

  @IsOptional()
  @IsIn(['NGUOI_GUI', 'NGUOI_NHAN'], {
    message: 'Người trả cước phải là NGUOI_GUI hoặc NGUOI_NHAN.',
  })
  freightPayer?: 'NGUOI_GUI' | 'NGUOI_NHAN';

  @IsOptional()
  @IsIn(['TAI_BEN'], {
    message: 'Hình thức thanh toán phải là TAI_BEN.',
  })
  paymentMethod?: 'TAI_BEN';
}
