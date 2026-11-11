import { Transform } from 'class-transformer';
import { IsIn, IsInt } from 'class-validator';
import { VehicleSeatCollectionParamsDto } from './vehicle-seat-params.dto.js';

export class VehicleSeatFloorParamsDto extends VehicleSeatCollectionParamsDto {
  @Transform(({ value }) =>
    typeof value === 'string' && /^\d+$/.test(value)
      ? Number(value)
      : Number.NaN,
  )
  @IsInt({ message: 'Tầng xe phải là số nguyên.' })
  @IsIn([2], { message: 'Chỉ có thể xóa tầng trên.' })
  floor!: number;
}
