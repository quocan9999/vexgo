import { IsEnum, IsInt, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateStationDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  maDiem?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  tenDiem?: string;

  @IsOptional()
  @IsEnum(['BEN_XE', 'VAN_PHONG', 'DIEM_DON_TRA'])
  loaiDiem?: 'BEN_XE' | 'VAN_PHONG' | 'DIEM_DON_TRA';

  @IsOptional()
  @IsString()
  @MaxLength(255)
  diaChi?: string;

  @IsOptional()
  @IsInt()
  diaDiemCuId?: number;

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
  @IsString()
  trangThai?: string;
}
