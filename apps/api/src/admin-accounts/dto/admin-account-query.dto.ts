import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  Matches,
  Max,
  Min,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import { TENANT_PRINCIPAL_ROLES } from '../../auth/principal-scope.js';

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
export type AdminAccountFilterRole = (typeof TENANT_PRINCIPAL_ROLES)[number];

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

@ValidatorConstraint({ name: 'createdDateRange', async: false })
class CreatedDateRangeConstraint implements ValidatorConstraintInterface {
  validate(createdTo: string, args: ValidationArguments) {
    const { createdFrom } = args.object as { createdFrom?: string };
    return !createdFrom || Date.parse(createdFrom) <= Date.parse(createdTo);
  }

  defaultMessage() {
    return 'Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.';
  }
}

function strictInteger(value: unknown) {
  return typeof value === 'string' && /^\d+$/.test(value)
    ? Number(value)
    : value;
}

export class AdminAccountQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Trường dùng để sắp xếp',
    enum: ADMIN_ACCOUNT_SORT_FIELDS,
    default: 'createdAt',
    example: 'createdAt',
  })
  @IsIn(ADMIN_ACCOUNT_SORT_FIELDS)
  sortBy: AdminAccountSortField = 'createdAt';

  @ApiPropertyOptional({
    description: 'Lọc theo trạng thái tài khoản',
    enum: ADMIN_ACCOUNT_STATUSES,
    example: 'HOAT_DONG',
  })
  @IsOptional()
  @IsIn(ADMIN_ACCOUNT_STATUSES)
  status?: AdminAccountStatus;

  @ApiPropertyOptional({
    description: 'Lọc theo ID nhà xe trực thuộc',
    example: 1,
  })
  @IsOptional()
  @Transform(({ value }) => strictInteger(value))
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  busCompanyId?: number;

  @ApiPropertyOptional({
    description: 'Lọc theo vai trò của tài khoản',
    enum: TENANT_PRINCIPAL_ROLES,
    example: 'ADMIN_NHA_XE',
  })
  @IsOptional()
  @IsIn(TENANT_PRINCIPAL_ROLES)
  roleName?: AdminAccountFilterRole;

  @ApiPropertyOptional({
    description: 'Lọc tài khoản tạo từ ngày (YYYY-MM-DD)',
    example: '2026-01-01',
  })
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(DATE_ONLY_PATTERN, {
    message: 'Ngày phải có định dạng YYYY-MM-DD.',
  })
  createdFrom?: string;

  @ApiPropertyOptional({
    description: 'Lọc tài khoản tạo đến ngày (YYYY-MM-DD)',
    example: '2026-12-31',
  })
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(DATE_ONLY_PATTERN, {
    message: 'Ngày phải có định dạng YYYY-MM-DD.',
  })
  @Validate(CreatedDateRangeConstraint)
  createdTo?: string;
}
