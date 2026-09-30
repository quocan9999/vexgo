import { Body, Controller, Delete, Param, Post } from '@nestjs/common';
import { SeatHoldsService } from './seat-holds.service.js';

@Controller('seat-holds')
export class SeatHoldsController {
  constructor(private readonly seatHoldsService: SeatHoldsService) {}

  @Post()
  async createSeatHold(
    @Body() body: { tripId: number | string; seatIds: Array<number | string> },
  ) {
    const tripId = Number(body.tripId);
    const seatIds = (body.seatIds || []).map(Number);
    return this.seatHoldsService.createSeatHold(tripId, seatIds);
  }

  @Delete(':holdToken')
  async releaseSeatHold(@Param('holdToken') holdToken: string) {
    return this.seatHoldsService.releaseSeatHold(holdToken);
  }
}
