import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import {
  ADMIN_ACCOUNT_STATUSES,
  type AdminAccountStatus,
} from './admin-account-query.dto.js';

export class UpdateAdminAccountStatusDto {
  @ApiProperty({
    description: 'Trạng thái hoạt động mới của tài khoản',
    enum: ADMIN_ACCOUNT_STATUSES,
    example: 'TAM_KHOA',
  })
  @IsIn(ADMIN_ACCOUNT_STATUSES)
  status!: AdminAccountStatus;
}
