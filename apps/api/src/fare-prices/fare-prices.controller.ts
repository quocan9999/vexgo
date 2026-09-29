import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentPrincipal } from '../auth/decorators/current-principal.decorator.js';
import { RequireRoles } from '../auth/decorators/require-roles.decorator.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';
import { CreateFarePriceDto } from './dto/create-fare-price.dto.js';
import { FarePriceIdParamsDto } from './dto/fare-price-id-params.dto.js';
import { QueryFarePricesDto } from './dto/query-fare-prices.dto.js';
import { ResolveApplicableFareQueryDto } from './dto/resolve-applicable-fare-query.dto.js';
import { UpdateFarePriceDto } from './dto/update-fare-price.dto.js';
import { UpdateFarePriceStatusDto } from './dto/update-fare-price-status.dto.js';
import { FarePricesService } from './fare-prices.service.js';

@Controller('fare-prices')
@RequireRoles('NHA_XE_ADMIN')
export class FarePricesController {
  constructor(private readonly farePricesService: FarePricesService) {}

  @Post()
  create(
    @Body() input: CreateFarePriceDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.farePricesService.create(input, principal);
  }

  @Patch(':id')
  update(
    @Param() params: FarePriceIdParamsDto,
    @Body() input: UpdateFarePriceDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.farePricesService.update(params.id, input, principal);
  }

  @Patch(':id/status')
  updateStatus(
    @Param() params: FarePriceIdParamsDto,
    @Body() input: UpdateFarePriceStatusDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.farePricesService.updateStatus(params.id, input.status, principal);
  }

  @Get()
  findAll(
    @Query() query: QueryFarePricesDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.farePricesService.findAll(query, principal);
  }

  @Get('applicable')
  resolveApplicableFare(
    @Query() query: ResolveApplicableFareQueryDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.farePricesService.resolveApplicableFare(query, principal);
  }

  @Get(':id')
  findOne(
    @Param() params: FarePriceIdParamsDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.farePricesService.findOne(params.id, principal);
  }
}
