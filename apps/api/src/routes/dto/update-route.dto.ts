import { Transform } from 'class-transformer';
import { IsDefined, IsInt, IsNotEmpty, IsString, Max, MaxLength, Min } from 'class-validator';

function strictPositiveInteger(value: unknown) {
  if (typeof value === 'number') return Number.isInteger(value) ? value : Number.NaN;
  return typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : Number.NaN;
}

export class UpdateRouteDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  origin!: string;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  destination!: string;

  @Transform(({ value }) => strictPositiveInteger(value))
  @IsDefined()
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  durationMinutes!: number;
}
