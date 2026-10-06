import { IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';

export const TRANSACTION_SORT_FIELDS = ['createdDate', 'totalAmount'] as const;
export type TransactionSortField = (typeof TRANSACTION_SORT_FIELDS)[number];

export class AdminCustomerTransactionsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(TRANSACTION_SORT_FIELDS)
  declare sortBy?: TransactionSortField;
}
