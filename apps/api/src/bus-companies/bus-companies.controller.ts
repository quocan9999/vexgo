import { Controller, Get, Param, Query } from '@nestjs/common';
import { BusCompanyIdParamsDto } from './dto/bus-company-id-params.dto.js';
import { BusCompanyQueryDto } from './dto/bus-company-query.dto.js';
import { BusCompaniesService } from './bus-companies.service.js';

@Controller('bus-companies')
export class BusCompaniesController {
  constructor(private readonly busCompaniesService: BusCompaniesService) {}

  @Get()
  findAll(@Query() query: BusCompanyQueryDto) {
    return this.busCompaniesService.findAll(query);
  }

  @Get(':id')
  findOne(@Param() params: BusCompanyIdParamsDto) {
    return this.busCompaniesService.findOne(params.id);
  }
}
