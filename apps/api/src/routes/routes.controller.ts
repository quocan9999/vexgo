import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CreateRouteDto } from './dto/create-route.dto.js';
import { RouteIdParamsDto } from './dto/route-id-params.dto.js';
import { RouteQueryDto } from './dto/route-query.dto.js';
import { UpdateRouteDto } from './dto/update-route.dto.js';
import { UpdateRouteStatusDto } from './dto/update-route-status.dto.js';
import { RoutesService } from './routes.service.js';

@Controller('routes')
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Post()
  create(@Body() body: CreateRouteDto) {
    return this.routesService.create(body);
  }

  @Patch(':id')
  update(@Param() params: RouteIdParamsDto, @Body() body: UpdateRouteDto) {
    return this.routesService.update(params.id, body);
  }

  @Patch(':id/status')
  updateStatus(@Param() params: RouteIdParamsDto, @Body() body: UpdateRouteStatusDto) {
    return this.routesService.updateStatus(params.id, body.status);
  }

  @Get()
  findAll(@Query() query: RouteQueryDto) {
    return this.routesService.findAll(query);
  }

  @Get(':id')
  findOne(@Param() params: RouteIdParamsDto) {
    return this.routesService.findOne(params.id);
  }
}
