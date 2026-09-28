import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CreateFarePriceDto } from './dto/create-fare-price.dto.js';
import { FarePriceIdParamsDto } from './dto/fare-price-id-params.dto.js';
import { QueryFarePricesDto } from './dto/query-fare-prices.dto.js';
import { UpdateFarePriceDto } from './dto/update-fare-price.dto.js';
import { UpdateFarePriceStatusDto } from './dto/update-fare-price-status.dto.js';
import { FarePricesService } from './fare-prices.service.js';

@Controller('fare-prices')
export class FarePricesController {
  constructor(private readonly farePricesService: FarePricesService) {}

  @Post()
  create(@Body() input: CreateFarePriceDto) {
    return this.farePricesService.create(input);
  }

  @Patch(':id')
  update(
    @Param() params: FarePriceIdParamsDto,
    @Body() input: UpdateFarePriceDto,
  ) {
    return this.farePricesService.update(params.id, input);
  }

  @Patch(':id/status')
  updateStatus(
    @Param() params: FarePriceIdParamsDto,
    @Body() input: UpdateFarePriceStatusDto,
  ) {
    return this.farePricesService.updateStatus(params.id, input.status);
  }

  @Get()
  findAll(@Query() query: QueryFarePricesDto) {
    return this.farePricesService.findAll(query);
  }

  @Get(':id')
  findOne(@Param() params: FarePriceIdParamsDto) {
    return this.farePricesService.findOne(params.id);
  }
}
