import { ApiPropertyOptional } from '@nestjs/swagger';
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
  @ApiPropertyOptional({
    description: 'Trường sắp xếp danh sách khách hàng',
    enum: CUSTOMER_SORT_FIELDS,
    example: 'createdAt',
  })
  @IsOptional()
  @IsIn(CUSTOMER_SORT_FIELDS)
  declare sortBy?: CustomerSortField;

  @ApiPropertyOptional({
    description: 'Trạng thái tài khoản khách hàng',
    enum: CUSTOMER_ACCOUNT_STATUSES,
    example: 'HOAT_DONG',
  })
  @IsOptional()
  @IsIn(CUSTOMER_ACCOUNT_STATUSES)
  accountStatus?: CustomerAccountStatus;
}
