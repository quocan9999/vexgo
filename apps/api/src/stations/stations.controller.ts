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
import { CurrentPrincipal } from '../auth/decorators/current-principal.decorator.js';
import { RequireRoles } from '../auth/decorators/require-roles.decorator.js';
import { TENANT_PRINCIPAL_ROLES } from '../auth/principal-scope.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';

@Controller()
export class StationsController {
  constructor(private readonly stationsService: StationsService) {}

  @Get('stations')
  @OptionalAuth()
  list(
    @Query() query: StationQueryDto,
    @CurrentPrincipal() principal?: AuthPrincipal,
  ) {
    return this.stationsService.list(query, principal);
  }

  @Post('stations')
  @RequireRoles(...TENANT_PRINCIPAL_ROLES)
  create(
    @Body() body: CreateStationDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.stationsService.create(body, principal);
  }

  @Get('stations/:id')
  @OptionalAuth()
  findById(
    @Param('id', ParseIntPipe) id: number,
    @CurrentPrincipal() principal?: AuthPrincipal,
  ) {
    return this.stationsService.findById(id, principal);
  }

  @Patch('stations/:id')
  @RequireRoles(...TENANT_PRINCIPAL_ROLES)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateStationDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.stationsService.update(id, body, principal);
  }

  @Delete('stations/:id')
  @RequireRoles(...TENANT_PRINCIPAL_ROLES)
  delete(
    @Param('id', ParseIntPipe) id: number,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.stationsService.delete(id, principal);
  }

  @Get('trips/:id/passenger-points')
  @OptionalAuth()
  getTripPoints(@Param('id', ParseIntPipe) tripId: number) {
    return this.stationsService.getTripPassengerPoints(tripId);
  }

  @Put('trips/:id/passenger-points')
  @RequireRoles(...TENANT_PRINCIPAL_ROLES)
  updateTripPoints(
    @Param('id', ParseIntPipe) tripId: number,
    @Body() body: UpdateTripPassengerPointsDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.stationsService.updateTripPassengerPoints(tripId, body, principal);
  }
}
