import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, Length } from 'class-validator';
import {
  CUSTOMER_ACCOUNT_STATUSES,
  type CustomerAccountStatus,
} from './admin-customer-query.dto.js';

export class UpdateCustomerStatusDto {
  @ApiProperty({
    description: 'Trạng thái hoạt động mới của tài khoản khách hàng',
    enum: CUSTOMER_ACCOUNT_STATUSES,
    example: 'TAM_KHOA',
  })
  @IsIn(CUSTOMER_ACCOUNT_STATUSES, {
    message: 'Trạng thái tài khoản không hợp lệ.',
  })
  status!: CustomerAccountStatus;

  @ApiProperty({
    description: 'Lý do thay đổi trạng thái tài khoản',
    example: 'Khách hàng vi phạm chính sách giữ chỗ nhiều lần.',
    minLength: 5,
    maxLength: 500,
  })
  @IsString({ message: 'Lý do thay đổi trạng thái phải là chuỗi ký tự.' })
  @Length(5, 500, {
    message: 'Lý do thay đổi trạng thái phải từ 5 đến 500 ký tự.',
  })
  reason!: string;
}
