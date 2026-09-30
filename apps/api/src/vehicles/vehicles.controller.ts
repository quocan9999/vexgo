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
import { RequireRoles } from '../auth/decorators/require-roles.decorator.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';

@Controller('vehicles')
@RequireRoles('NHA_XE_ADMIN')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Post()
  create(
    @Body() body: CreateVehicleDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.vehiclesService.create(body, principal);
  }

  @Patch(':id')
  update(
    @Param() params: VehicleIdParamsDto,
    @Body() body: UpdateVehicleDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.vehiclesService.update(params.id, body, principal);
  }

  @Patch(':id/status')
  updateStatus(
    @Param() params: VehicleIdParamsDto,
    @Body() body: UpdateVehicleStatusDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.vehiclesService.updateStatus(params.id, body, principal);
  }

  @Get()
  findAll(
    @Query() query: VehicleQueryDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.vehiclesService.findAll(query, principal);
  }

  @Get(':id')
  findOne(
    @Param() params: VehicleIdParamsDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.vehiclesService.findOne(params.id, principal);
  }

  @Get(':vehicleId/seats')
  findSeats(
    @Param() params: VehicleSeatCollectionParamsDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.vehiclesService.findSeats(params.vehicleId, principal);
  }

  @Post(':vehicleId/seats')
  createSeat(
    @Param() params: VehicleSeatCollectionParamsDto,
    @Body() body: CreateVehicleSeatDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.vehiclesService.createSeat(params.vehicleId, body, principal);
  }

  @Patch(':vehicleId/seats/:seatId')
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
