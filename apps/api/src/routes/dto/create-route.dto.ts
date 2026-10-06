import { Transform } from 'class-transformer';
import { IsDefined, IsIn, IsInt, IsNotEmpty, IsString, Max, MaxLength, Min } from 'class-validator';
import { ROUTE_STATUSES } from './route-query.dto.js';

function trimString(value: unknown) {
  return typeof value === 'string' ? value.trim() : value;
}

function strictPositiveInteger(value: unknown) {
  if (typeof value === 'number') return Number.isInteger(value) ? value : Number.NaN;
  return typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : Number.NaN;
}

export class CreateRouteDto {
  @Transform(({ value }) => trimString(value))
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code!: string;

  @Transform(({ value }) => trimString(value))
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  origin!: string;

  @Transform(({ value }) => trimString(value))
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

  @Transform(({ value }) => strictPositiveInteger(value))
  @IsDefined()
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  busCompanyId!: number;

  @IsDefined()
  @IsIn(ROUTE_STATUSES)
  status!: (typeof ROUTE_STATUSES)[number];
}
