import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { CurrentPrincipal } from '../auth/decorators/current-principal.decorator.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { RequireRoles } from '../auth/decorators/require-roles.decorator.js';
import { TENANT_PRINCIPAL_ROLES } from '../auth/principal-scope.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';
import {
  AdminBookingQueryDto,
  AdminHistoryQueryDto,
} from './dto/admin-booking-query.dto.js';
import { AdminBookingsService } from './admin-bookings.service.js';

@Controller('admin/bookings')
@RequireRoles(...TENANT_PRINCIPAL_ROLES)
@RequirePermissions('booking:read')
export class AdminBookingsController {
  constructor(private readonly adminBookingsService: AdminBookingsService) {}

  @Get()
  list(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Query() query: AdminBookingQueryDto,
  ) {
    return this.adminBookingsService.list(principal, query);
  }

  @Get(':id/history')
  history(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('id', ParseIntPipe) id: number,
    @Query() query: AdminHistoryQueryDto,
  ) {
    return this.adminBookingsService.history(principal, id, query);
  }

  @Get(':id')
  detail(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.adminBookingsService.detail(principal, id);
  }
}
