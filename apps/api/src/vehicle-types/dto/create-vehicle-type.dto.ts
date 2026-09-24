import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateVehicleTypeDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Tên loại xe phải là chuỗi.' })
  @IsNotEmpty({ message: 'Tên loại xe là bắt buộc.' })
  @MaxLength(100, { message: 'Tên loại xe không được vượt quá 100 ký tự.' })
  name!: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() || null : value,
  )
  @IsOptional()
  @IsString({ message: 'Mô tả phải là chuỗi.' })
  @MaxLength(500, { message: 'Mô tả không được vượt quá 500 ký tự.' })
  description?: string | null;
}
