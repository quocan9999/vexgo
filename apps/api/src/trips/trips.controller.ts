import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { TripsService } from './trips.service.js';
import { CreateTripDto } from './dto/create-trip.dto.js';
import { SearchTripsDto } from './dto/search-trips.dto.js';
import { TripQueryDto } from './dto/trip-query.dto.js';
import { TripIdParamsDto } from './dto/trip-id-params.dto.js';
import { UpdateTripDto } from './dto/update-trip.dto.js';
import { UpdateTripStatusDto } from './dto/update-trip-status.dto.js';
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

  @Post()
  @RequireRoles(...TENANT_PRINCIPAL_ROLES)
  @RequirePermissions('trip:create')
  create(
    @Body() body: CreateTripDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.tripsService.create(body, principal);
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

  @Patch(':id')
  @RequireRoles(...TENANT_PRINCIPAL_ROLES)
  @RequirePermissions('trip:update')
  update(
    @Param() params: TripIdParamsDto,
    @Body() body: UpdateTripDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.tripsService.update(params.id, body, principal);
  }

  @Patch(':id/status')
  @RequireRoles(...TENANT_PRINCIPAL_ROLES)
  @RequirePermissions('trip:update')
  updateStatus(
    @Param() params: TripIdParamsDto,
    @Body() body: UpdateTripStatusDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.tripsService.updateStatus(params.id, body, principal);
  }

  @Post(':id/cancel')
  @RequireRoles(...TENANT_PRINCIPAL_ROLES)
  @RequirePermissions('trip:cancel')
  cancel(
    @Param() params: TripIdParamsDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.tripsService.cancel(params.id, principal);
  }

  @Get(':id/seats')
  @OptionalAuth()
  getSeats(@Param('id', ParseIntPipe) id: number) {
    return this.tripsService.getSeats(id);
  }
}
