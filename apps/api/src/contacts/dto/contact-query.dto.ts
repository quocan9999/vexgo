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
  @IsIn(CONTACT_SORT_FIELDS)
  sortBy: ContactSortField = 'createdAt';

  @IsOptional()
  @IsIn(CONTACT_STATUSES)
  status?: ContactStatus;
}
