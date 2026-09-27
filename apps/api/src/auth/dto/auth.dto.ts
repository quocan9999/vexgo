import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

const PHONE_NUMBER_PATTERN = /^\+?[0-9]{9,15}$/;
const CCCD_PATTERN = /^[0-9]{12}$/;

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  hoTen!: string;

  @IsString()
  @Matches(PHONE_NUMBER_PATTERN, {
    message: 'Số điện thoại không hợp lệ.',
  })
  soDienThoai!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  matKhau!: string;

  @IsOptional()
  @IsEmail({}, { message: 'Email không hợp lệ.' })
  @MaxLength(150)
  email?: string;

  @IsOptional()
  @Matches(CCCD_PATTERN, {
    message: 'CCCD phải gồm đúng 12 chữ số.',
  })
  cccd?: string;
}

export class LoginDto {
  @IsString()
  @Matches(PHONE_NUMBER_PATTERN, {
    message: 'Số điện thoại không hợp lệ.',
  })
  soDienThoai!: string;

  @IsString()
  @IsNotEmpty()
  matKhau!: string;
}
