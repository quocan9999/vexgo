import { IsDefined, IsIn } from 'class-validator';
import { ROUTE_STATUSES } from './route-query.dto.js';

export class UpdateRouteStatusDto {
  @IsDefined()
  @IsIn(ROUTE_STATUSES)
  status!: (typeof ROUTE_STATUSES)[number];
}
