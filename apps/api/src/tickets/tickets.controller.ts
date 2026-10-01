import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { CurrentPrincipal } from '../auth/decorators/current-principal.decorator.js';
import { Public } from '../auth/decorators/public.decorator.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';
import { TicketsService } from './tickets.service.js';
import { TicketQueryDto } from './dto/ticket-query.dto.js';
import { TicketLookupQueryDto } from './dto/ticket-lookup-query.dto.js';

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
