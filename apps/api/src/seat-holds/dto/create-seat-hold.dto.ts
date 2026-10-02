import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsInt,
  Min,
} from 'class-validator';

export class CreateSeatHoldDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  tripId!: number;

  @Type(() => Number)
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  tripSeatIds!: number[];
}
