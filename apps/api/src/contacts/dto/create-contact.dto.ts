import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

function trimString(value: unknown) {
  return typeof value === 'string' ? value.trim() : value;
}

export const VIETNAMESE_PHONE_REGEX =
  /^(?:\+84|0)(?:3[2-9]|5[6|8|9]|7[0|6-9]|8[1-9]|9[0-9])[0-9]{7}$/;

export class CreateContactDto {
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty({ message: 'Họ và tên không được để trống.' })
  @MaxLength(100, { message: 'Họ và tên không được vượt quá 100 ký tự.' })
  fullName!: string;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty({ message: 'Số điện thoại không được để trống.' })
  @Matches(VIETNAMESE_PHONE_REGEX, {
    message: 'Số điện thoại không hợp lệ (ví dụ: 0912345678 hoặc +84912345678).',
  })
  phoneNumber!: string;

  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsEmail({}, { message: 'Email không hợp lệ.' })
  @MaxLength(150, { message: 'Email không được vượt quá 150 ký tự.' })
  email?: string;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty({ message: 'Tiêu đề không được để trống.' })
  @MaxLength(200, { message: 'Tiêu đề không được vượt quá 200 ký tự.' })
  subject!: string;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty({ message: 'Nội dung liên hệ không được để trống.' })
  @MaxLength(2000, { message: 'Nội dung không được vượt quá 2000 ký tự.' })
  message!: string;
}
