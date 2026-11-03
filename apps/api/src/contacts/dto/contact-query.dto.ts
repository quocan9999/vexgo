import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';

export const CONTACT_STATUSES = [
  'CHO_XU_LY',
  'DANG_XU_LY',
  'DA_XU_LY',
  'HUY_BO',
] as const;

export type ContactStatus = (typeof CONTACT_STATUSES)[number];

export const CONTACT_SORT_FIELDS = [
  'createdAt',
  'hoTen',
  'trangThai',
] as const;

export type ContactSortField = (typeof CONTACT_SORT_FIELDS)[number];

export class ContactQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Trường sắp xếp danh sách liên hệ',
    enum: CONTACT_SORT_FIELDS,
    default: 'createdAt',
    example: 'createdAt',
  })
  @IsIn(CONTACT_SORT_FIELDS)
  sortBy: ContactSortField = 'createdAt';

  @ApiPropertyOptional({
    description: 'Trạng thái xử lý liên hệ',
    enum: CONTACT_STATUSES,
    example: 'CHO_XU_LY',
  })
  @IsOptional()
  @IsIn(CONTACT_STATUSES)
  status?: ContactStatus;
}
