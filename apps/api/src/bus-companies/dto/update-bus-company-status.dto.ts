import { IsDefined, IsIn } from 'class-validator';
import {
  BUS_COMPANY_STATUSES,
  type BusCompanyStatus,
} from './bus-company-query.dto.js';

export class UpdateBusCompanyStatusDto {
  @IsDefined()
  @IsIn(BUS_COMPANY_STATUSES)
  status!: BusCompanyStatus;
}
