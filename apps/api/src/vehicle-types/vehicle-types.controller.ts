import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CreateVehicleTypeDto } from './dto/create-vehicle-type.dto.js';
import { VehicleTypeIdParamsDto } from './dto/vehicle-type-id-params.dto.js';
import { VehicleTypeQueryDto } from './dto/vehicle-type-query.dto.js';
import { UpdateVehicleTypeDto } from './dto/update-vehicle-type.dto.js';
import { VehicleTypesService } from './vehicle-types.service.js';
import { CurrentPrincipal } from '../auth/decorators/current-principal.decorator.js';
import { RequireRoles } from '../auth/decorators/require-roles.decorator.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';

@Controller('vehicle-types')
@RequireRoles('NHA_XE_ADMIN')
export class VehicleTypesController {
  constructor(private readonly vehicleTypesService: VehicleTypesService) {}

  @Get()
  findAll(
    @Query() query: VehicleTypeQueryDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.vehicleTypesService.findAll(query, principal);
  }

  @Get(':id')
  findOne(
    @Param() params: VehicleTypeIdParamsDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.vehicleTypesService.findOne(params.id, principal);
  }

  @Post()
  create(
    @Body() body: CreateVehicleTypeDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.vehicleTypesService.create(body, principal);
  }

  @Patch(':id')
  update(
    @Param() params: VehicleTypeIdParamsDto,
    @Body() body: UpdateVehicleTypeDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.vehicleTypesService.update(params.id, body, principal);
  }
}
