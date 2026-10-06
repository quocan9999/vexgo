import { Body, Controller, Delete, Param, Post } from '@nestjs/common';
import { SeatHoldsService } from './seat-holds.service.js';
import { CreateSeatHoldDto } from './dto/create-seat-hold.dto.js';
import { Public } from '../auth/decorators/public.decorator.js';

@Public()
@Controller('seat-holds')
export class SeatHoldsController {
  constructor(private readonly seatHoldsService: SeatHoldsService) {}

  @Post()
  async createSeatHold(@Body() dto: CreateSeatHoldDto) {
    return this.seatHoldsService.createSeatHold(dto.tripId, dto.seatIds);
  }

  @Delete(':holdToken')
  async releaseSeatHold(@Param('holdToken') holdToken: string) {
    return this.seatHoldsService.releaseSeatHold(holdToken);
  }
}
