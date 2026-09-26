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

  @Get(':vehicleId/seats')
  findSeats(@Param() params: VehicleSeatCollectionParamsDto) {
    return this.vehiclesService.findSeats(params.vehicleId);
  }

  @Post(':vehicleId/seats')
  createSeat(
    @Param() params: VehicleSeatCollectionParamsDto,
    @Body() body: CreateVehicleSeatDto,
  ) {
    return this.vehiclesService.createSeat(params.vehicleId, body);
  }

  @Patch(':vehicleId/seats/:seatId')
  updateSeat(
    @Param() params: VehicleSeatParamsDto,
    @Body() body: UpdateVehicleSeatDto,
  ) {
    return this.vehiclesService.updateSeat(
      params.vehicleId,
      params.seatId,
      body,
    );
  }

  @Delete(':vehicleId/seats/:seatId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteSeat(@Param() params: VehicleSeatParamsDto) {
    return this.vehiclesService.deleteSeat(params.vehicleId, params.seatId);
  }
}
