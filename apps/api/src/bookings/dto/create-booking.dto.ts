import { IsDefined, IsString, Matches } from 'class-validator';
import { BookingSelectionDto } from './quote-booking.dto.js';

export class CreateBookingDto extends BookingSelectionDto {
  @IsDefined()
  @IsString()
  @Matches(/^[0-9a-f]{64}$/)
  holdToken!: string;
}
