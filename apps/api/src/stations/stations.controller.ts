import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { StationsService } from './stations.service.js';
import { CreateStationDto } from './dto/create-station.dto.js';
import { UpdateStationDto } from './dto/update-station.dto.js';
import { StationQueryDto } from './dto/station-query.dto.js';
import { UpdateTripPassengerPointsDto } from './dto/trip-passenger-points.dto.js';
import { OptionalAuth } from '../auth/decorators/public.decorator.js';
import {
  CurrentPrincipal,
  OptionalPrincipal,
} from '../auth/decorators/current-principal.decorator.js';
import { RequireRoles } from '../auth/decorators/require-roles.decorator.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { RequireTenantPermissionsIfAuthenticated } from '../auth/decorators/require-tenant-permissions-if-authenticated.decorator.js';
import { TENANT_PRINCIPAL_ROLES } from '../auth/principal-scope.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';

@Controller()
export class StationsController {
  constructor(private readonly stationsService: StationsService) {}

  @Get('stations')
  @OptionalAuth()
  @RequireTenantPermissionsIfAuthenticated('route:read')
  list(
    @Query() query: StationQueryDto,
    @OptionalPrincipal() principal?: AuthPrincipal,
  ) {
    return this.stationsService.list(query, principal);
  }

  @Post('stations')
  @RequireRoles(...TENANT_PRINCIPAL_ROLES)
  @RequirePermissions('route:create')
  create(
    @Body() body: CreateStationDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.stationsService.create(body, principal);
  }

  @Get('stations/:id')
  @OptionalAuth()
  @RequireTenantPermissionsIfAuthenticated('route:read')
  findById(
    @Param('id', ParseIntPipe) id: number,
    @OptionalPrincipal() principal?: AuthPrincipal,
  ) {
    return this.stationsService.findById(id, principal);
  }

  @Patch('stations/:id')
  @RequireRoles(...TENANT_PRINCIPAL_ROLES)
  @RequirePermissions('route:update')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateStationDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.stationsService.update(id, body, principal);
  }

  @Delete('stations/:id')
  @RequireRoles(...TENANT_PRINCIPAL_ROLES)
  @RequirePermissions('route:update')
  delete(
    @Param('id', ParseIntPipe) id: number,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.stationsService.delete(id, principal);
  }

  @Get('trips/:id/passenger-points')
  @RequireRoles(...TENANT_PRINCIPAL_ROLES)
  @RequirePermissions('trip:read')
  getTripPointsForAdmin(
    @Param('id', ParseIntPipe) tripId: number,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.stationsService.getTripPassengerPointsForAdmin(tripId, principal);
  }

  @Get('trips/:id/passenger-points/public')
  @OptionalAuth()
  getTripPointsPublic(@Param('id', ParseIntPipe) tripId: number) {
    return this.stationsService.getTripPassengerPointsPublic(tripId);
  }

  @Put('trips/:id/passenger-points')
  @RequireRoles(...TENANT_PRINCIPAL_ROLES)
  @RequirePermissions('trip:update')
  updateTripPoints(
    @Param('id', ParseIntPipe) tripId: number,
    @Body() body: UpdateTripPassengerPointsDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.stationsService.updateTripPassengerPoints(tripId, body, principal);
  }
}
