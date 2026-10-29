import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

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
  @IsString()
  loaiDiem?: string;

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
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortDirection?: 'asc' | 'desc';
}
