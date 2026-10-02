import {
  IsDateString,
  IsDefined,
  Matches,
} from 'class-validator';

export class UpdateTripDto {
  @IsDefined()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  departureDate!: string;

  @IsDefined()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/)
  departureTime!: string;
}
