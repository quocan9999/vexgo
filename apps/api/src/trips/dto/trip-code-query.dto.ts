import { IsDateString, Matches } from 'class-validator';

export class TripCodeQueryDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  departureDate!: string;
}
