import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { TripsService } from './trips.service.js';
import { SearchTripsDto } from './dto/search-trips.dto.js';
import { TripQueryDto } from './dto/trip-query.dto.js';
import { TripIdParamsDto } from './dto/trip-id-params.dto.js';
import { OptionalAuth } from '../auth/decorators/public.decorator.js';
import { CurrentPrincipal } from '../auth/decorators/current-principal.decorator.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { RequireRoles } from '../auth/decorators/require-roles.decorator.js';
import { TENANT_PRINCIPAL_ROLES } from '../auth/principal-scope.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';

@Controller('trips')
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Get('search')
  @OptionalAuth()
  search(@Query() query: SearchTripsDto) {
    return this.tripsService.search(query);
  }

  @Get()
  @RequireRoles(...TENANT_PRINCIPAL_ROLES)
  @RequirePermissions('trip:read')
  findAll(
    @Query() query: TripQueryDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.tripsService.findAll(query, principal);
  }

  @Get(':id')
  @RequireRoles(...TENANT_PRINCIPAL_ROLES)
  @RequirePermissions('trip:read')
  findOne(
    @Param() params: TripIdParamsDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.tripsService.findOne(params.id, principal);
  }

  @Get(':id/seats')
  @OptionalAuth()
  getSeats(@Param('id', ParseIntPipe) id: number) {
    return this.tripsService.getSeats(id);
  }
}
