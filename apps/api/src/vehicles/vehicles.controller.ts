import { Controller, Get, Param, Query } from '@nestjs/common';
import { VehicleIdParamsDto } from './dto/vehicle-id-params.dto.js';
import { VehicleQueryDto } from './dto/vehicle-query.dto.js';
import { VehiclesService } from './vehicles.service.js';

@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Get()
  findAll(@Query() query: VehicleQueryDto) {
    return this.vehiclesService.findAll(query);
  }

  @Get(':id')
  findOne(@Param() params: VehicleIdParamsDto) {
    return this.vehiclesService.findOne(params.id);
  }
}
