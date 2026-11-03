import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDefined,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
  Validate,
} from 'class-validator';
import {
  IsDateOnlyConstraint,
  ValidFarePriceDateRangeConstraint,
} from '../fare-price.dto-validators.js';
import { FARE_PRICE_STATUSES } from '../fare-price.domain.js';

export class CreateFarePriceDto {
  @ApiProperty({ description: 'ID tuyến xe áp dụng bảng giá', example: 1 })
  @IsDefined()
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  routeId!: number;

  @ApiProperty({ description: 'ID loại phương tiện áp dụng', example: 1 })
  @IsDefined()
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  vehicleTypeId!: number;

  @ApiProperty({ description: 'Giá vé niêm yết (VNĐ)', example: 250000 })
  @IsDefined()
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  listedPrice!: number;

  @ApiProperty({
    description: 'Ngày bắt đầu có hiệu lực (định dạng DD-MM-YYYY hoặc YYYY-MM-DD)',
    example: '01-01-2026',
  })
  @IsDefined()
  @Validate(IsDateOnlyConstraint)
  validFrom!: string;

  @ApiPropertyOptional({
    description: 'Ngày hết hiệu lực (bỏ trống nếu áp dụng vô thời hạn)',
    example: '31-12-2026',
  })
  @IsOptional()
  @Validate(IsDateOnlyConstraint)
  @Validate(ValidFarePriceDateRangeConstraint)
  validTo?: string | null;

  @ApiProperty({
    description: 'Trạng thái hoạt động của bảng giá',
    enum: FARE_PRICE_STATUSES,
    example: 'HOAT_DONG',
  })
  @IsDefined()
  @IsIn(FARE_PRICE_STATUSES)
  status!: (typeof FARE_PRICE_STATUSES)[number];
}
