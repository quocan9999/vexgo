import { Transform } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

function strictInteger(value: unknown) {
  return typeof value === 'string' && /^\d+$/.test(value)
    ? Number(value)
    : value;
}

export class AdminAccountIdParamsDto {
  @Transform(({ value }) => strictInteger(value))
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  id!: number;
}
