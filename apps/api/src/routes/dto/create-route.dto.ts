import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsDefined, IsIn, IsInt, IsNotEmpty, IsString, Max, MaxLength, Min } from 'class-validator';
import { ROUTE_STATUSES } from './route-query.dto.js';

function trimString(value: unknown) {
  return typeof value === 'string' ? value.trim() : value;
}

function strictPositiveInteger(value: unknown) {
  if (typeof value === 'number') return Number.isInteger(value) ? value : Number.NaN;
  return typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : Number.NaN;
}

export class CreateRouteDto {
  @ApiPropertyOptional({ description: 'Mã tuyến xe (nếu không truyền hệ thống sẽ tự sinh)', example: 'SG-DL-01' })
  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code?: string;

  @ApiProperty({ description: 'Tên tỉnh/thành điểm khởi hành', example: 'TP. Hồ Chí Minh' })
  @Transform(({ value }) => trimString(value))
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  origin!: string;

  @ApiProperty({ description: 'Tên tỉnh/thành điểm đến', example: 'Đà Lạt' })
  @Transform(({ value }) => trimString(value))
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  destination!: string;

  @ApiProperty({ description: 'Thời gian di chuyển dự kiến tính bằng phút', example: 360 })
  @Transform(({ value }) => strictPositiveInteger(value))
  @IsDefined()
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  durationMinutes!: number;

  @ApiProperty({ description: 'ID nhà xe khai thác tuyến', example: 1 })
  @Transform(({ value }) => strictPositiveInteger(value))
  @IsDefined()
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  busCompanyId!: number;

  @ApiProperty({
    description: 'Trạng thái hoạt động của tuyến xe',
    enum: ROUTE_STATUSES,
    example: 'HOAT_DONG',
  })
  @IsDefined()
  @IsIn(ROUTE_STATUSES)
  status!: (typeof ROUTE_STATUSES)[number];
}
