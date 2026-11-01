import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  STATION_STATUSES,
  type StationStatus,
  STATION_TYPES,
  type StationType,
} from '../station.constants.js';

export class CreateStationDto {
  @ApiProperty({ description: 'Mã bến xe hoặc điểm đón trả (duy nhất)', example: 'BX-MD' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  maDiem!: string;

  @ApiProperty({ description: 'Tên bến xe, văn phòng hoặc điểm đón trả', example: 'Bến xe Miền Đông Mới' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  tenDiem!: string;

  @ApiProperty({
    description: 'Phân loại điểm: BEN_XE (bến xe), VAN_PHONG (văn phòng), DIEM_DON_TRA (điểm đón trả)',
    enum: STATION_TYPES,
    example: 'BEN_XE',
  })
  @IsIn(STATION_TYPES, {
    message: 'loaiDiem phải là một trong các giá trị: BEN_XE, VAN_PHONG, DIEM_DON_TRA',
  })
  loaiDiem!: StationType;

  @ApiProperty({ description: 'Địa chỉ chi tiết của điểm đón trả', example: '501 Hoàng Hữu Nam, Long Bình, TP. Thủ Đức' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  diaChi!: string;

  @ApiProperty({ description: 'ID địa điểm hành chính (tỉnh/thành) trực thuộc', example: 1 })
  @IsInt()
  diaDiemCuId!: number;

  @ApiPropertyOptional({ description: 'Vĩ độ (GPS Latitude)', example: 10.8752 })
  @IsOptional()
  @IsNumber()
  viDo?: number;

  @ApiPropertyOptional({ description: 'Kinh độ (GPS Longitude)', example: 106.8283 })
  @IsOptional()
  @IsNumber()
  kinhDo?: number;

  @ApiPropertyOptional({ description: 'Số điện thoại liên hệ của bến/văn phòng', example: '02838994056' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  soDienThoai?: string;

  @ApiPropertyOptional({
    description: 'Trạng thái hoạt động',
    enum: STATION_STATUSES,
    default: 'HOAT_DONG',
    example: 'HOAT_DONG',
  })
  @IsOptional()
  @IsIn(STATION_STATUSES, {
    message: 'trangThai phải là một trong các giá trị: HOAT_DONG, NGUNG_HOAT_DONG',
  })
  trangThai?: StationStatus;

  @ApiPropertyOptional({ description: 'ID nhà xe sở hữu văn phòng/điểm này (nếu là điểm riêng của nhà xe)', example: 1 })
  @IsOptional()
  @IsInt()
  nhaXeId?: number;
}
