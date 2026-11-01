import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  Allow,
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidateNested,
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
  @IsString()
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
  @IsString()
  @IsNotEmpty({ message: 'Họ tên người gửi không được để trống.' })
  fullName!: string;

  @ApiProperty({
    description: 'Số điện thoại người gửi hàng',
    example: '0901234567',
  })
  @IsString()
  @IsNotEmpty({ message: 'Số điện thoại người gửi không được để trống.' })
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
  @IsString()
  @IsNotEmpty({ message: 'Họ tên người nhận không được để trống.' })
  fullName!: string;

  @ApiProperty({
    description: 'Số điện thoại người nhận hàng',
    example: '0987654321',
  })
  @IsString()
  @IsNotEmpty({ message: 'Số điện thoại người nhận không được để trống.' })
  phoneNumber!: string;
}

export class CreateShipmentDto {
  @ApiProperty({
    description: 'ID chuyến xe vận chuyển hàng hóa',
    example: 10,
    minimum: 1,
  })
  @IsInt({ message: 'Mã chuyến xe không hợp lệ.' })
  tripId!: number;

  @ApiProperty({
    description: 'Thông tin người gửi hàng',
    type: ShipmentSenderDto,
  })
  @ValidateNested()
  @Type(() => ShipmentSenderDto)
  sender!: ShipmentSenderDto;

  @ApiProperty({
    description: 'Thông tin người nhận hàng',
    type: ShipmentReceiverDto,
  })
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
}
