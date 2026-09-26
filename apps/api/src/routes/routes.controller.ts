import { Controller, Get, Param, Query } from '@nestjs/common';
import { RouteIdParamsDto } from './dto/route-id-params.dto.js';
import { RouteQueryDto } from './dto/route-query.dto.js';
import { RoutesService } from './routes.service.js';

@Controller('routes')
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Get()
  findAll(@Query() query: RouteQueryDto) {
    return this.routesService.findAll(query);
  }

  @Get(':id')
  findOne(@Param() params: RouteIdParamsDto) {
    return this.routesService.findOne(params.id);
  }
}
