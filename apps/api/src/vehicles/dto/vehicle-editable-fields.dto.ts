import { Transform } from 'class-transformer';
import {
  IsDefined,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

function strictPositiveInteger(value: unknown) {
  if (typeof value === 'number') {
    return Number.isInteger(value) ? value : Number.NaN;
  }

  return typeof value === 'string' && /^\d+$/.test(value)
    ? Number(value)
    : Number.NaN;
}

export class VehicleEditableFieldsDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  @MaxLength(15)
  licensePlate!: string;

  @Transform(({ value }) => strictPositiveInteger(value))
  @IsDefined()
  @IsInt({ message: 'ID nhà xe phải là số nguyên.' })
  @Min(1, { message: 'ID nhà xe phải lớn hơn 0.' })
  @Max(2_147_483_647, { message: 'ID nhà xe vượt giới hạn.' })
  busCompanyId!: number;

  @Transform(({ value }) => strictPositiveInteger(value))
  @IsDefined()
  @IsInt({ message: 'ID loại xe phải là số nguyên.' })
  @Min(1, { message: 'ID loại xe phải lớn hơn 0.' })
  @Max(2_147_483_647, { message: 'ID loại xe vượt giới hạn.' })
  vehicleTypeId!: number;
}
