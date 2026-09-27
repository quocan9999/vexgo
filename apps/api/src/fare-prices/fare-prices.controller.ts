import { Controller, Get, Param, Query } from '@nestjs/common';
import { FarePriceIdParamsDto } from './dto/fare-price-id-params.dto.js';
import { QueryFarePricesDto } from './dto/query-fare-prices.dto.js';
import { FarePricesService } from './fare-prices.service.js';

@Controller('fare-prices')
export class FarePricesController {
  constructor(private readonly farePricesService: FarePricesService) {}

  @Get()
  findAll(@Query() query: QueryFarePricesDto) {
    return this.farePricesService.findAll(query);
  }

  @Get(':id')
  findOne(@Param() params: FarePriceIdParamsDto) {
    return this.farePricesService.findOne(params.id);
  }
}
