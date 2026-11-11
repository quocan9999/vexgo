import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import {
  FARE_PRICE_STATUSES,
  type FarePriceStatus,
} from '../fare-price.domain.js';

export class UpdateFarePriceStatusDto {
  @ApiProperty({
    description: 'Trạng thái hoạt động mới của bảng giá',
    enum: FARE_PRICE_STATUSES,
    example: 'HOAT_DONG',
  })
  @IsIn(FARE_PRICE_STATUSES)
  status!: FarePriceStatus;
}
