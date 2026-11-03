import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';
import { VIETNAM_PHONE_NUMBER_REGEX } from '../../common/validation/vietnamese-phone.js';

export class TicketLookupQueryDto {
  @ApiProperty({ description: 'Mã vé xe cần tra cứu', example: 'TK-202610-001' })
  @IsString()
  @IsNotEmpty()
  ticketCode!: string;

  @ApiProperty({ description: 'Số điện thoại đặt vé để xác thực', example: '0912345678' })
  @IsString()
  @IsNotEmpty()
  @Matches(VIETNAM_PHONE_NUMBER_REGEX, {
    message: 'Số điện thoại không hợp lệ.',
  })
  phoneNumber!: string;
}
