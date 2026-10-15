import { IsIn } from 'class-validator';

export class UpdatePromotionStatusDto {
  @IsIn(['HOAT_DONG', 'TAM_NGUNG'])
  status!: 'HOAT_DONG' | 'TAM_NGUNG';
}
