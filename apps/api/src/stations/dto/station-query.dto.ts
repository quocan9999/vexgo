import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsInt, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import {
  STATION_STATUSES,
  type StationStatus,
  STATION_TYPES,
  type StationType,
} from '../station.constants.js';

export class StationQueryDto {
  @ApiPropertyOptional({ description: 'Trang cần truy vấn (bắt đầu từ 1)', default: 1, example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Số lượng mục trên một trang', default: 20, example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  pageSize?: number = 20;

  @ApiPropertyOptional({ description: 'Từ khóa tìm kiếm theo tên hoặc mã điểm', example: 'Miền Đông' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Lọc theo loại điểm',
    enum: STATION_TYPES,
    example: 'BEN_XE',
  })
  @IsOptional()
  @IsIn(STATION_TYPES, {
    message: 'loaiDiem phải là một trong các giá trị: BEN_XE, VAN_PHONG, DIEM_DON_TRA',
  })
  loaiDiem?: StationType;

  @ApiPropertyOptional({
    description: 'Lọc theo trạng thái',
    enum: STATION_STATUSES,
    example: 'HOAT_DONG',
  })
  @IsOptional()
  @IsIn(STATION_STATUSES, {
    message: 'trangThai phải là một trong các giá trị: HOAT_DONG, NGUNG_HOAT_DONG',
  })
  trangThai?: StationStatus;

  @ApiPropertyOptional({ description: 'Lọc theo ID tỉnh/thành', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  diaDiemCuId?: number;

  @ApiPropertyOptional({ description: 'Lọc theo ID địa điểm mở rộng', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  diaDiemMoiId?: number;

  @ApiPropertyOptional({ description: 'Lọc theo ID nhà xe sở hữu', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  nhaXeId?: number;

  @ApiPropertyOptional({
    description: 'Trường sắp xếp kết quả',
    enum: ['createdAt', 'updatedAt', 'tenDiem', 'maDiem', 'loaiDiem'],
    default: 'createdAt',
    example: 'createdAt',
  })
  @IsOptional()
  @IsIn(['createdAt', 'updatedAt', 'tenDiem', 'maDiem', 'loaiDiem'], {
    message: 'sortBy phải là một trong các giá trị: createdAt, updatedAt, tenDiem, maDiem, loaiDiem',
  })
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({
    description: 'Hướng sắp xếp (asc hoặc desc)',
    enum: ['asc', 'desc'],
    default: 'desc',
    example: 'desc',
  })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortDirection?: 'asc' | 'desc';
}
