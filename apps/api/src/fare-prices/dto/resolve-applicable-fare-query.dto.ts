import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDefined,
  IsInt,
  Max,
  Min,
  Validate,
} from 'class-validator';
import { IsDateOnlyConstraint } from '../fare-price.dto-validators.js';

export class ResolveApplicableFareQueryDto {
  @ApiProperty({ description: 'ID tuyến xe cần tra cứu giá vé', example: 1 })
  @IsDefined()
  @Transform(({ value }) =>
    typeof value === 'string' && /^\d+$/.test(value)
      ? Number(value)
      : Number.NaN,
  )
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  routeId!: number;

  @ApiProperty({ description: 'ID loại phương tiện (dòng xe)', example: 1 })
  @IsDefined()
  @Transform(({ value }) =>
    typeof value === 'string' && /^\d+$/.test(value)
      ? Number(value)
      : Number.NaN,
  )
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  vehicleTypeId!: number;

  @ApiProperty({
    description: 'Ngày đi cần tính giá vé (định dạng DD-MM-YYYY hoặc YYYY-MM-DD)',
    example: '25-12-2026',
  })
  @IsDefined()
  @Validate(IsDateOnlyConstraint)
  date!: string;
}
