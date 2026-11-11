import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export class TripSeatsQueryDto {
  @ApiPropertyOptional({
    description: 'Lọc ghế theo trạng thái: TRONG (ghế trống), DANG_GIU (đang giữ chỗ), DA_DAT (đã bán)',
    enum: ['TRONG', 'DANG_GIU', 'DA_DAT'],
    example: 'TRONG',
  })
  @IsOptional()
  @IsIn(['TRONG', 'DANG_GIU', 'DA_DAT'])
  status?: string;
}
