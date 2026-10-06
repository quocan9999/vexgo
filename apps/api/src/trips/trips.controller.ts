import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
import { TripSeatsQueryDto } from './dto/trip-seats-query.dto.js';
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

  @Get(':id/operational-detail')
  @RequireRoles(...TENANT_PRINCIPAL_ROLES)
  @RequirePermissions('trip:read')
  findOne(
    @Param() params: TripIdParamsDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.tripsService.findOne(params.id, principal);
  }

  @Get(':id/seat-inventory')
  @RequireRoles(...TENANT_PRINCIPAL_ROLES)
  @RequirePermissions('trip:read')
  getSeatInventory(
    @Param() params: TripIdParamsDto,
    @Query() query: TripSeatsQueryDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.tripsService.getSeats(params.id, query, principal);
  }

  @Get(':id/seats')
  @OptionalAuth()
  getCustomerSeats(@Param() params: TripIdParamsDto) {
    return this.tripsService.getCustomerSeats(params.id);
  }

  @Get(':id/alternatives')
  @OptionalAuth()
  getTripAlternatives(
    @Param() params: TripIdParamsDto,
    @Query('limit') limit?: string,
  ) {
    return this.tripsService.getTripAlternatives(
      params.id,
      limit ? Number(limit) : 5,
    );
  }

  @Get(':id')
  @OptionalAuth()
  getDetails(@Param() params: TripIdParamsDto) {
    return this.tripsService.getDetails(params.id);
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
  @HttpCode(HttpStatus.OK)
  @RequireRoles(...TENANT_PRINCIPAL_ROLES)
  @RequirePermissions('trip:update')
  cancel(
    @Param() params: TripIdParamsDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.tripsService.cancel(params.id, principal);
  }
}
