import { Transform } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';
import { transformStrictPositiveInteger } from './strict-positive-integer.transformer.js';

export class VehicleIdParamsDto {
  @Transform(({ value }) => transformStrictPositiveInteger(value))
  @IsInt({ message: 'ID xe phải là số nguyên.' })
  @Min(1, { message: 'ID xe phải lớn hơn 0.' })
  @Max(2_147_483_647, { message: 'ID xe vượt giới hạn.' })
  id!: number;
}
