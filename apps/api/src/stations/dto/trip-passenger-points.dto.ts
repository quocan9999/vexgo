import { IsArray, IsEnum, IsInt, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class TripPassengerPointItemDto {
  @IsInt()
  diemDonTraId!: number;

  @IsEnum(['DON', 'TRA'])
  loaiDiem!: 'DON' | 'TRA';

  @IsOptional()
  @IsString()
  thoiGianDuKien?: string;

  @IsInt()
  thuTu!: number;

  @IsOptional()
  @IsNumber()
  phuPhi?: number;
}

export class UpdateTripPassengerPointsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TripPassengerPointItemDto)
  points!: TripPassengerPointItemDto[];
}
