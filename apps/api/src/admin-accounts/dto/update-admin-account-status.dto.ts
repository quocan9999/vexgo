import { IsIn } from 'class-validator';
import {
  ADMIN_ACCOUNT_STATUSES,
  type AdminAccountStatus,
} from './admin-account-query.dto.js';

export class UpdateAdminAccountStatusDto {
  @IsIn(ADMIN_ACCOUNT_STATUSES)
  status!: AdminAccountStatus;
}
