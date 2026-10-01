import { IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';

export const CUSTOMER_SORT_FIELDS = [
  'customerCode',
  'fullName',
  'loyaltyPoints',
  'createdAt',
  'updatedAt',
] as const;
export type CustomerSortField = (typeof CUSTOMER_SORT_FIELDS)[number];

export const CUSTOMER_ACCOUNT_STATUSES = ['HOAT_DONG', 'TAM_KHOA'] as const;
export type CustomerAccountStatus = (typeof CUSTOMER_ACCOUNT_STATUSES)[number];

export class AdminCustomerQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(CUSTOMER_SORT_FIELDS)
  declare sortBy?: CustomerSortField;

  @IsOptional()
  @IsIn(CUSTOMER_ACCOUNT_STATUSES)
  accountStatus?: CustomerAccountStatus;
}
