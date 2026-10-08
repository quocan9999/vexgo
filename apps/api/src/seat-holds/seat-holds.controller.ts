import { Body, Controller, Delete, Param, Post } from '@nestjs/common';
import { SeatHoldsService } from './seat-holds.service.js';
import { CreateSeatHoldDto } from './dto/create-seat-hold.dto.js';
import { OptionalAuth } from '../auth/decorators/public.decorator.js';
import { CurrentPrincipal } from '../auth/decorators/current-principal.decorator.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';

@OptionalAuth()
@Controller('seat-holds')
export class SeatHoldsController {
  constructor(private readonly seatHoldsService: SeatHoldsService) {}

  @Post()
  async createSeatHold(
    @Body() dto: CreateSeatHoldDto,
    @CurrentPrincipal() principal?: AuthPrincipal,
  ) {
    return this.seatHoldsService.createSeatHold(
      dto.tripId,
      dto.seatIds,
      principal,
    );
  }

  @Delete(':holdToken')
  async releaseSeatHold(@Param('holdToken') holdToken: string) {
    return this.seatHoldsService.releaseSeatHold(holdToken);
  }
}
