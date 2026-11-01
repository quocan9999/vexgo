import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsDefined,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateTripDto {
  @ApiPropertyOptional({ description: 'Chuyến xe có nhận chở hàng hóa/ký gửi hay không', default: false, example: true })
  @IsOptional()
  @IsBoolean()
  acceptsShipments?: boolean;

  @ApiPropertyOptional({ description: 'Mã chuyến xe (tự sinh nếu không truyền)', example: 'CX-SG-DL-01' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty()
  @MaxLength(50)
  code?: string;

  @ApiProperty({ description: 'ID tuyến xe thực hiện', example: 1 })
  @IsDefined()
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  routeId!: number;

  @ApiProperty({ description: 'ID phương tiện thực hiện chuyến', example: 1 })
  @IsDefined()
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  vehicleId!: number;

  @ApiProperty({
    description: 'Ngày khởi hành (định dạng YYYY-MM-DD)',
    example: '2026-11-20',
  })
  @IsDefined()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  departureDate!: string;

  @ApiProperty({
    description: 'Giờ khởi hành (định dạng HH:mm:ss)',
    example: '08:00:00',
  })
  @IsDefined()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/)
  departureTime!: string;

  @ApiPropertyOptional({
    description: 'Tự động sao chép các điểm đón/trả từ khuôn lộ trình của tuyến xe (mặc định bật)',
    default: true,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  copyRouteStops?: boolean;
}
