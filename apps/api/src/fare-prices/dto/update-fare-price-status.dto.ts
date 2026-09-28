import { IsIn } from 'class-validator';
import {
  FARE_PRICE_STATUSES,
  type FarePriceStatus,
} from '../fare-price.domain.js';

export class UpdateFarePriceStatusDto {
  @IsIn(FARE_PRICE_STATUSES)
  status!: FarePriceStatus;
}
