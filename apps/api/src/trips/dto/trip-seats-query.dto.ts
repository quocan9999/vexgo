import { IsIn, IsOptional } from 'class-validator';

export class TripSeatsQueryDto {
  @IsOptional()
  @IsIn(['TRONG', 'DANG_GIU', 'DA_DAT'])
  status?: string;
}
