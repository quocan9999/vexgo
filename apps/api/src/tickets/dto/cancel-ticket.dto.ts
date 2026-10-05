import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
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

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  expectedCancelFeeRate?: number;
}
