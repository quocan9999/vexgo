import { IsArray, IsEnum, IsInt, IsNumber, IsOptional, IsString, Matches, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class TripPassengerPointItemDto {
  @IsInt()
  diemDonTraId!: number;

  @IsEnum(['DON', 'TRA'])
  loaiDiem!: 'DON' | 'TRA';

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, {
    message: 'thoiGianDuKien phải có định dạng HH:mm hoặc HH:mm:ss (ví dụ: 08:30 hoặc 08:30:00)',
  })
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
