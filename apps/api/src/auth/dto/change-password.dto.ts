import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { IsPasswordByteLength } from '../validators/is-password-byte-length.validator.js';

export class ChangePasswordDto {
  @ApiProperty({ description: 'Mật khẩu hiện tại của tài khoản', example: 'MatKhauCu@123' })
  @IsString({ message: 'Mật khẩu cũ phải là chuỗi ký tự.' })
  @IsNotEmpty({ message: 'Vui lòng nhập mật khẩu cũ.' })
  oldPassword!: string;

  @ApiProperty({ description: 'Mật khẩu mới cần thiết lập', example: 'MatKhauMoi@456' })
  @IsString({ message: 'Mật khẩu mới phải là chuỗi ký tự.' })
  @IsNotEmpty({ message: 'Vui lòng nhập mật khẩu mới.' })
  @IsPasswordByteLength()
  newPassword!: string;
}
