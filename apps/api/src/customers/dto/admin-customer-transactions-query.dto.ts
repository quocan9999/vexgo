import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';

export const TRANSACTION_SORT_FIELDS = ['createdDate', 'totalAmount'] as const;
export type TransactionSortField = (typeof TRANSACTION_SORT_FIELDS)[number];

export class AdminCustomerTransactionsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Trường sắp xếp giao dịch khách hàng',
    enum: TRANSACTION_SORT_FIELDS,
    example: 'createdDate',
  })
  @IsOptional()
  @IsIn(TRANSACTION_SORT_FIELDS)
  declare sortBy?: TransactionSortField;
}
