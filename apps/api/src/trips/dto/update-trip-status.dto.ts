import { IsDefined, IsIn, IsString } from 'class-validator';

export const TRIP_MUTABLE_STATUSES = [
  'CHUA_KHOI_HANH',
  'DANG_CHAY',
  'HOAN_THANH',
] as const;

export type TripMutableStatus = (typeof TRIP_MUTABLE_STATUSES)[number];

export class UpdateTripStatusDto {
  @IsDefined()
  @IsString()
  @IsIn(TRIP_MUTABLE_STATUSES, {
    message:
      'Trạng thái chuyến xe không hợp lệ. Chỉ chấp nhận CHUA_KHOI_HANH, DANG_CHAY hoặc HOAN_THANH.',
  })
  status!: TripMutableStatus;
}
