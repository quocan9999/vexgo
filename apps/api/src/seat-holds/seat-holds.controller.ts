import { Body, Controller, Delete, Param, Post } from '@nestjs/common';
import { CurrentPrincipal } from '../auth/decorators/current-principal.decorator.js';
import { RequireRoles } from '../auth/decorators/require-roles.decorator.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';
import { CreateSeatHoldDto } from './dto/create-seat-hold.dto.js';
import { SeatHoldTokenDto } from './dto/seat-hold-token.dto.js';
import { SeatHoldsService } from './seat-holds.service.js';

@Controller('seat-holds')
@RequireRoles('KHACH_HANG')
export class SeatHoldsController {
  constructor(private readonly seatHoldsService: SeatHoldsService) {}

  @Post()
  create(
    @Body() dto: CreateSeatHoldDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.seatHoldsService.create(dto, principal);
  }

  @Delete(':token')
  release(
    @Param() params: SeatHoldTokenDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.seatHoldsService.release(params.token, principal);
  }
}
