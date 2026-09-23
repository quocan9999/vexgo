import { Controller, Get, Query } from '@nestjs/common';
import { BusCompanyQueryDto } from './dto/bus-company-query.dto.js';
import { BusCompaniesService } from './bus-companies.service.js';

@Controller('bus-companies')
export class BusCompaniesController {
  constructor(private readonly busCompaniesService: BusCompaniesService) {}

  @Get()
  findAll(@Query() query: BusCompanyQueryDto) {
    return this.busCompaniesService.findAll(query);
  }
}
