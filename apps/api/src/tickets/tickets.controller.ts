import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { CurrentPrincipal } from '../auth/decorators/current-principal.decorator.js';
import { Public } from '../auth/decorators/public.decorator.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';
import { TicketsService } from './tickets.service.js';
import { TicketQueryDto } from './dto/ticket-query.dto.js';
import { TicketLookupQueryDto } from './dto/ticket-lookup-query.dto.js';
import {
  PUBLIC_RATE_LIMIT_TTL_MS,
  PUBLIC_TICKET_LOOKUP_RATE_LIMIT,
} from '../common/rate-limit-policy.js';

@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get()
  findCustomerTickets(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Query() query: TicketQueryDto,
  ) {
    return this.ticketsService.findCustomerTickets(principal.taiKhoanId, query);
  }

  @Public()
  @Get('lookup')
  @UseGuards(ThrottlerGuard)
  @Throttle({
    default: {
      limit: PUBLIC_TICKET_LOOKUP_RATE_LIMIT,
      ttl: PUBLIC_RATE_LIMIT_TTL_MS,
    },
  })
  lookupTicket(@Query() query: TicketLookupQueryDto) {
    return this.ticketsService.lookupTicket(query);
  }

  @Get(':ticketId')
  findCustomerTicketById(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('ticketId', ParseIntPipe) ticketId: number,
  ) {
    return this.ticketsService.findCustomerTicketById(
      principal.taiKhoanId,
      ticketId,
    );
  }
}
