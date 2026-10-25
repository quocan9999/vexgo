import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';

export enum TrangThaiCuocTroChuyen {
  CHO_TIEP_NHAN = 'CHO_TIEP_NHAN',
  DANG_XU_LY = 'DANG_XU_LY',
  DA_DONG = 'DA_DONG',
}

export class ListConversationsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(TrangThaiCuocTroChuyen, {
    message: 'Trạng thái không hợp lệ (chấp nhận: CHO_TIEP_NHAN, DANG_XU_LY, DA_DONG).',
  })
  trangThai?: TrangThaiCuocTroChuyen;

  @Type(() => Number)
  @IsOptional()
  @IsInt({ message: 'Mã nhà xe phải là số nguyên.' })
  @Min(1, { message: 'Mã nhà xe không hợp lệ.' })
  nhaXeId?: number;
}
