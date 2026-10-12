import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Headers,
  Param,
  Post,
} from '@nestjs/common';
import { SeatHoldsService } from './seat-holds.service.js';
import { CreateSeatHoldDto } from './dto/create-seat-hold.dto.js';
import { ReleaseSeatHoldDto } from './dto/release-seat-hold.dto.js';
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

  @Delete()
  async releaseSeatHoldDirect(
    @Headers('x-hold-token') headerToken?: string,
    @Body() body?: ReleaseSeatHoldDto,
  ) {
    const token = headerToken || body?.holdToken;
    if (!token || token.trim().length === 0) {
      throw new BadRequestException('Mã giữ chỗ (holdToken) là bắt buộc.');
    }
    return this.seatHoldsService.releaseSeatHold(token.trim());
  }

  @Delete(':holdToken')
  async releaseSeatHold(
    @Param('holdToken') holdToken: string,
    @Headers('x-hold-token') headerToken?: string,
  ) {
    const token = headerToken || holdToken;
    return this.seatHoldsService.releaseSeatHold(token);
  }
}

