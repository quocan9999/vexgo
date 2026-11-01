import { ApiProperty } from '@nestjs/swagger';
import { IsDefined, IsIn } from 'class-validator';
import {
  BUS_COMPANY_STATUSES,
  type BusCompanyStatus,
} from './bus-company-query.dto.js';

export class UpdateBusCompanyStatusDto {
  @ApiProperty({
    description: 'Trạng thái hoạt động mới của nhà xe',
    enum: BUS_COMPANY_STATUSES,
    example: 'HOAT_DONG',
  })
  @IsDefined()
  @IsIn(BUS_COMPANY_STATUSES)
  status!: BusCompanyStatus;
}
