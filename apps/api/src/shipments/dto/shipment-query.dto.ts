import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, Max, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import { TrangThaiPhieuGuiHang } from '../../generated/prisma/client.js';

export class ShipmentQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Số lượng mục trên một trang (tối đa 50)',
    default: 10,
    example: 10,
    maximum: 50,
  })
  @Max(50, { message: 'Số lượng mỗi trang phải từ 1 đến 50.' })
  pageSize = 10;

  @ApiPropertyOptional({
    description: 'Từ khóa tìm kiếm (mã vận đơn, số điện thoại hoặc họ tên người gửi/nhận)',
    example: '0901234567',
    maxLength: 100,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MaxLength(100, { message: 'Từ khóa tìm kiếm không vượt quá 100 ký tự.' })
  declare search?: string;

  @ApiPropertyOptional({
    description: 'Trạng thái phiếu gửi hàng',
    enum: TrangThaiPhieuGuiHang,
    example: 'DA_TIEP_NHAN',
  })
  @IsOptional()
  @IsEnum(TrangThaiPhieuGuiHang, {
    message: 'Trạng thái phiếu gửi hàng không hợp lệ.',
  })
  status?: TrangThaiPhieuGuiHang;
}
