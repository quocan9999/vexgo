import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, Max, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import { TrangThaiPhieuGuiHang } from '../../generated/prisma/client.js';

export class ShipmentQueryDto extends PaginationQueryDto {
  @Max(50, { message: 'Số lượng mỗi trang phải từ 1 đến 50.' })
  pageSize = 10;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MaxLength(100, { message: 'Từ khóa tìm kiếm không vượt quá 100 ký tự.' })
  declare search?: string;

  @IsOptional()
  @IsEnum(TrangThaiPhieuGuiHang, {
    message: 'Trạng thái phiếu gửi hàng không hợp lệ.',
  })
  status?: TrangThaiPhieuGuiHang;
}
