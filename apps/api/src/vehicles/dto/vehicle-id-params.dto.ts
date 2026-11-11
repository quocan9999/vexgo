import { Transform } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class VehicleIdParamsDto {
  @Transform(({ value }) =>
    typeof value === 'string' && /^\d+$/.test(value)
      ? Number(value)
      : Number.NaN,
  )
  @IsInt({ message: 'ID xe phải là số nguyên.' })
  @Min(1, { message: 'ID xe phải lớn hơn 0.' })
  @Max(2_147_483_647, { message: 'ID xe vượt giới hạn.' })
  id!: number;
}
