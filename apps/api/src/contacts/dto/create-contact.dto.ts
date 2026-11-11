import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { VIETNAM_PHONE_NUMBER_REGEX } from '../../common/validation/vietnamese-phone.js';

function trimString(value: unknown) {
  return typeof value === 'string' ? value.trim() : value;
}

export class CreateContactDto {
  @ApiProperty({
    description: 'Họ và tên người liên hệ',
    example: 'Nguyễn Văn A',
    maxLength: 100,
  })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty({ message: 'Họ và tên không được để trống.' })
  @MaxLength(100, { message: 'Họ và tên không được vượt quá 100 ký tự.' })
  fullName!: string;

  @ApiProperty({
    description: 'Số điện thoại liên hệ (định dạng Việt Nam)',
    example: '0912345678',
  })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty({ message: 'Số điện thoại không được để trống.' })
  @Matches(VIETNAM_PHONE_NUMBER_REGEX, {
    message:
      'Số điện thoại không hợp lệ (ví dụ: 0912345678 hoặc +84912345678).',
  })
  phoneNumber!: string;

  @ApiPropertyOptional({
    description: 'Địa chỉ email phản hồi',
    example: 'nguyenvana@gmail.com',
    maxLength: 150,
  })
  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsEmail({}, { message: 'Email không hợp lệ.' })
  @MaxLength(150, { message: 'Email không được vượt quá 150 ký tự.' })
  email?: string;

  @ApiProperty({
    description: 'Tiêu đề liên hệ hoặc chủ đề góp ý',
    example: 'Hỏi về việc hợp tác mở tuyến xe mới',
    maxLength: 200,
  })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty({ message: 'Tiêu đề không được để trống.' })
  @MaxLength(200, { message: 'Tiêu đề không được vượt quá 200 ký tự.' })
  subject!: string;

  @ApiProperty({
    description: 'Nội dung phản hồi / tin nhắn liên hệ',
    example: 'Chúng tôi muốn đăng ký tham gia mạng lưới nhà xe VexGo...',
    maxLength: 2000,
  })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty({ message: 'Nội dung liên hệ không được để trống.' })
  @MaxLength(2000, { message: 'Nội dung không được vượt quá 2000 ký tự.' })
  message!: string;
}
