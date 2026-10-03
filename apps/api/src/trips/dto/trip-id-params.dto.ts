import { Transform } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class TripIdParamsDto {
  @Transform(({ value }) =>
    typeof value === 'string' && /^\d+$/.test(value)
      ? Number(value)
      : Number.NaN,
  )
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  id!: number;
}
