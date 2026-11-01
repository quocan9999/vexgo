import { ApiProperty } from '@nestjs/swagger';
import { IsDefined, IsIn } from 'class-validator';
import { CONTACT_STATUSES, type ContactStatus } from './contact-query.dto.js';

export class UpdateContactStatusDto {
  @ApiProperty({
    description: 'Trạng thái xử lý mới của liên hệ',
    enum: CONTACT_STATUSES,
    example: 'DANG_XU_LY',
  })
  @IsDefined()
  @IsIn(CONTACT_STATUSES, {
    message: 'Trạng thái không hợp lệ. Cho phép: CHO_XU_LY, DANG_XU_LY, DA_XU_LY, HUY_BO.',
  })
  status!: ContactStatus;
}
