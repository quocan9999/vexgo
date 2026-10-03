import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';
import { VIETNAM_PHONE_NUMBER_REGEX } from '../../common/validation/vietnamese-phone.js';

export class CancelTicketDto {
  @IsString()
  @IsNotEmpty()
  ticketCode!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(VIETNAM_PHONE_NUMBER_REGEX, {
    message: 'Số điện thoại không hợp lệ.',
  })
  phoneNumber!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
