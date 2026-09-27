import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CreateFarePriceDto } from './dto/create-fare-price.dto.js';
import { FarePriceIdParamsDto } from './dto/fare-price-id-params.dto.js';
import { QueryFarePricesDto } from './dto/query-fare-prices.dto.js';
import { FarePricesService } from './fare-prices.service.js';

@Controller('fare-prices')
export class FarePricesController {
  constructor(private readonly farePricesService: FarePricesService) {}

  @Post()
  create(@Body() input: CreateFarePriceDto) {
    return this.farePricesService.create(input);
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
