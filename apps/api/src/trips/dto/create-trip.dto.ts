import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsDefined,
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateTripDto {
  @IsDefined()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty()
  @MaxLength(50)
  code!: string;

  @IsDefined()
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  routeId!: number;

  @IsDefined()
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  vehicleId!: number;

  @IsDefined()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  departureDate!: string;

  @IsDefined()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/)
  departureTime!: string;
}
