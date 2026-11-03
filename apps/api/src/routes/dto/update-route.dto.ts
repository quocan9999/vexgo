import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDefined, IsInt, IsNotEmpty, IsString, Max, MaxLength, Min } from 'class-validator';

function strictPositiveInteger(value: unknown) {
  if (typeof value === 'number') return Number.isInteger(value) ? value : Number.NaN;
  return typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : Number.NaN;
}

export class UpdateRouteDto {
  @ApiProperty({ description: 'Tên tỉnh/thành điểm khởi hành', example: 'TP. Hồ Chí Minh' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  origin!: string;

  @ApiProperty({ description: 'Tên tỉnh/thành điểm đến', example: 'Đà Lạt' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  destination!: string;

  @ApiProperty({ description: 'Thời gian di chuyển dự kiến (phút)', example: 360 })
  @Transform(({ value }) => strictPositiveInteger(value))
  @IsDefined()
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  durationMinutes!: number;
}
