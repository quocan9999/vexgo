import { Controller, Get, Param, Query } from '@nestjs/common';
import { VehicleTypeIdParamsDto } from './dto/vehicle-type-id-params.dto.js';
import { VehicleTypeQueryDto } from './dto/vehicle-type-query.dto.js';
import { VehicleTypesService } from './vehicle-types.service.js';

@Controller('vehicle-types')
export class VehicleTypesController {
  constructor(private readonly vehicleTypesService: VehicleTypesService) {}

  @Get()
  findAll(@Query() query: VehicleTypeQueryDto) {
    return this.vehicleTypesService.findAll(query);
  }

  @Get(':id')
  findOne(@Param() params: VehicleTypeIdParamsDto) {
    return this.vehicleTypesService.findOne(params.id);
  }
}
