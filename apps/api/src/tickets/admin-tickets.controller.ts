import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { CurrentPrincipal } from '../auth/decorators/current-principal.decorator.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { RequireRoles } from '../auth/decorators/require-roles.decorator.js';
import { TENANT_PRINCIPAL_ROLES } from '../auth/principal-scope.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';
import {
  AdminHistoryQueryDto,
  AdminTicketQueryDto,
} from '../bookings/dto/admin-booking-query.dto.js';
import { AdminTicketsService } from './admin-tickets.service.js';

@Controller('admin/tickets')
@RequireRoles(...TENANT_PRINCIPAL_ROLES)
@RequirePermissions('booking:read')
export class AdminTicketsController {
  constructor(private readonly adminTicketsService: AdminTicketsService) {}

  @Get()
  list(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Query() query: AdminTicketQueryDto,
  ) {
    return this.adminTicketsService.list(principal, query);
  }

  @Get(':id/history')
  history(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('id', ParseIntPipe) id: number,
    @Query() query: AdminHistoryQueryDto,
  ) {
    return this.adminTicketsService.history(principal, id, query);
  }

  @Get(':id')
  detail(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.adminTicketsService.detail(principal, id);
  }
}
