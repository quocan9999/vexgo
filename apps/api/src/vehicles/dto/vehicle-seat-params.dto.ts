import { Transform } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class VehicleSeatCollectionParamsDto {
  @Transform(({ value }) =>
    typeof value === 'string' && /^\d+$/.test(value)
      ? Number(value)
      : Number.NaN,
  )
  @IsInt({ message: 'ID xe phải là số nguyên.' })
  @Min(1, { message: 'ID xe phải lớn hơn 0.' })
  @Max(2_147_483_647, { message: 'ID xe vượt giới hạn.' })
  vehicleId!: number;
}

export class VehicleSeatParamsDto extends VehicleSeatCollectionParamsDto {
  @Transform(({ value }) =>
    typeof value === 'string' && /^\d+$/.test(value)
      ? Number(value)
      : Number.NaN,
  )
  @IsInt({ message: 'ID ghế phải là số nguyên.' })
  @Min(1, { message: 'ID ghế phải lớn hơn 0.' })
  @Max(2_147_483_647, { message: 'ID ghế vượt giới hạn.' })
  seatId!: number;
}
