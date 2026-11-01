import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsDefined,
  Matches,
} from 'class-validator';

export class UpdateTripDto {
  @ApiProperty({ description: 'Ngày khởi hành mới (YYYY-MM-DD)', example: '2026-11-20' })
  @IsDefined()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  departureDate!: string;

  @ApiProperty({ description: 'Giờ khởi hành mới (HH:mm:ss)', example: '09:00:00' })
  @IsDefined()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/)
  departureTime!: string;
}
