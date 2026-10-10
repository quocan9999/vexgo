import { IsNotEmpty, IsString } from 'class-validator';
import { IsPasswordByteLength } from '../validators/is-password-byte-length.validator.js';

export class ChangePasswordDto {
  @IsString({ message: 'Mật khẩu cũ phải là chuỗi ký tự.' })
  @IsNotEmpty({ message: 'Vui lòng nhập mật khẩu cũ.' })
  oldPassword!: string;

  @IsString({ message: 'Mật khẩu mới phải là chuỗi ký tự.' })
  @IsNotEmpty({ message: 'Vui lòng nhập mật khẩu mới.' })
  @IsPasswordByteLength()
  newPassword!: string;
}
