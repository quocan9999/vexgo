import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { TrangThaiPhieuGuiHang } from '../../generated/prisma/client.js';

export class ShipmentQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Trang phải là số nguyên.' })
  @Min(1, { message: 'Trang phải lớn hơn hoặc bằng 1.' })
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Số lượng mỗi trang phải là số nguyên.' })
  @Min(1, { message: 'Số lượng mỗi trang phải từ 1 đến 50.' })
  @Max(50, { message: 'Số lượng mỗi trang phải từ 1 đến 50.' })
  pageSize: number = 10;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'Từ khóa tìm kiếm phải là chuỗi.' })
  @MaxLength(100, { message: 'Từ khóa tìm kiếm không vượt quá 100 ký tự.' })
  search?: string;

  @IsOptional()
  @IsEnum(TrangThaiPhieuGuiHang, {
    message: 'Trạng thái phiếu gửi hàng không hợp lệ.',
  })
  status?: TrangThaiPhieuGuiHang;

  @IsOptional()
  @IsIn(['asc', 'desc'], {
    message: 'Hướng sắp xếp phải là asc hoặc desc.',
  })
  sortDirection: 'asc' | 'desc' = 'desc';
}
