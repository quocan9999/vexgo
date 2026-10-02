import { Matches } from 'class-validator';

export class SeatHoldTokenDto {
  @Matches(/^[0-9a-f]{64}$/)
  token!: string;
}
