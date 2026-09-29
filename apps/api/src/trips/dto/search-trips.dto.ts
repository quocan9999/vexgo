import { IsOptional, IsString, IsDateString, IsNumberString } from 'class-validator';

export class SearchTripsDto {
  @IsOptional()
  @IsString()
  origin?: string;

  @IsOptional()
  @IsString()
  destination?: string;

  @IsOptional()
  @IsDateString()
  date?: string; // YYYY-MM-DD
}
