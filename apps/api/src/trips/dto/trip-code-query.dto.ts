import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, Matches } from 'class-validator';

export class TripCodeQueryDto {
  @ApiProperty({ description: 'Ngày khởi hành để xem trước mã chuyến (YYYY-MM-DD)', example: '2026-11-20' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  departureDate!: string;
}
