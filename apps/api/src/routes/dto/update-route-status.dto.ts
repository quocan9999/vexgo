import { ApiProperty } from '@nestjs/swagger';
import { IsDefined, IsIn } from 'class-validator';
import { ROUTE_STATUSES } from './route-query.dto.js';

export class UpdateRouteStatusDto {
  @ApiProperty({
    description: 'Trạng thái hoạt động mới của tuyến xe',
    enum: ROUTE_STATUSES,
    example: 'HOAT_DONG',
  })
  @IsDefined()
  @IsIn(ROUTE_STATUSES)
  status!: (typeof ROUTE_STATUSES)[number];
}
