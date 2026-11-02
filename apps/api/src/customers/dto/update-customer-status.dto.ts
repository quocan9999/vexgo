import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { TrangThaiTaiKhoan } from '../../generated/prisma/enums.js';

export class UpdateCustomerStatusDto {
  @ApiProperty({
    description: 'Trạng thái hoạt động mới của tài khoản khách hàng',
    enum: TrangThaiTaiKhoan,
    example: TrangThaiTaiKhoan.TAM_KHOA,
  })
  @IsEnum(TrangThaiTaiKhoan, {
    message: 'Trạng thái tài khoản không hợp lệ.',
  })
  status!: TrangThaiTaiKhoan;

  @ApiPropertyOptional({
    description: 'Lý do thay đổi trạng thái tài khoản (tùy chọn)',
    example: 'Khách hàng vi phạm chính sách giữ chỗ nhiều lần.',
    maxLength: 255,
  })
  @IsOptional()
  @IsString({ message: 'Lý do thay đổi trạng thái phải là chuỗi ký tự.' })
  @MaxLength(255, {
    message: 'Lý do thay đổi trạng thái tối đa 255 ký tự.',
  })
  reason?: string;

  @ApiPropertyOptional({
    description: 'Ngày hết hạn tạm khóa (định dạng DD-MM-YYYY), bắt buộc khi tạm khóa',
    example: '15-11-2026',
  })
  @ValidateIf((o: UpdateCustomerStatusDto) => o.status === TrangThaiTaiKhoan.TAM_KHOA)
  @IsNotEmpty({ message: 'Vui lòng chọn ngày hết hạn tạm khóa.' })
  @Matches(/^(\d{2})-(\d{2})-(\d{4})$/, {
    message: 'Ngày hết hạn tạm khóa phải có định dạng DD-MM-YYYY.',
  })
  @IsOptional()
  lockedUntil?: string;
}
