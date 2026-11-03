import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class UpdatePromotionStatusDto {
  @ApiProperty({
    description: 'Trạng thái mới của khuyến mãi',
    enum: ['HOAT_DONG', 'TAM_NGUNG'],
    example: 'HOAT_DONG',
  })
  @IsIn(['HOAT_DONG', 'TAM_NGUNG'])
  status!: 'HOAT_DONG' | 'TAM_NGUNG';
}
