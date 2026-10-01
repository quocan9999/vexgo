import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CreateVehicleDto } from './dto/create-vehicle.dto.js';
import { VehicleIdParamsDto } from './dto/vehicle-id-params.dto.js';
import { VehicleQueryDto } from './dto/vehicle-query.dto.js';
import { UpdateVehicleDto } from './dto/update-vehicle.dto.js';
import { UpdateVehicleStatusDto } from './dto/update-vehicle-status.dto.js';
import { CreateVehicleSeatDto } from './dto/create-vehicle-seat.dto.js';
import {
  VehicleSeatCollectionParamsDto,
  VehicleSeatParamsDto,
} from './dto/vehicle-seat-params.dto.js';
import { UpdateVehicleSeatDto } from './dto/update-vehicle-seat.dto.js';
import { VehiclesService } from './vehicles.service.js';
import { CurrentPrincipal } from '../auth/decorators/current-principal.decorator.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { RequireRoles } from '../auth/decorators/require-roles.decorator.js';
import { TENANT_PRINCIPAL_ROLES } from '../auth/principal-scope.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';

@Controller('vehicles')
@RequireRoles(...TENANT_PRINCIPAL_ROLES)
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Post()
  @RequirePermissions('vehicle:create')
  create(
    @Body() body: CreateVehicleDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.vehiclesService.create(body, principal);
  }

  @Patch(':id')
  @RequirePermissions('vehicle:update')
  update(
    @Param() params: VehicleIdParamsDto,
    @Body() body: UpdateVehicleDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.vehiclesService.update(params.id, body, principal);
  }

  @Patch(':id/status')
  @RequirePermissions('vehicle:update')
  updateStatus(
    @Param() params: VehicleIdParamsDto,
    @Body() body: UpdateVehicleStatusDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.vehiclesService.updateStatus(params.id, body, principal);
  }

  @Get()
  @RequirePermissions('vehicle:read')
  findAll(
    @Query() query: VehicleQueryDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.vehiclesService.findAll(query, principal);
  }

  @Get(':id')
  @RequirePermissions('vehicle:read')
  findOne(
    @Param() params: VehicleIdParamsDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.vehiclesService.findOne(params.id, principal);
  }

  @Get(':vehicleId/seats')
  @RequirePermissions('seat:read')
  findSeats(
    @Param() params: VehicleSeatCollectionParamsDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.vehiclesService.findSeats(params.vehicleId, principal);
  }

  @Post(':vehicleId/seats')
  @RequirePermissions('seat:create')
  createSeat(
    @Param() params: VehicleSeatCollectionParamsDto,
    @Body() body: CreateVehicleSeatDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.vehiclesService.createSeat(params.vehicleId, body, principal);
  }

  @Patch(':vehicleId/seats/:seatId')
  @RequirePermissions('seat:update')
  updateSeat(
    @Param() params: VehicleSeatParamsDto,
    @Body() body: UpdateVehicleSeatDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.vehiclesService.updateSeat(
      params.vehicleId,
      params.seatId,
      body,
      principal,
    );
  }

  @Delete(':vehicleId/seats/:seatId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('seat:delete')
  deleteSeat(
    @Param() params: VehicleSeatParamsDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.vehiclesService.deleteSeat(
      params.vehicleId,
      params.seatId,
      principal,
    );
  }
}
