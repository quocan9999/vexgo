import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  STATION_STATUSES,
  type StationStatus,
  STATION_TYPES,
  type StationType,
} from '../station.constants.js';

export class UpdateStationDto {
  @ApiPropertyOptional({ description: 'Mã bến xe hoặc điểm đón trả', example: 'BX-MD' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  maDiem?: string;

  @ApiPropertyOptional({ description: 'Tên bến xe hoặc điểm đón trả', example: 'Bến xe Miền Đông Mới' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  tenDiem?: string;

  @ApiPropertyOptional({
    description: 'Phân loại điểm đón trả',
    enum: STATION_TYPES,
    example: 'BEN_XE',
  })
  @IsOptional()
  @IsIn(STATION_TYPES, {
    message: 'loaiDiem phải là một trong các giá trị: BEN_XE, VAN_PHONG, DIEM_DON_TRA',
  })
  loaiDiem?: StationType;

  @ApiPropertyOptional({ description: 'Địa chỉ cụ thể', example: '501 Hoàng Hữu Nam, TP. Thủ Đức' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  diaChi?: string;

  @ApiPropertyOptional({ description: 'ID địa điểm hành chính (tỉnh/thành) trực thuộc', example: 1 })
  @IsOptional()
  @IsInt()
  diaDiemCuId?: number;

  @ApiPropertyOptional({ description: 'Vĩ độ (GPS Latitude)', example: 10.8752 })
  @IsOptional()
  @IsNumber()
  viDo?: number;

  @ApiPropertyOptional({ description: 'Kinh độ (GPS Longitude)', example: 106.8283 })
  @IsOptional()
  @IsNumber()
  kinhDo?: number;

  @ApiPropertyOptional({ description: 'Số điện thoại liên hệ', example: '02838994056' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  soDienThoai?: string;

  @ApiPropertyOptional({
    description: 'Trạng thái hoạt động',
    enum: STATION_STATUSES,
    example: 'HOAT_DONG',
  })
  @IsOptional()
  @IsIn(STATION_STATUSES, {
    message: 'trangThai phải là một trong các giá trị: HOAT_DONG, NGUNG_HOAT_DONG',
  })
  trangThai?: StationStatus;
}
