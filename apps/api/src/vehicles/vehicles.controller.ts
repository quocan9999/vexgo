import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CreateVehicleDto } from './dto/create-vehicle.dto.js';
import { UpdateVehicleDto } from './dto/update-vehicle.dto.js';
import { UpdateVehicleStatusDto } from './dto/update-vehicle-status.dto.js';
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

  @Post()
  create(@Body() input: CreateVehicleDto) {
    return this.vehiclesService.create(input);
  }

  @Patch(':id')
  update(@Param() params: VehicleIdParamsDto, @Body() input: UpdateVehicleDto) {
    return this.vehiclesService.update(params.id, input);
  }

  @Patch(':id/status')
  updateStatus(
    @Param() params: VehicleIdParamsDto,
    @Body() input: UpdateVehicleStatusDto,
  ) {
    return this.vehiclesService.updateStatus(params.id, input);
  }
}
