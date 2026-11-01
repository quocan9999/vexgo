import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  ArrayNotEmpty,
  ArrayMaxSize,
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
  ValidateIf,
} from 'class-validator';
import { VIETNAM_PHONE_NUMBER_REGEX } from '../../common/validation/vietnamese-phone.js';

export class BookingContactDto {
  @ApiProperty({ description: 'Họ tên đầy đủ người liên hệ đặt vé', example: 'Nguyễn Văn A' })
  @IsNotEmpty({ message: 'Họ tên người liên hệ không được để trống.' })
  @IsString({ message: 'Họ tên phải là chuỗi ký tự.' })
  fullName!: string;

  @ApiProperty({ description: 'Số điện thoại nhận thông tin vé điện tử', example: '0912345678' })
  @IsNotEmpty({ message: 'Số điện thoại người liên hệ không được để trống.' })
  @IsString({ message: 'Số điện thoại phải là chuỗi ký tự.' })
  @Matches(VIETNAM_PHONE_NUMBER_REGEX, {
    message: 'Số điện thoại không hợp lệ.',
  })
  phone!: string;

  @ApiPropertyOptional({ description: 'Email nhận hóa đơn và vé điện tử', example: 'nguyenvana@gmail.com' })
  @IsOptional()
  @IsEmail({}, { message: 'Email không đúng định dạng.' })
  email?: string;
}

export class CargoItemDto {
  @ApiProperty({ description: 'Tên món hàng hoặc bưu kiện ký gửi', example: 'Thùng hoa quả tươi' })
  @IsString()
  @IsNotEmpty({ message: 'Tên hàng hóa không được để trống.' })
  name!: string;

