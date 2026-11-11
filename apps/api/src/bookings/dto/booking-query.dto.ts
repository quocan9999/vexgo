import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { IsDateOnly } from '../../common/validators/is-date-only.validator.js';

export class BookingQueryDto {
  @ApiPropertyOptional({ description: 'Trang truy vấn', default: 1, example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ description: 'Số đơn trên một trang', default: 10, example: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 10;

  @ApiPropertyOptional({ description: 'Từ khóa tìm kiếm', example: 'Đà Lạt' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Mã đơn đặt vé', example: 'BK-202610-001' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ description: 'Tên tuyến xe', example: 'Sài Gòn - Đà Lạt' })
  @IsOptional()
  @IsString()
  route?: string;

  @ApiPropertyOptional({ description: 'Ngày khởi hành (DD-MM-YYYY hoặc YYYY-MM-DD)', example: '20-11-2026' })
  @IsOptional()
  @IsDateOnly({ message: 'Ngày khởi hành không hợp lệ.' })
  departureDate?: string;

  @ApiPropertyOptional({ description: 'Trạng thái đơn: CHO_THANH_TOAN, DA_THANH_TOAN, HOAN_THANH, DA_HUY', example: 'DA_THANH_TOAN' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Trường sắp xếp', enum: ['createdAt', 'totalAmount'], default: 'createdAt' })
  @IsOptional()
  @IsIn(['createdAt', 'totalAmount'])
  sortBy?: 'createdAt' | 'totalAmount';

  @ApiPropertyOptional({ description: 'Hướng sắp xếp (asc hoặc desc)', enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDirection?: 'asc' | 'desc';
}
