import { IsNotEmpty, IsString, Matches } from 'class-validator';

const VIETNAM_PHONE_NUMBER =
  /^(?:\+84|0)(?:3[2-9]|5[689]|7[06-9]|8[1-9]|9\d)\d{7}$/;

export class TicketLookupQueryDto {
  @IsString()
  @IsNotEmpty()
  ticketCode!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(VIETNAM_PHONE_NUMBER, {
    message: 'Số điện thoại không hợp lệ.',
  })
  phoneNumber!: string;
}
