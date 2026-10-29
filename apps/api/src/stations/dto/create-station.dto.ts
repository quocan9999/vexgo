import { IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateStationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  maDiem!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  tenDiem!: string;

  @IsEnum(['BEN_XE', 'VAN_PHONG', 'DIEM_DON_TRA'], {
    message: 'loaiDiem phải là BEN_XE, VAN_PHONG hoặc DIEM_DON_TRA',
  })
  loaiDiem!: 'BEN_XE' | 'VAN_PHONG' | 'DIEM_DON_TRA';

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
  @IsString()
  trangThai?: string;

  @IsOptional()
  @IsInt()
  nhaXeId?: number;
}
