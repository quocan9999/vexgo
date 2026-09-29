import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';

export const ADMIN_ACCOUNT_STATUSES = ['HOAT_DONG', 'TAM_KHOA'] as const;
export type AdminAccountStatus = (typeof ADMIN_ACCOUNT_STATUSES)[number];

export const ADMIN_ACCOUNT_SORT_FIELDS = [
  'fullName',
  'phoneNumber',
  'status',
  'createdAt',
  'updatedAt',
] as const;
export type AdminAccountSortField = (typeof ADMIN_ACCOUNT_SORT_FIELDS)[number];

function strictInteger(value: unknown) {
  return typeof value === 'string' && /^\d+$/.test(value)
    ? Number(value)
    : value;
}

export class AdminAccountQueryDto extends PaginationQueryDto {
  @IsIn(ADMIN_ACCOUNT_SORT_FIELDS)
  sortBy: AdminAccountSortField = 'createdAt';

  @IsOptional()
  @IsIn(ADMIN_ACCOUNT_STATUSES)
  status?: AdminAccountStatus;

  @IsOptional()
  @Transform(({ value }) => strictInteger(value))
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  busCompanyId?: number;
}
