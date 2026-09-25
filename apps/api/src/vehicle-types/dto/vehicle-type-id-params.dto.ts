import { Transform } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class VehicleTypeIdParamsDto {
  @Transform(({ value }) =>
    typeof value === 'string' && /^\d+$/.test(value)
      ? Number(value)
      : Number.NaN,
  )
  @IsInt({ message: 'ID loại xe phải là số nguyên.' })
  @Min(1, { message: 'ID loại xe phải lớn hơn 0.' })
  @Max(2_147_483_647, { message: 'ID loại xe vượt giới hạn.' })
  id!: number;
}
