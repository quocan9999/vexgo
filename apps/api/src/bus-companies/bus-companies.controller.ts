import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CreateBusCompanyDto } from './dto/create-bus-company.dto.js';
import { BusCompanyIdParamsDto } from './dto/bus-company-id-params.dto.js';
import { BusCompanyQueryDto } from './dto/bus-company-query.dto.js';
import { UpdateBusCompanyDto } from './dto/update-bus-company.dto.js';
import { UpdateBusCompanyStatusDto } from './dto/update-bus-company-status.dto.js';
import { BusCompaniesService } from './bus-companies.service.js';
import { OptionalAuth } from '../auth/decorators/public.decorator.js';
import { OptionalPrincipal } from '../auth/decorators/current-principal.decorator.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';
import { RequireRoles } from '../auth/decorators/require-roles.decorator.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';

@Controller('bus-companies')
export class BusCompaniesController {
  constructor(private readonly busCompaniesService: BusCompaniesService) {}

  @Post()
  @RequireRoles('SUPER_ADMIN')
  @RequirePermissions('bus-company:create')
  create(@Body() body: CreateBusCompanyDto) {
    return this.busCompaniesService.create(body);
  }

  @Patch(':id')
  @RequireRoles('SUPER_ADMIN')
  @RequirePermissions('bus-company:update')
  update(
    @Param() params: BusCompanyIdParamsDto,
    @Body() body: UpdateBusCompanyDto,
  ) {
    return this.busCompaniesService.update(params.id, body);
  }

  @Patch(':id/status')
  @RequireRoles('SUPER_ADMIN')
  @RequirePermissions('bus-company:update')
  updateStatus(
    @Param() params: BusCompanyIdParamsDto,
    @Body() body: UpdateBusCompanyStatusDto,
  ) {
    return this.busCompaniesService.updateStatus(params.id, body);
  }

  @Get()
  @OptionalAuth()
  findAll(
    @Query() query: BusCompanyQueryDto,
    @OptionalPrincipal() principal: AuthPrincipal | undefined,
  ) {
    return this.busCompaniesService.findAll(query, principal);
  }

  @Get(':id')
  @OptionalAuth()
  findOne(
    @Param() params: BusCompanyIdParamsDto,
    @OptionalPrincipal() principal: AuthPrincipal | undefined,
  ) {
    return this.busCompaniesService.findOne(params.id, principal);
  }
}
