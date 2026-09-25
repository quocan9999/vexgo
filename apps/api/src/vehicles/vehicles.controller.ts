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
import { VehicleIdParamsDto } from './dto/vehicle-id-params.dto.js';
import { VehicleQueryDto } from './dto/vehicle-query.dto.js';
import { UpdateVehicleDto } from './dto/update-vehicle.dto.js';
import { UpdateVehicleStatusDto } from './dto/update-vehicle-status.dto.js';
import { VehiclesService } from './vehicles.service.js';

@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Post()
  create(@Body() body: CreateVehicleDto) {
    return this.vehiclesService.create(body);
  }

  @Patch(':id')
  update(@Param() params: VehicleIdParamsDto, @Body() body: UpdateVehicleDto) {
    return this.vehiclesService.update(params.id, body);
  }

  @Patch(':id/status')
  updateStatus(
    @Param() params: VehicleIdParamsDto,
    @Body() body: UpdateVehicleStatusDto,
  ) {
    return this.vehiclesService.updateStatus(params.id, body);
  }

  @Get()
  findAll(@Query() query: VehicleQueryDto) {
    return this.vehiclesService.findAll(query);
  }

  @Get(':id')
  findOne(@Param() params: VehicleIdParamsDto) {
    return this.vehiclesService.findOne(params.id);
  }
}
