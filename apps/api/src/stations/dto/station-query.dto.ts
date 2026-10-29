import { IsEnum, IsIn, IsInt, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import {
  STATION_STATUSES,
  type StationStatus,
  STATION_TYPES,
  type StationType,
} from '../station.constants.js';

export class StationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  pageSize?: number = 20;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(STATION_TYPES, {
    message: 'loaiDiem phải là một trong các giá trị: BEN_XE, VAN_PHONG, DIEM_DON_TRA',
  })
  loaiDiem?: StationType;

  @IsOptional()
  @IsIn(STATION_STATUSES, {
    message: 'trangThai phải là một trong các giá trị: HOAT_DONG, NGUNG_HOAT_DONG',
  })
  trangThai?: StationStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  diaDiemCuId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  diaDiemMoiId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  nhaXeId?: number;

  @IsOptional()
  @IsIn(['createdAt', 'updatedAt', 'tenDiem', 'maDiem', 'loaiDiem'], {
    message: 'sortBy phải là một trong các giá trị: createdAt, updatedAt, tenDiem, maDiem, loaiDiem',
  })
  sortBy?: string = 'createdAt';

  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortDirection?: 'asc' | 'desc';
}