  @ApiPropertyOptional({ description: 'Loại hàng hóa mô tả', example: 'Thực phẩm' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ description: 'Mã định danh loại hàng hóa', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Mã loại hàng hóa phải là số nguyên.' })
  @Min(1, { message: 'Mã loại hàng hóa không hợp lệ.' })
  loaiHangHoaId?: number;

  @ApiProperty({ description: 'Số lượng kiện hàng', example: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt({ message: 'Số lượng phải là số nguyên.' })
  @Min(1, { message: 'Số lượng tối thiểu là 1.' })
  quantity!: number;

  @ApiProperty({ description: 'Khối lượng hàng (kg)', example: 15.5 })
  @Type(() => Number)
  @IsNumber({}, { message: 'Khối lượng phải là số.' })
  @Min(0, { message: 'Khối lượng không được âm.' })
  weight!: number;

  @ApiPropertyOptional({ description: 'Phân loại đặc biệt: normal (thường), fragile (dễ vỡ), valuable (giá trị cao)', enum: ['normal', 'fragile', 'valuable'], example: 'normal' })
  @IsOptional()
  @IsString()
  category?: 'normal' | 'fragile' | 'valuable';

  @ApiPropertyOptional({ description: 'Chiều dài (cm)', example: 40 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Chiều dài phải là số.' })
  @Min(0)
  length?: number;

  @ApiPropertyOptional({ description: 'Chiều rộng (cm)', example: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Chiều rộng phải là số.' })
  @Min(0)
  width?: number;

  @ApiPropertyOptional({ description: 'Chiều cao (cm)', example: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Chiều cao phải là số.' })
  @Min(0)
  height?: number;

  @ApiPropertyOptional({ description: 'Ghi chú thêm về hàng hóa', example: 'Hàng dễ dập nát, xếp nhẹ tay' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ description: 'Dòng xe máy (nếu gửi xe máy)', example: 'Honda Airblade' })
  @IsOptional()
  @IsString()
  motorbikeModel?: string;

  @ApiPropertyOptional({ description: 'Loại xe đạp (nếu gửi xe đạp)', example: 'Xe đạp thể thao' })
  @IsOptional()
  @IsString()
  bicycleType?: string;

  @ApiPropertyOptional({ description: 'Biển số xe máy gửi kèm', example: '59P1-123.45' })
  @IsOptional()
  @IsString()
  licensePlate?: string;
}

export class ExpectedPromotionQuoteDto {
  @ApiProperty({ description: 'Tổng tiền gốc trước giảm (VNĐ)', example: '500000' })
  @IsString()
  @Matches(/^\d{1,16}(?:\.\d{1,2})?$/)
  originalTotal!: string;

  @ApiProperty({ description: 'Số tiền giảm giá (VNĐ)', example: '50000' })
  @IsString()
  @Matches(/^\d{1,16}(?:\.\d{1,2})?$/)
  discountAmount!: string;

  @ApiProperty({ description: 'Tổng tiền phải thanh toán sau giảm (VNĐ)', example: '450000' })
  @IsString()
  @Matches(/^\d{1,16}(?:\.\d{1,2})?$/)
  finalTotal!: string;
}

export class CreateBookingDto {
  @ApiProperty({ description: 'ID chuyến xe đặt vé', example: 101 })
  @IsNotEmpty({ message: 'tripId không được để trống.' })
  @Type(() => Number)
  @IsInt({ message: 'tripId phải là số nguyên.' })
  @Min(1, { message: 'tripId phải lớn hơn 0.' })
  tripId!: number;

  @ApiProperty({
    description: 'Danh sách ID các ghế cần đặt (tối đa 5 ghế)',
    example: [12, 13],
    type: [Number],
  })
  @IsArray({ message: 'seatIds phải là mảng số nguyên.' })
  @ArrayNotEmpty({ message: 'Phải chọn ít nhất một ghế.' })
  @ArrayMaxSize(5, { message: 'Mỗi chuyến xe chỉ được đặt tối đa 5 ghế.' })
  @ArrayUnique({ message: 'Danh sách ghế không được trùng.' })
  @Type(() => Number)
  @IsInt({ each: true, message: 'Mỗi seatId phải là số nguyên.' })
  seatIds!: number[];

  @ApiProperty({ description: 'Tên hoặc địa chỉ điểm đón khách', example: 'Bến xe Miền Đông Mới' })
  @IsString()
  @IsNotEmpty({ message: 'Điểm đón không được để trống.' })
  pickupPoint!: string;

  @ApiProperty({ description: 'Tên hoặc địa chỉ điểm trả khách', example: 'Bến xe Liên tỉnh Đà Lạt' })
  @IsString()
  @IsNotEmpty({ message: 'Điểm trả không được để trống.' })
  dropoffPoint!: string;

  @ApiPropertyOptional({
    description: 'Mã định danh điểm đón chuyến xe (DiemDonTraChuyenXeId)',
    example: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'diemDonChuyenXeId phải là số nguyên.' })
  @Min(1)
  diemDonChuyenXeId?: number;

  @ApiPropertyOptional({
    description: 'Mã định danh điểm trả chuyến xe (DiemDonTraChuyenXeId)',
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'diemTraChuyenXeId phải là số nguyên.' })
  @Min(1)
  diemTraChuyenXeId?: number;

  @ApiProperty({ description: 'Thông tin liên hệ của khách hàng nhận vé', type: BookingContactDto })
  @IsDefined({ message: 'Thông tin liên hệ là bắt buộc.' })
  @ValidateNested()
  @Type(() => BookingContactDto)
  contact!: BookingContactDto;

  @ApiPropertyOptional({ description: 'Mã khuyến mãi áp dụng', example: 'HE2026' })
  @IsOptional()
  @IsString()
  promotionCode?: string;

  @ApiPropertyOptional({
    description: 'Báo giá khuyến mãi đã được tính toán từ bước get quote để bảo đảm tính nhất quán',
    type: ExpectedPromotionQuoteDto,
  })
  @ValidateIf(
    (dto: CreateBookingDto) =>
      typeof dto.promotionCode === 'string' &&
      dto.promotionCode.trim().length > 0,
  )
  @IsDefined({ message: 'Báo giá khuyến mãi đã xác nhận là bắt buộc.' })
  @ValidateNested()
  @Type(() => ExpectedPromotionQuoteDto)
  expectedPromotionQuote?: ExpectedPromotionQuoteDto;

  @ApiProperty({
    description: 'Mã token phiên giữ chỗ hợp lệ được cấp từ API /seat-holds',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString()
  @IsNotEmpty({ message: 'holdToken không được để trống.' })
  holdToken!: string;

  @ApiPropertyOptional({ description: 'ID điểm gửi hàng (nếu có gửi kèm hàng hóa)', example: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Mã điểm gửi hàng phải là số nguyên.' })
  @Min(1)
  senderPointId?: number;

  @ApiPropertyOptional({ description: 'ID điểm nhận hàng (nếu có gửi kèm hàng hóa)', example: 6 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Mã điểm nhận hàng phải là số nguyên.' })
  @Min(1)
  receiverPointId?: number;

  @ApiPropertyOptional({
    description: 'Danh sách các kiện hàng gửi kèm chuyến đi',
    type: [CargoItemDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CargoItemDto)
  cargoItems?: CargoItemDto[];
}
