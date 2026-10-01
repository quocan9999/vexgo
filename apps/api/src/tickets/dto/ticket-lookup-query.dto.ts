import { IsNotEmpty, IsString } from 'class-validator';

export class TicketLookupQueryDto {
  @IsString()
  @IsNotEmpty()
  ticketCode!: string;

  @IsString()
  @IsNotEmpty()
  phoneNumber!: string;
}
