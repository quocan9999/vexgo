import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  IsInt,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { IsDateOnly } from '../../common/validators/is-date-only.validator.js';
import { VIETNAM_E164_PHONE_PATTERN } from '../../auth/otp/otp.constants.js';
import { IsPasswordByteLength } from '../../auth/validators/is-password-byte-length.validator.js';
import { TENANT_PRINCIPAL_ROLES } from '../../auth/principal-scope.js';

type TenantPrincipalRole = (typeof TENANT_PRINCIPAL_ROLES)[number];

const CCCD_PATTERN = /^\d{12}$/;

function strictInteger(value: unknown) {
  return typeof value === 'string' && /^\d+$/.test(value)
    ? Number(value)
    : value;
}

export class CreateAdminAccountDto {
  @ApiProperty({ description: 'Họ và tên nhân viên/quản trị viên', example: 'Trần Văn B' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  fullName!: string;

  @ApiProperty({
    description: 'Số điện thoại chuẩn E.164 dùng làm tài khoản đăng nhập',
    example: '+84987654321',
  })
  @IsString()
  @Matches(VIETNAM_E164_PHONE_PATTERN, {
    message: 'Số điện thoại không hợp lệ.',
  })
  phoneNumber!: string;

  @ApiProperty({
    description: 'Mật khẩu khởi tạo ban đầu',
    example: 'NhanVien@123',
  })
  @IsString()
  @IsNotEmpty()
  @IsPasswordByteLength()
  password!: string;

  @ApiProperty({
    description: 'ID nhà xe mà nhân viên này trực thuộc',
    example: 1,
  })
  @Transform(({ value }) => strictInteger(value))
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  busCompanyId!: number;

  @ApiPropertyOptional({
    description: 'Mã số nhân viên nội bộ (tự sinh nếu không truyền)',
    example: '550e8400e29b41d4a716446655440000',
  })
  @ValidateIf((_object, value) => value !== undefined && value !== null && value !== '')
  @IsString()
  @MaxLength(50)
  employeeCode?: string;

  @ApiPropertyOptional({
    description: 'Danh sách các vai trò được phân quyền cho tài khoản này trong nhà xe',
    enum: TENANT_PRINCIPAL_ROLES,
    isArray: true,
    example: ['ADMIN_NHA_XE', 'DIEU_HANH'],
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsString({ each: true })
  @IsIn([...TENANT_PRINCIPAL_ROLES], { each: true })
  roleNames?: TenantPrincipalRole[];

  @ApiPropertyOptional({
    description: 'Ngày sinh (định dạng DD-MM-YYYY hoặc YYYY-MM-DD)',
    example: '20-10-1990',
  })
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsDateOnly({ message: 'Ngày sinh phải là ngày hợp lệ dạng YYYY-MM-DD.' })
  dateOfBirth?: string | null;

  @ApiPropertyOptional({
    description: 'Email liên hệ của nhân viên',
    example: 'nhanvien@phuongtrang.vn',
  })
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsEmail({}, { message: 'Email không hợp lệ.' })
  @MaxLength(150)
  email?: string | null;

  @ApiPropertyOptional({
    description: 'Số CCCD (12 chữ số)',
    example: '079190001234',
  })
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @Matches(CCCD_PATTERN, { message: 'CCCD phải gồm đúng 12 chữ số.' })
  citizenId?: string | null;
}
