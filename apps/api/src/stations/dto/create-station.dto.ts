import { IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  STATION_STATUSES,
  type StationStatus,
  STATION_TYPES,
  type StationType,
} from '../station.constants.js';

export class CreateStationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  maDiem!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  tenDiem!: string;

  @IsIn(STATION_TYPES, {
    message: 'loaiDiem phải là một trong các giá trị: BEN_XE, VAN_PHONG, DIEM_DON_TRA',
  })
  loaiDiem!: StationType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  diaChi!: string;

  @IsInt()
  diaDiemCuId!: number;

  @IsOptional()
  @IsNumber()
  viDo?: number;

  @IsOptional()
  @IsNumber()
  kinhDo?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  soDienThoai?: string;

  @IsOptional()
  @IsIn(STATION_STATUSES, {
    message: 'trangThai phải là một trong các giá trị: HOAT_DONG, NGUNG_HOAT_DONG',
  })
  trangThai?: StationStatus;

  @IsOptional()
  @IsInt()
  nhaXeId?: number;
}
