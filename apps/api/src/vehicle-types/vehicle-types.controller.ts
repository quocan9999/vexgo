import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CreateVehicleTypeDto } from './dto/create-vehicle-type.dto.js';
import { VehicleTypeIdParamsDto } from './dto/vehicle-type-id-params.dto.js';
import { VehicleTypeQueryDto } from './dto/vehicle-type-query.dto.js';
import { UpdateVehicleTypeDto } from './dto/update-vehicle-type.dto.js';
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

  @Post()
  create(@Body() body: CreateVehicleTypeDto) {
    return this.vehicleTypesService.create(body);
  }

  @Patch(':id')
  update(
    @Param() params: VehicleTypeIdParamsDto,
    @Body() body: UpdateVehicleTypeDto,
  ) {
    return this.vehicleTypesService.update(params.id, body);
  }
}
